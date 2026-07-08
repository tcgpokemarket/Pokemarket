"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { uploadImageFile } from "@/lib/uploads";

export default function ConversationCompose({ conversationId }: { conversationId: string }) {
  const [message, setMessage] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [attachmentType, setAttachmentType] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function handleAttachmentUpload(file: File | null) {
    if (!file || uploading) return;
    setUploading(true);
    setStatus(null);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Sign in to upload attachments.");

      const uploaded = await uploadImageFile({ supabase, target: "message", ownerId: user.id, file });
      setAttachmentUrl(uploaded.publicUrl);
      setAttachmentType(file.type);
      setStatus("Attachment added");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to upload attachment");
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    const trimmed = message.trim();
    if ((!trimmed && !attachmentUrl) || sending) return;
    setSending(true);
    setStatus(null);

    const response = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "send", conversationId, message: trimmed || "[attachment]", attachmentUrl, attachmentType }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({} as { error?: string }));
      setStatus(payload.error ?? "Unable to send message");
      setSending(false);
      return;
    }

    setMessage("");
    setAttachmentUrl(null);
    setAttachmentType(null);
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
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <label className="cursor-pointer rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:border-yellow-400/60">
          {uploading ? "Uploading…" : attachmentUrl ? "Replace attachment" : "Add attachment"}
          <input type="file" accept="image/*" className="hidden" onChange={(event) => handleAttachmentUpload(event.target.files?.[0] ?? null)} />
        </label>
        <div className="text-sm text-gray-400">{attachmentUrl ? "Attachment ready" : status ?? "Send a reply to continue the conversation."}</div>
        <button onClick={submit} disabled={sending || uploading || (!message.trim() && !attachmentUrl)} className="rounded-xl bg-yellow-400 px-4 py-2 text-sm font-bold text-black disabled:opacity-50">
          {sending ? "Sending…" : "Send"}
        </button>
      </div>
    </div>
  );
}
