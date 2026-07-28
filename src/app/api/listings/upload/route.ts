import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { uploadImageFile, MAX_IMAGE_SIZE_BYTES } from "@/lib/uploads";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json({ error: "Expected multipart upload." }, { status: 400 });
  }

  const formData = await request.formData();
  const files = formData.getAll("files").filter((entry): entry is File => entry instanceof File && entry.size > 0);
  const prefix = String(formData.get("prefix") ?? "listing-image");

  if (!files.length) {
    return NextResponse.json({ error: "No files provided." }, { status: 400 });
  }

  const admin = createAdminClient();
  const results: Array<{ publicUrl: string; path: string; bucket: string }> = [];

  for (const file of files) {
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: `${file.name} must be an image.` }, { status: 400 });
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      return NextResponse.json({ error: `${file.name} exceeds the ${Math.round(MAX_IMAGE_SIZE_BYTES / 1024 / 1024)}MB upload limit.` }, { status: 400 });
    }

    const uploaded = await uploadImageFile({
      supabase: admin,
      target: "listing",
      ownerId: user.id,
      file,
      prefix,
    });

    results.push(uploaded);
  }

  return NextResponse.json({ files: results }, { status: 201 });
}
