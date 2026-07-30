"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ConversationRow = {
  id: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  context_type: string | null;
  context_id: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
};

type MemberRow = {
  id: string;
  conversation_id: string;
  user_id: string;
  role: string;
  muted: boolean;
  archived: boolean;
  last_read_at: string | null;
  created_at: string;
  updated_at: string;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  message: string;
  attachment_url: string | null;
  attachment_type: string | null;
  read_status: boolean;
  created_at: string;
  updated_at: string;
};

type ProfileRow = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

type SellerRow = {
  id: string;
  display_name: string;
  storefront_slug: string;
  avatar_url: string | null;
  verified: boolean;
  rating: number;
};

type ConversationView = {
  id: string;
  title: string;
  subtitle: string;
  preview: string;
  lastMessageAt: string | null;
  unreadCount: number;
  otherUserId: string | null;
  otherAvatarUrl: string | null;
  contextLabel: string;
  messages: MessageRow[];
};

function formatTime(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleString();
}

function getLabel(profile?: ProfileRow | null, seller?: SellerRow | null, userId?: string | null) {
  if (seller) return seller.display_name;
  if (profile?.full_name) return profile.full_name;
  if (profile?.username) return `@${profile.username}`;
  return userId ? `User ${userId.slice(0, 8)}` : "Conversation";
}

