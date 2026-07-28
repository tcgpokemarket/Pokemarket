import { NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminUser } from "@/lib/admin-access";

const LIVE_ROOM_PREFIX = "tcg-poke-market-";

function getShowIdFromRoom(room: string) {
  return room.startsWith(LIVE_ROOM_PREFIX) ? room.slice(LIVE_ROOM_PREFIX.length) : null;
}

async function canPublishToRoom(userId: string, room: string) {
  const showId = getShowIdFromRoom(room);
  if (!showId) return false;

  const admin = createAdminClient();
  const { data: show, error } = await (admin as any)
    .from("live_shows")
    .select("seller_id, host_permissions")
    .eq("id", showId)
    .maybeSingle();

  if (error || !show) return false;
  const permissions = Array.isArray(show.host_permissions) ? show.host_permissions : [];
  return show.seller_id === userId || permissions.includes("host");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const room = url.searchParams.get("room") ?? `${LIVE_ROOM_PREFIX}live`;
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

  if (publish && !(await canPublishToRoom(user.id, room))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const token = new AccessToken(apiKey, apiSecret, {
    identity: user.id,
    ttl: "10m",
  });

  token.addGrant({ roomJoin: true, room, canPublish: publish, canSubscribe: true });
  token.metadata = JSON.stringify({ role: publish ? "host" : "viewer" });

  return NextResponse.json({ token: await token.toJwt(), room, url: livekitUrl });
}
