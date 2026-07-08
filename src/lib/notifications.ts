import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type EmailNotificationType =
  | "welcome"
  | "verify_email"
  | "password_reset"
  | "login_alert"
  | "suspicious_activity"
  | "order_confirmation"
  | "payment_received"
  | "shipping_update"
  | "delivery_confirmation"
  | "refund_confirmation"
  | "seller_live"
  | "auction_starting"
  | "auction_outbid"
  | "auction_won"
  | "giveaway_started"
  | "giveaway_entry_confirmed"
  | "giveaway_won"
  | "platform_announcement"
  | "maintenance_notice";

export async function getEmailPreferences(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("email_preferences").select("*").eq("user_id", userId);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function upsertEmailPreference(userId: string, notificationType: string, enabled: boolean) {
  const admin = createAdminClient();
  const { error } = await admin.from("email_preferences").upsert({ user_id: userId, notification_type: notificationType, enabled } as any, { onConflict: "user_id,notification_type" });
  if (error) throw new Error(error.message);
}

export async function queueEmail(input: { userId?: string | null; recipientEmail: string; templateName: string; emailType: EmailNotificationType; payload?: Record<string, unknown> }) {
  const admin = createAdminClient();
  const { error } = await admin.from("email_queue").insert({
    user_id: input.userId ?? null,
    recipient_email: input.recipientEmail,
    template_name: input.templateName,
    payload: input.payload ?? {},
    status: "queued",
    attempts: 0,
    next_attempt_at: new Date().toISOString(),
  } as any);
  if (error) throw new Error(error.message);
}

export async function logEmailDelivery(input: { userId?: string | null; recipientEmail: string; templateName: string; emailType: EmailNotificationType; status: string; providerMessageId?: string | null; errorMessage?: string | null }) {
  const admin = createAdminClient();
  const { error } = await admin.from("email_logs").insert({
    user_id: input.userId ?? null,
    recipient_email: input.recipientEmail,
    template_name: input.templateName,
    email_type: input.emailType,
    status: input.status,
    provider_message_id: input.providerMessageId ?? null,
    error_message: input.errorMessage ?? null,
    sent_at: input.status === "sent" ? new Date().toISOString() : null,
  } as any);
  if (error) throw new Error(error.message);
}
