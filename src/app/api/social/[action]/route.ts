import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const validActions = new Set(["follow", "unfollow", "friend-request", "friend-respond", "block", "unblock", "mark-notification-read"]);

export async function POST(req: Request, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  if (!validActions.has(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const supabase = await createClient();
  const admin = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({} as Record<string, string>));
  const targetUserId = body.targetUserId ?? body.userId ?? body.followingId;
  if (action !== "mark-notification-read" && !targetUserId) {
    return NextResponse.json({ error: "Missing target user" }, { status: 400 });
  }

  if (action === "follow") {
    const { error } = await admin.from("follows").insert({ follower_id: user.id, following_id: targetUserId } as any);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await admin.from("notifications").insert({ user_id: targetUserId, type: "follow_received", related_user: user.id, related_content: { followerId: user.id } } as any);
    return NextResponse.json({ ok: true });
  }

  if (action === "unfollow") {
    const { error } = await admin.from("follows").delete().eq("follower_id", user.id).eq("following_id", targetUserId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "friend-request") {
    const { error } = await admin.from("friendships").insert({ requester_id: user.id, receiver_id: targetUserId, status: "pending" } as any);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await admin.from("notifications").insert({ user_id: targetUserId, type: "friend_request_received", related_user: user.id, related_content: { requesterId: user.id } } as any);
    return NextResponse.json({ ok: true });
  }

  if (action === "friend-respond") {
    const status = body.status === "accepted" ? "accepted" : body.status === "blocked" ? "blocked" : "pending";
    if (status === "pending") {
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
    const { error } = await admin.from("blocks").insert({ blocker_id: user.id, blocked_id: targetUserId } as any);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "unblock") {
    const { error } = await admin.from("blocks").delete().eq("blocker_id", user.id).eq("blocked_id", targetUserId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "mark-notification-read") {
    const notificationId = body.notificationId;
    if (!notificationId) return NextResponse.json({ error: "Missing notification" }, { status: 400 });
    const { error } = await (admin as any).from("notifications").update({ read_status: true }).eq("id", notificationId).eq("user_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
}
