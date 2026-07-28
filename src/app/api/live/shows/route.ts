import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";
import { getAppRole, isAdmin } from "@/lib/security";
import { getActiveLiveShow, type LiveShowSummary } from "@/lib/live-commerce";

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("live_shows")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ shows: data ?? [] });
}

type CreateShowBody = {
  title?: string;
  description?: string | null;
  thumbnail?: string | null;
  scheduled_start?: string | null;
  scheduled_end?: string | null;
  status?: string;
  auction_state?: string | null;
  auction_settings?: Json;
  host_permissions?: string[] | null;
};

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as CreateShowBody;
  if (!body.title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const role = getAppRole(user);
  const allowOverride = isAdmin(user) || role === "super_admin";

  const requestedStatus = body.status ?? "scheduled";
  const requestedAuctionState = body.auction_state ?? "upcoming";
  const goingLive = requestedStatus === "live" || requestedAuctionState === "live";

  if (goingLive && !allowOverride) {
    const { data: sellerShows, error: conflictError } = await supabase
      .from("live_shows")
      .select("id, title, status, auction_state, scheduled_start, created_at")
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false });

    if (conflictError) {
      return NextResponse.json({ error: conflictError.message }, { status: 500 });
    }

    const activeShow = getActiveLiveShow((sellerShows ?? []) as LiveShowSummary[]);
    if (activeShow) {
      return NextResponse.json(
        {
          error: "You already have an active live show. End your current show before starting another.",
          active_show: activeShow,
        },
        { status: 409 },
      );
    }
  }

  const payload = {
    seller_id: user.id,
    title: body.title.trim(),
    description: body.description ?? null,
    thumbnail: body.thumbnail ?? null,
    status: requestedStatus,
    auction_state: requestedAuctionState,
    scheduled_start: body.scheduled_start ?? null,
    scheduled_end: body.scheduled_end ?? null,
    host_permissions: ["host", "moderate_chat", "start_auction", "end_auction"],
    auction_settings: body.auction_settings ?? { min_increment: 1, anti_snipe_seconds: 10, chat_slow_mode_seconds: 0 },
  };

  const { data, error } = await supabase.from("live_shows").insert(payload as any).select("*").single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ show: data }, { status: 201 });
}
