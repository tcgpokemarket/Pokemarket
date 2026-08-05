import { NextResponse } from "next/server";
import crypto from "crypto";

export async function GET(req: Request) {
  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = process.env.CLOUDINARY_UPLOAD_FOLDER ?? "";
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME ?? "";
    const apiKey = process.env.CLOUDINARY_API_KEY ?? "";

    if (!process.env.CLOUDINARY_API_SECRET || !cloudName || !apiKey) {
      return NextResponse.json({ error: "Cloudinary not configured" }, { status: 500 });
    }

    // Build the string to sign
    let paramsToSign = `timestamp=${timestamp}`;
    if (folder) paramsToSign += `&folder=${folder}`;

    const signature = crypto.createHash("sha1").update(paramsToSign + process.env.CLOUDINARY_API_SECRET).digest("hex");

    return NextResponse.json({ timestamp, signature, apiKey, cloudName, uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET ?? null, folder });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
