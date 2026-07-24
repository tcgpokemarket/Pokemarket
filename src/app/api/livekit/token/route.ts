import { NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const room = url.searchParams.get("room") ?? "tcg-poke-market-live";
  const identity = url.searchParams.get("identity") ?? "host";
  const publish = url.searchParams.get("publish") === "true";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

  if (!apiKey || !apiSecret || !livekitUrl) {
    return NextResponse.json({ error: "LiveKit is not configured" }, { status: 500 });
  }

  const token = new AccessToken(apiKey, apiSecret, {
    identity: identity || user.id,
    ttl: "10m",
  });

  token.addGrant({ roomJoin: true, room, canPublish: publish, canSubscribe: true });
  token.metadata = JSON.stringify({ role: publish ? "host" : "viewer" });

  return NextResponse.json({ token: await token.toJwt(), room, url: livekitUrl });
}
