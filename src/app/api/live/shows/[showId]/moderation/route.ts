import { NextResponse } from "next/server";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getActionType(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getTargetUserId(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function getHostAccess(showId: string, userId: string) {
  const admin = createAdminClient();
  const { data: show, error } = await (admin as any)
    .from("live_shows")
    .select("id, seller_id, host_permissions")
    .eq("id", showId)
    .maybeSingle();

  if (error) return { show: null, canHost: false, error };
  if (!show) return { show: null, canHost: false, error: new Error("Show not found.") };

  const permissions = Array.isArray(show.host_permissions) ? show.host_permissions : [];
  const canHost = show.seller_id === userId || permissions.includes("host");
  return { show, canHost, error: null };
}

export async function GET(_: Request, { params }: { params: Promise<{ showId: string }> }) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { showId } = await params;
  const admin = createAdminClient();
  const access = await getHostAccess(showId, user.id);
  if (access.error) return NextResponse.json({ error: access.error.message }, { status: 400 });
  if (!access.show) return NextResponse.json({ error: "Show not found." }, { status: 404 });
  if (!access.canHost) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [{ data: actions, error: actionsError }, { data: history, error: historyError }] = await Promise.all([
    (admin as any)
      .from("live_show_moderation_actions")
      .select("id, show_id, target_user_id, target_username, action_type, reason, active, moderator_id, metadata, created_at, updated_at, restored_at, restored_by")
      .eq("show_id", showId)
      .order("updated_at", { ascending: false })
      .limit(100),
    (admin as any)
      .from("live_show_moderation_history")
      .select("id, show_id, action_id, actor_id, target_user_id, target_username, action_type, event_type, reason, details, created_at")
      .eq("show_id", showId)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  if (actionsError) return NextResponse.json({ error: actionsError.message }, { status: 500 });
  if (historyError) return NextResponse.json({ error: historyError.message }, { status: 500 });

  const users = Object.fromEntries((actions ?? []).map((row: any) => [row.target_user_id, row.target_username ?? null]));
  return NextResponse.json({ actions: actions ?? [], history: history ?? [], users });
}

export async function POST(request: Request, { params }: { params: Promise<{ showId: string }> }) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { showId } = await params;
  const body = await request.json().catch(() => ({}));
  const actionType = getActionType(body.actionType);
  const targetUserId = getTargetUserId(body.targetUserId);
  const targetUsername = typeof body.targetUsername === "string" && body.targetUsername.trim() ? body.targetUsername.trim() : null;
  const reason = typeof body.reason === "string" && body.reason.trim() ? body.reason.trim() : null;

  if (!actionType || !targetUserId) {
    return NextResponse.json({ error: "Action type and target user are required." }, { status: 400 });
  }

  if (!["remove_bidder", "mute_user", "ban_user"].includes(actionType)) {
    return NextResponse.json({ error: "Unsupported moderation action." }, { status: 400 });
  }

  const admin = createAdminClient();
  const access = await getHostAccess(showId, user.id);
  if (access.error) return NextResponse.json({ error: access.error.message }, { status: 400 });
  if (!access.show) return NextResponse.json({ error: "Show not found." }, { status: 404 });
  if (!access.canHost) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const now = new Date().toISOString();
  const metadata = { source: "live-host-panel", reason };

  const { data: existingAction, error: existingError } = await (admin as any)
    .from("live_show_moderation_actions")
    .select("id, active")
    .eq("show_id", showId)
    .eq("target_user_id", targetUserId)
    .eq("action_type", actionType)
    .maybeSingle();

  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });

  let actionId = existingAction?.id ?? null;

  if (existingAction) {
    const { error: updateError } = await (admin as any)
      .from("live_show_moderation_actions")
      .update({
        active: true,
        moderator_id: user.id,
        target_username: targetUsername,
        reason,
        metadata,
        updated_at: now,
        restored_at: null,
        restored_by: null,
      })
      .eq("id", existingAction.id);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });
  } else {
    const { data: insertedAction, error: insertError } = await (admin as any)
      .from("live_show_moderation_actions")
      .insert({
        show_id: showId,
        target_user_id: targetUserId,
        target_username: targetUsername,
        action_type: actionType,
        reason,
        active: true,
        moderator_id: user.id,
        metadata,
        updated_at: now,
      })
      .select("id")
      .maybeSingle();

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 });
    actionId = insertedAction?.id ?? null;
  }

  await (admin as any).from("live_show_moderation_history").insert({
    show_id: showId,
    action_id: actionId,
    actor_id: user.id,
    target_user_id: targetUserId,
    target_username: targetUsername,
    action_type: actionType,
    event_type: "moderation_applied",
    reason,
    details: metadata,
  });

  if (actionType === "remove_bidder") {
    await (admin as any).from("live_bids").delete().eq("show_id", showId).eq("bidder_id", targetUserId);
  }

  return NextResponse.json({ ok: true, message: `${actionType.replaceAll("_", " ")} saved.` });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ showId: string }> }) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { showId } = await params;
  const body = await request.json().catch(() => ({}));
  const actionId = typeof body.actionId === "string" ? body.actionId.trim() : "";

  if (!actionId) {
    return NextResponse.json({ error: "Action id is required." }, { status: 400 });
  }

  const admin = createAdminClient();
  const access = await getHostAccess(showId, user.id);
  if (access.error) return NextResponse.json({ error: access.error.message }, { status: 400 });
  if (!access.show) return NextResponse.json({ error: "Show not found." }, { status: 404 });
  if (!access.canHost) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const now = new Date().toISOString();
  const { data: action, error: actionError } = await (admin as any)
    .from("live_show_moderation_actions")
    .select("id, target_user_id, target_username, action_type")
    .eq("id", actionId)
    .eq("show_id", showId)
    .maybeSingle();

  if (actionError) return NextResponse.json({ error: actionError.message }, { status: 500 });
  if (!action) return NextResponse.json({ error: "Moderation action not found." }, { status: 404 });

  const { error: updateError } = await (admin as any)
    .from("live_show_moderation_actions")
    .update({ active: false, restored_at: now, restored_by: user.id, updated_at: now })
    .eq("id", action.id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });

  await (admin as any).from("live_show_moderation_history").insert({
    show_id: showId,
    action_id: action.id,
    actor_id: user.id,
    target_user_id: action.target_user_id,
    target_username: action.target_username,
    action_type: action.action_type,
    event_type: "moderation_restored",
    reason: null,
    details: { restoredAt: now },
  });

  return NextResponse.json({ ok: true, message: "Moderation restored." });
}
