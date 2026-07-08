import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type SupportRole =
  | "customer_support"
  | "seller_support"
  | "order_support"
  | "live_auction_support"
  | "marketplace_safety"
  | "human_admin";

export type SupportCategory =
  | "buyer_question"
  | "seller_question"
  | "order_issue"
  | "shipping_issue"
  | "refund_request"
  | "live_auction_question"
  | "giveaway_question"
  | "account_issue"
  | "fraud_report"
  | "payment_dispute"
  | "legal_complaint"
  | "general_question";

export type SupportTicketStatus = "open" | "ai_handling" | "waiting_for_user" | "escalated" | "resolved";

function formatTicketNumber(id: string) {
  return `TK-${id.slice(0, 8).toUpperCase()}`;
}

export async function createSupportTicket(input: {
  userId: string;
  category: SupportCategory;
  issueSummary: string;
  priority?: string;
  orderId?: string | null;
  listingId?: string | null;
  sellerId?: string | null;
  conversationId?: string | null;
  assignedAiAgent?: SupportRole | null;
}) {
  const admin = createAdminClient();
  const { data, error } = await (admin as any)
    .from("support_tickets")
    .insert({
      ticket_number: crypto.randomUUID(),
      user_id: input.userId,
      category: input.category,
      priority: input.priority ?? "normal",
      status: "open",
      assigned_ai_agent: input.assignedAiAgent ?? null,
      order_id: input.orderId ?? null,
      listing_id: input.listingId ?? null,
      seller_id: input.sellerId ?? null,
      conversation_id: input.conversationId ?? null,
      issue_summary: input.issueSummary,
      conversation_history: [],
    })
    .select("id, ticket_number")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Unable to create support ticket");
  const ticket = data as { id: string; ticket_number: string };
  await (admin as any).from("support_tickets").update({ ticket_number: formatTicketNumber(ticket.id) }).eq("id", ticket.id);
  return { id: ticket.id, ticketNumber: formatTicketNumber(ticket.id) };
}

export function routeSupportAgent(category: SupportCategory): SupportRole {
  if (["seller_question"].includes(category)) return "seller_support";
  if (["order_issue", "shipping_issue", "refund_request"].includes(category)) return "order_support";
  if (["live_auction_question", "giveaway_question"].includes(category)) return "live_auction_support";
  if (["fraud_report", "payment_dispute", "legal_complaint"].includes(category)) return "marketplace_safety";
  return "customer_support";
}

export function shouldEscalateSupport(category: SupportCategory, priority: string, summary: string) {
  const text = `${category} ${priority} ${summary}`.toLowerCase();
  return (
    ["payment_dispute", "legal_complaint", "fraud_report"].includes(category) ||
    text.includes("chargeback") ||
    text.includes("ban") ||
    text.includes("refund") ||
    text.includes("fraud") ||
    text.includes("legal") ||
    priority === "high" ||
    priority === "urgent"
  );
}

export async function addSupportResponse(input: {
  ticketId: string;
  assistantRole: SupportRole;
  responseText: string;
  policyNotes?: string | null;
  needsHuman?: boolean;
}) {
  const admin = createAdminClient();
  const { error } = await (admin as any).from("support_ai_responses").insert({
    ticket_id: input.ticketId,
    assistant_role: input.assistantRole,
    response_text: input.responseText,
    policy_notes: input.policyNotes ?? null,
    needs_human: input.needsHuman ?? false,
  });
  if (error) throw new Error(error.message);
}

export async function updateSupportTicketStatus(ticketId: string, status: SupportTicketStatus, resolutionNotes?: string) {
  const admin = createAdminClient();
  const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === "escalated") updates.escalated_at = new Date().toISOString();
  if (status === "resolved") updates.resolved_at = new Date().toISOString();
  if (resolutionNotes) updates.resolution_notes = resolutionNotes;
  const { error } = await (admin as any).from("support_tickets").update(updates).eq("id", ticketId);
  if (error) throw new Error(error.message);
}

export async function appendSupportTicketEvent(ticketId: string, eventType: string, eventData: Record<string, unknown>) {
  const admin = createAdminClient();
  const { error } = await (admin as any).from("support_ticket_events").insert({
    ticket_id: ticketId,
    event_type: eventType,
    event_data: eventData,
  });
  if (error) throw new Error(error.message);
}

export async function getSupportKnowledgeBase() {
  const admin = createAdminClient();
  const { data, error } = await (admin as any)
    .from("support_knowledge_sources")
    .select("source_type, source_name, source_url, content_summary, active")
    .eq("active", true)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getSupportTickets(status?: string) {
  const admin = createAdminClient();
  let request = (admin as any)
    .from("support_tickets")
    .select("id, ticket_number, user_id, order_id, listing_id, seller_id, conversation_id, category, priority, status, assigned_ai_agent, assigned_human_agent, issue_summary, conversation_history, resolution_notes, escalated_at, resolved_at, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (status) request = request.eq("status", status);
  const { data, error } = await request;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getSupportTicketById(ticketId: string) {
  const admin = createAdminClient();
  const { data, error } = await (admin as any)
    .from("support_tickets")
    .select("id, ticket_number, user_id, order_id, listing_id, seller_id, conversation_id, category, priority, status, assigned_ai_agent, assigned_human_agent, issue_summary, conversation_history, resolution_notes, escalated_at, resolved_at, created_at, updated_at")
    .eq("id", ticketId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ?? null;
}

export async function getSupportAgentGreeting(role: SupportRole, category: SupportCategory, summary: string) {
  const prompts: Record<SupportRole, string> = {
    customer_support: "help the buyer answer common marketplace questions and guide them to checkout or account help",
    seller_support: "help the seller with listings, fees, payouts, and seller tools",
    order_support: "help with order status, shipping, tracking, and refund process guidance",
    live_auction_support: "help with auction rules, bidding, giveaways, and live show basics",
    marketplace_safety: "help identify scams, route disputes, and explain safety next steps",
    human_admin: "summarize the issue for a human moderator",
  };

  const base = prompts[role];
  const escalation = shouldEscalateSupport(category, "normal", summary)
    ? "This issue should be escalated to human support for review."
    : "This issue can be handled by the AI support workflow.";

  return `${base}. ${escalation}`;
}

export async function getSupportStats() {
  const admin = createAdminClient();
  const [tickets, escalated, resolved] = await Promise.all([
    (admin as any).from("support_tickets").select("id", { count: "exact", head: true }),
    (admin as any).from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "escalated"),
    (admin as any).from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "resolved"),
  ]);

  return {
    total: tickets.count ?? 0,
    escalated: escalated.count ?? 0,
    resolved: resolved.count ?? 0,
  };
}
