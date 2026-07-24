import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const validActions = new Set(["follow", "unfollow", "friend-request", "friend-respond", "block", "unblock", "mark-notification-read"]);

async function getAuthedUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

function normalizeId(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStatus(value: unknown) {
  const status = normalizeId(value);
  return status === "accepted" || status === "blocked" ? status : "";
}

export async function POST(req: Request, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  if (!validActions.has(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const { supabase, user } = await getAuthedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const targetUserId = normalizeId(body.targetUserId ?? body.userId ?? body.followingId);
  if (action !== "mark-notification-read" && !targetUserId) {
    return NextResponse.json({ error: "Missing target user" }, { status: 400 });
  }

  if (action === "follow") {
    const [{ error: followError }, { error: sellerError }] = await Promise.all([
      admin.from("follows").upsert({ follower_id: user.id, following_id: targetUserId } as any, { onConflict: "follower_id,following_id" }),
      admin.from("seller_followers").upsert({ seller_id: targetUserId, follower_id: user.id } as any, { onConflict: "seller_id,follower_id" }),
    ]);

    const error = followError ?? sellerError;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  }

  if (action === "unfollow") {
    const [{ error: followError }, { error: sellerError }] = await Promise.all([
      admin.from("follows").delete().eq("follower_id", user.id).eq("following_id", targetUserId),
      admin.from("seller_followers").delete().eq("seller_id", targetUserId).eq("follower_id", user.id),
    ]);

    const error = followError ?? sellerError;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  }

  if (action === "friend-request") {
    const { error } = await admin.from("friendships").upsert({ requester_id: user.id, receiver_id: targetUserId, status: "pending" } as any, { onConflict: "requester_id,receiver_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  }

  if (action === "friend-respond") {
    const status = normalizeStatus(body.status);
    if (!status) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const { error } = await (admin as any)
      .from("friendships")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("receiver_id", user.id)
      .eq("requester_id", targetUserId)
      .eq("status", "pending");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  }

  if (action === "block") {
    const { error } = await admin.from("blocks").upsert({ blocker_id: user.id, blocked_id: targetUserId } as any, { onConflict: "blocker_id,blocked_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "unblock") {
    const { error } = await admin.from("blocks").delete().eq("blocker_id", user.id).eq("blocked_id", targetUserId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "mark-notification-read") {
    const notificationId = normalizeId(body.notificationId);
    if (!notificationId) return NextResponse.json({ error: "Missing notification" }, { status: 400 });
    const { error } = await (admin.from("notifications") as any).update({ read_status: true }).eq("id", notificationId).eq("user_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
}