export default function MessagesPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const shopSlug = searchParams.get("shop")?.trim() ?? "";
  const threadId = searchParams.get("thread")?.trim() ?? "";
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [seller, setSeller] = useState<SellerRow | null>(null);
  const [conversations, setConversations] = useState<ConversationView[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setStatus(null);

      const { data: sessionData } = await supabase.auth.getUser();
      const user = sessionData.user;
      if (!active) return;
      setCurrentUserId(user?.id ?? null);

      if (!user) {
        setLoading(false);
        return;
      }

      const profileQuery = supabase.from("profiles").select("id, username, full_name, avatar_url").eq("id", user.id).maybeSingle<ProfileRow>();
      const sellerQuery = shopSlug
        ? supabase.from("sellers").select("id, display_name, storefront_slug, avatar_url, verified, rating").eq("storefront_slug", shopSlug).maybeSingle<SellerRow>()
        : Promise.resolve({ data: null, error: null } as const);

      const [{ data: profile }, { data: sellerData }] = await Promise.all([profileQuery, sellerQuery]);
      if (!active) return;
      void profile;
      setSeller((sellerData as SellerRow | null) ?? null);

      const { data: memberRows } = await supabase
        .from("conversation_members")
        .select("id, conversation_id, user_id, role, muted, archived, last_read_at, created_at, updated_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100)
        .returns<MemberRow[]>();

      if (!active) return;

      const conversationIds = Array.from(new Set((memberRows ?? []).map((row) => row.conversation_id)));
      const [conversationResult, messageResult, allMemberResult] = await Promise.all([
        conversationIds.length
          ? supabase
              .from("conversations")
              .select("id, last_message_at, last_message_preview, context_type, context_id, is_archived, created_at, updated_at")
              .in("id", conversationIds)
              .order("last_message_at", { ascending: false, nullsFirst: false })
              .returns<ConversationRow[]>()
          : Promise.resolve({ data: [] as ConversationRow[], error: null }),
        conversationIds.length
          ? supabase
              .from("messages")
              .select("id, conversation_id, sender_id, message, attachment_url, attachment_type, read_status, created_at, updated_at")
              .in("conversation_id", conversationIds)
              .order("created_at", { ascending: false })
              .limit(200)
              .returns<MessageRow[]>()
          : Promise.resolve({ data: [] as MessageRow[], error: null }),
        conversationIds.length
          ? supabase
              .from("conversation_members")
              .select("id, conversation_id, user_id, role, muted, archived, last_read_at, created_at, updated_at")
              .in("conversation_id", conversationIds)
              .returns<MemberRow[]>()
          : Promise.resolve({ data: [] as MemberRow[], error: null }),
      ]);

      const conversationRows = conversationResult.data ?? [];
      const messageRows = messageResult.data ?? [];
      const allMemberRows = allMemberResult.data ?? [];
      const otherUserIds = Array.from(new Set(allMemberRows.filter((row) => row.user_id !== user.id).map((row) => row.user_id)));
      const otherProfiles = otherUserIds.length
        ? await supabase.from("profiles").select("id, username, full_name, avatar_url").in("id", otherUserIds).returns<ProfileRow[]>()
        : { data: [] as ProfileRow[], error: null };
      const profileMap = new Map((otherProfiles.data ?? []).map((row) => [row.id, row] as const));

      const conversationsView = conversationRows.map((conversation) => {
        const members = allMemberRows.filter((row) => row.conversation_id === conversation.id);
        const otherMember = members.find((row) => row.user_id !== user.id) ?? null;
        const otherProfile = otherMember ? profileMap.get(otherMember.user_id) ?? null : null;
        const convoMessages = messageRows
          .filter((row) => row.conversation_id === conversation.id)
          .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
        const preview = conversation.last_message_preview ?? convoMessages[0]?.message ?? "No messages yet.";
        const unreadCount = convoMessages.filter((row) => !row.read_status && row.sender_id !== user.id).length;
        const contextLabel = conversation.context_type === "shop" && conversation.context_id
          ? `Shop · ${conversation.context_id}`
          : conversation.context_type === "listing" && conversation.context_id
            ? `Listing · ${conversation.context_id}`
            : conversation.context_type === "live_show" && conversation.context_id
              ? `Live show · ${conversation.context_id}`
              : "Direct message";

        return {
          id: conversation.id,
          title: getLabel(otherProfile, undefined, otherMember?.user_id),
          subtitle: otherProfile?.username ? `@${otherProfile.username}` : otherMember?.user_id ? `Member ${otherMember.user_id.slice(0, 8)}` : contextLabel,
          preview,
          lastMessageAt: conversation.last_message_at,
          unreadCount,
          otherUserId: otherMember?.user_id ?? null,
          otherAvatarUrl: otherProfile?.avatar_url ?? null,
          contextLabel,
          messages: convoMessages.reverse(),
        } satisfies ConversationView;
      });

      const selectedConversation = threadId
        ? conversationsView.find((conversation) => conversation.id === threadId)
        : shopSlug
          ? conversationsView.find((conversation) => conversation.contextLabel === `Shop · ${shopSlug}`)
          : conversationsView[0] ?? null;

      setConversations(conversationsView);
      setSelectedConversationId(selectedConversation?.id ?? null);
      setLoading(false);
    };

    void load();

    return () => {
      active = false;
    };
  }, [shopSlug, supabase, threadId]);

  const activeConversation = conversations.find((conversation) => conversation.id === selectedConversationId) ?? null;
  const selectedSeller = shopSlug ? seller : null;

  const openThread = (conversationId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("thread", conversationId);
    params.delete("shop");
    router.push(`${pathname}?${params.toString()}`);
  };

  const startSellerThread = async () => {
    if (!currentUserId || !selectedSeller || !draft.trim()) return;
    setSending(true);
    setStatus(null);

    try {
      const existing = conversations.find((conversation) => conversation.otherUserId === selectedSeller.id);
      let conversationId = existing?.id ?? null;

      if (!conversationId) {
        const { data: conversation, error: conversationError } = await (supabase as any)
          .from("conversations")
          .insert({
            context_type: "shop",
            context_id: selectedSeller.storefront_slug,
            is_archived: false,
            last_message_preview: draft.trim(),
            last_message_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (conversationError || !conversation?.id) {
          throw new Error(conversationError?.message ?? "Unable to start conversation.");
        }

        conversationId = conversation.id;

        const memberInsert = await (supabase as any).from("conversation_members").insert([
          { conversation_id: conversationId, user_id: currentUserId, role: "buyer", muted: false, archived: false },
          { conversation_id: conversationId, user_id: selectedSeller.id, role: "seller", muted: false, archived: false },
        ]);
        if (memberInsert.error) throw new Error(memberInsert.error.message);
      }

      const messageInsert = await (supabase as any).from("messages").insert({
        conversation_id: conversationId,
        sender_id: currentUserId,
        message: draft.trim(),
        attachment_url: null,
        attachment_type: null,
        context: { shop: selectedSeller.storefront_slug },
        read_status: false,
      });
      if (messageInsert.error) throw new Error(messageInsert.error.message);

      await (supabase as any)
        .from("conversations")
        .update({ last_message_preview: draft.trim(), last_message_at: new Date().toISOString() })
        .eq("id", conversationId);
      setDraft("");
      setStatus("Message sent.");
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to send message.");
    } finally {
      setSending(false);
    }
  };

  const replyToConversation = async () => {
    if (!currentUserId || !activeConversation || !draft.trim()) return;
    setSending(true);
    setStatus(null);

    try {
      const { error } = await (supabase as any).from("messages").insert({
        conversation_id: activeConversation.id,
        sender_id: currentUserId,
        message: draft.trim(),
        attachment_url: null,
        attachment_type: null,
        context: { thread: activeConversation.id },
        read_status: false,
      });
      if (error) throw new Error(error.message);

      await (supabase as any)
        .from("conversations")
        .update({ last_message_preview: draft.trim(), last_message_at: new Date().toISOString() })
        .eq("id", activeConversation.id);
      setDraft("");
      setStatus("Message sent.");
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to send message.");
    } finally {
      setSending(false);
    }
  };

  const canSendToSeller = Boolean(currentUserId && selectedSeller);
  const canReply = Boolean(currentUserId && activeConversation);

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-white">
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-6">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-yellow-400">Messages</p>
            <h1 className="mt-2 text-3xl font-black">Inbox</h1>
            <p className="mt-2 text-sm text-gray-400">Seller conversations and direct replies stay here.</p>
          </div>

          {selectedSeller ? (
            <div className="grid gap-3 rounded-2xl border border-yellow-400/20 bg-yellow-400/5 p-4 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <div className="text-sm font-semibold text-white">{selectedSeller.display_name}</div>
                <div className="text-xs text-gray-400">/{selectedSeller.storefront_slug} · {selectedSeller.verified ? "Verified seller" : "Seller"}</div>
              </div>
              <Link href={`/sellers/${selectedSeller.storefront_slug}`} className="rounded-full border border-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/5">View store</Link>
            </div>
          ) : null}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[360px_1fr]">
          <aside className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-bold">Conversations</h2>
              <span className="text-xs text-gray-400">{conversations.length}</span>
            </div>
            {loading ? (
              <div className="rounded-2xl border border-white/10 bg-[#13131f] p-4 text-sm text-gray-400">Loading inbox...</div>
            ) : conversations.length ? (
              <div className="space-y-2">
                {conversations.map((conversation) => (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => setSelectedConversationId(conversation.id)}
                    className={`w-full rounded-2xl border p-4 text-left transition ${selectedConversationId === conversation.id ? "border-yellow-400/40 bg-yellow-400/10" : "border-white/10 bg-[#13131f] hover:bg-[#171724]"}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-white/10 text-sm font-black text-yellow-400">
                        {conversation.otherAvatarUrl ? <img src={conversation.otherAvatarUrl} alt={conversation.title} className="h-full w-full object-cover" /> : conversation.title[0]?.toUpperCase() ?? "M"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="truncate font-semibold text-white">{conversation.title}</div>
                          {conversation.unreadCount ? <span className="rounded-full bg-yellow-400 px-2 py-0.5 text-[11px] font-black text-black">{conversation.unreadCount}</span> : null}
                        </div>
                        <div className="mt-1 text-xs text-gray-400">{conversation.subtitle}</div>
                        <div className="mt-2 line-clamp-2 text-sm text-gray-300">{conversation.preview}</div>
                        <div className="mt-2 text-[11px] uppercase tracking-[0.2em] text-gray-500">{conversation.contextLabel} · {formatTime(conversation.lastMessageAt) || "No activity yet"}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-[#13131f] p-5 text-sm text-gray-400">
                <p>No conversations yet.</p>
                <p className="mt-2 text-xs text-gray-500">Open a seller page to start one.</p>
              </div>
            )}
          </aside>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6">
            {activeConversation ? (
              <div className="flex h-full min-h-[540px] flex-col">
                <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
                  <div>
                    <div className="text-lg font-bold text-white">{activeConversation.title}</div>
                    <div className="text-sm text-gray-400">{activeConversation.subtitle}</div>
                  </div>
                  <div className="text-right text-xs uppercase tracking-[0.2em] text-gray-500">{activeConversation.contextLabel}</div>
                </div>

                <div className="flex-1 space-y-3 overflow-auto py-4">
                  {activeConversation.messages.length ? (
                    activeConversation.messages.map((message) => {
                      const mine = message.sender_id === currentUserId;
                      return (
                        <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-6 ${mine ? "bg-yellow-400 text-black" : "bg-[#13131f] text-white"}`}>
                            <div>{message.message}</div>
                            <div className={`mt-2 text-[11px] ${mine ? "text-black/70" : "text-gray-400"}`}>{formatTime(message.created_at)}</div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-2xl border border-white/10 bg-[#13131f] p-6 text-sm text-gray-400">No messages in this conversation yet.</div>
                  )}
                </div>

                <div className="border-t border-white/10 pt-4">
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    rows={4}
                    placeholder={selectedSeller ? `Message ${selectedSeller.display_name}` : "Write a reply"}
                    className="w-full rounded-2xl border border-white/10 bg-[#13131f] px-4 py-3 text-sm text-white outline-none transition placeholder:text-gray-500 focus:border-yellow-400/50"
                  />
                  {status ? <p className="mt-2 text-xs text-gray-400">{status}</p> : null}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs text-gray-500">Messages are stored in your account inbox.</div>
                    <button
                      type="button"
                      onClick={selectedSeller ? startSellerThread : replyToConversation}
                      disabled={sending || !(selectedSeller ? canSendToSeller : canReply)}
                      className="rounded-full bg-yellow-400 px-5 py-2.5 text-sm font-bold text-black transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {sending ? "Sending..." : selectedSeller ? "Send message" : "Reply"}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[540px] items-center justify-center rounded-2xl border border-white/10 bg-[#13131f] p-8 text-center">
                <div className="max-w-md">
                  <h2 className="text-2xl font-black">Select a conversation</h2>
                  <p className="mt-3 text-sm leading-6 text-gray-400">Choose a thread from the inbox or open a seller storefront to start a new conversation.</p>
                  <div className="mt-6 flex flex-wrap justify-center gap-3">
                    <Link href="/listings" className="rounded-full border border-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/5">Browse listings</Link>
                    <Link href="/dashboard" className="rounded-full bg-yellow-400 px-4 py-2 text-sm font-bold text-black transition hover:bg-yellow-300">Open dashboard</Link>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
