import { NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const room = url.searchParams.get("room") ?? "tcg-poke-market-live";
  const identity = url.searchParams.get("identity") ?? "host";

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

  if (!apiKey || !apiSecret || !livekitUrl) {
    return NextResponse.json({ error: "LiveKit is not configured" }, { status: 500 });
  }

  const token = new AccessToken(apiKey, apiSecret, {
    identity,
    ttl: "10m",
  });

  token.addGrant({ roomJoin: true, room });

  return NextResponse.json({ token: await token.toJwt(), room, url: livekitUrl });
}
