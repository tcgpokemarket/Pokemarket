import { NextResponse } from "next/server";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isListingImageUrl } from "@/lib/uploads";

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
  const { data: listing, error: lookupError } = await supabase.from("listings").select("id, seller_id, images").eq("id", id).maybeSingle<{ id: string; seller_id: string; images: string[] | null }>();

  if (lookupError) {
    return NextResponse.json({ error: lookupError.message }, { status: 400 });
  }

  if (!listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  if (listing.seller_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const imagePaths = (listing.images ?? []).map((url) => isListingImageUrl(url)).filter((value): value is { bucket: string; path: string } => Boolean(value)).map((value) => value.path);

  const { error } = await supabase.from("listings").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message ?? "Failed to remove listing." }, { status: 400 });
  }

  if (imagePaths.length) {
    const cleanup = await admin.storage.from("listing-images").remove(imagePaths);
    if (cleanup.error) {
      console.warn("[listings.delete] storage cleanup failed", { listingId: id, error: cleanup.error.message, imagePaths });
    }
  }

  return NextResponse.json({ success: true });
}
