import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteUploadedFile } from "@/lib/uploads";
import type { Database } from "@/lib/supabase/types";

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: listing, error } = await supabase
    .from("listings")
    .select("id, seller_id, images")
    .eq("id", params.id)
    .single<{ id: string; seller_id: string; images: string[] | null }>();

  if (error || !listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  if (listing.seller_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  for (const imageUrl of listing.images ?? []) {
    try {
      const bucketPrefix = "/storage/v1/object/public/listing-images/";
      const index = imageUrl.indexOf(bucketPrefix);
      if (index === -1) continue;
      const path = decodeURIComponent(imageUrl.slice(index + bucketPrefix.length));
      await deleteUploadedFile({ supabase: admin as import("@supabase/supabase-js").SupabaseClient<Database>, target: "listing", path });
    } catch {
      continue;
    }
  }

  const { error: deleteError } = await supabase.from("listings").delete().eq("id", params.id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
