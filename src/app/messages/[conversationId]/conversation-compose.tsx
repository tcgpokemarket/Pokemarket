"use client";

import { useState } from "react";

export default function ConversationCompose({ conversationId }: { conversationId: string }) {
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function submit() {
    const trimmed = message.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setStatus(null);

    const response = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "send", conversationId, message: trimmed }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({} as { error?: string }));
      setStatus(payload.error ?? "Unable to send message");
      setSending(false);
      return;
    }

    setMessage("");
    setStatus("Message sent");
    setSending(false);
  }

  return (
    <div className="mt-6 rounded-2xl border border-white/10 bg-[#13131f] p-4">
      <textarea
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        rows={4}
        placeholder="Write a message…"
        className="w-full rounded-xl border border-white/10 bg-[#0f0f1a] px-4 py-3 text-sm text-white outline-none placeholder:text-gray-500"
      />
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="text-sm text-gray-400">{status ?? "Send a reply to continue the conversation."}</div>
        <button onClick={submit} disabled={sending || !message.trim()} className="rounded-xl bg-yellow-400 px-4 py-2 text-sm font-bold text-black disabled:opacity-50">
          {sending ? "Sending…" : "Send"}
        </button>
      </div>
    </div>
  );
}
