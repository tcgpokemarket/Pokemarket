"use client";

import { useMemo, useState } from "react";

export default function ProfileActions({ userId }: { userId: string }) {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFriend, setIsFriend] = useState(false);

  const followLabel = useMemo(() => (isFollowing ? "Following" : "Follow"), [isFollowing]);
  const friendLabel = useMemo(() => (isFriend ? "Friends" : "Add Friend"), [isFriend]);

  async function run(action: string, extra: Record<string, unknown> = {}) {
    setBusy(action);
    setStatus(null);
    const response = await fetch(`/api/social/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserId: userId, ...extra }),
    });
    const payload = await response.json().catch(() => ({} as { error?: string }));
    if (!response.ok) {
      setStatus(payload.error ?? "Unable to update social settings");
      setBusy(null);
      return;
    }

    if (action === "follow") setIsFollowing(true);
    if (action === "unfollow") setIsFollowing(false);
    if (action === "friend-request") setIsFriend(false);
    if (action === "friend-respond" && extra.status === "accepted") setIsFriend(true);
    if (action === "block") {
      setIsFollowing(false);
      setIsFriend(false);
    }

    setStatus("Saved");
    setBusy(null);
  }

  return (
    <div>
      <div className="mt-6 flex flex-wrap gap-3 text-sm">
        <button onClick={() => run(isFollowing ? "unfollow" : "follow")} disabled={busy !== null} className="rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black disabled:opacity-60">
          {followLabel}
        </button>
        <button onClick={() => run("friend-request")} disabled={busy !== null || isFriend} className="rounded-xl border border-white/15 px-4 py-2 font-semibold text-white disabled:opacity-60">
          {friendLabel}
        </button>
        <button onClick={() => run("block")} disabled={busy !== null} className="rounded-xl border border-white/15 px-4 py-2 font-semibold text-white disabled:opacity-60">Block</button>
      </div>
      <div className="mt-3 min-h-5 text-sm text-gray-400">{busy ? "Updating…" : status ?? "Manage follow, friend, and block status."}</div>
    </div>
  );
}
