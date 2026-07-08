"use client";

import { useState } from "react";

export default function ConversationActions({ conversationId }: { conversationId: string }) {
  const [status, setStatus] = useState<string | null>(null);

  async function call(action: string, body: Record<string, unknown> = {}) {
    setStatus("Saving…");
    const response = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, conversationId, ...body }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({} as { error?: string }));
      setStatus(payload.error ?? "Unable to update conversation");
      return;
    }
    setStatus("Saved");
  }

  return (
    <div className="mt-5 flex flex-wrap gap-3">
      <button onClick={() => call("read")} className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white">Mark read</button>
      <button onClick={() => call("block", { blockedId: prompt("Enter the user ID to block") ?? "" })} className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white">Block user</button>
      <button onClick={() => call("report", { messageId: prompt("Enter the message ID to report") ?? "", reason: prompt("Reason for report") ?? "", details: prompt("Optional details") ?? "" })} className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white">Report message</button>
      <div className="w-full text-sm text-gray-400">{status ?? "Conversation controls"}</div>
    </div>
  );
}
