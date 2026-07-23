import { NextResponse } from "next/server";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isListingImageUrl } from "@/lib/uploads";
import { isAdminUser } from "@/lib/admin-access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const admin = createAdminClient();

  const { data: listing, error: lookupError } = await (admin as any)
    .from("listings")
    .select("id, seller_id, images, status")
    .eq("id", id)
    .maybeSingle();

  if (lookupError) {
    console.error("[listings.delete] lookup failed", { listingId: id, authUserId: user.id, error: lookupError.message });
    return NextResponse.json({ error: lookupError.message }, { status: 400 });
  }

  if (!listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  const canDelete = isAdminUser(user) || listing.seller_id === user.id;
  if (!canDelete) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const imagePaths = ((listing.images ?? []) as string[])
    .map((url) => isListingImageUrl(url))
    .filter((value): value is { bucket: string; path: string } => Boolean(value))
    .map((value) => value.path);

  const { data: orderRows, error: orderLookupError } = await (admin as any)
    .from("orders")
    .select("id")
    .eq("listing_id", id)
    .limit(1);

  if (orderLookupError) {
    console.error("[listings.delete] order lookup failed", { listingId: id, authUserId: user.id, error: orderLookupError.message });
    return NextResponse.json({ error: orderLookupError.message }, { status: 400 });
  }

  const hadSales = Boolean(orderRows?.length);
  const shouldSoftDelete = hadSales || listing.status === "sold";
  const now = new Date().toISOString();

  if (shouldSoftDelete) {
    const { error: updateError } = await (admin as any)
      .from("listings")
      .update({ status: "removed", updated_at: now })
      .eq("id", id);

    if (updateError) {
      console.error("[listings.delete] soft delete failed", { listingId: id, authUserId: user.id, error: updateError.message, status: listing.status, hadSales });
      return NextResponse.json({ error: updateError.message ?? "Failed to archive listing." }, { status: 400 });
    }
  } else {
    const cleanupActions = [{ table: "live_show_items", name: "live_show_items" }] as const;

    for (const action of cleanupActions) {
      const { error: cleanupError } = await (admin as any).from(action.table).update({ listing_id: null }).eq("listing_id", id);
      if (cleanupError) {
        console.warn("[listings.delete] dependency cleanup skipped", { listingId: id, authUserId: user.id, table: action.name, error: cleanupError.message });
      }
    }

    const { error: deleteError } = await (admin as any).from("listings").delete().eq("id", id);
    if (deleteError) {
      console.error("[listings.delete] hard delete failed", { listingId: id, authUserId: user.id, error: deleteError.message, status: listing.status, hadSales });
      return NextResponse.json({ error: deleteError.message ?? "Failed to remove listing." }, { status: 400 });
    }
  }

  if (imagePaths.length) {
    const cleanup = await admin.storage.from("listing-images").remove(imagePaths);
    if (cleanup.error) {
      console.warn("[listings.delete] storage cleanup failed", { listingId: id, authUserId: user.id, error: cleanup.error.message, imagePaths });
    }
  }

  return NextResponse.json({ success: true, mode: shouldSoftDelete ? "soft-delete" : "hard-delete" });
}
