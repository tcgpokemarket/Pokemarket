import { createAdminClient } from "@/lib/supabase/admin";

export async function recordPaymentEvent(
  admin: ReturnType<typeof createAdminClient>,
  input: { orderId: string; stripeEventId: string; status: string },
) {
  const { data: existing } = await (admin as any)
    .from("payment_events")
    .select("id")
    .eq("order_id", input.orderId)
    .eq("stripe_event_id", input.stripeEventId)
    .maybeSingle();

  if (existing) {
    return false;
  }

  const { error } = await (admin as any).from("payment_events").insert({
    order_id: input.orderId,
    stripe_event_id: input.stripeEventId,
    status: input.status,
    timestamp: new Date().toISOString(),
  });

  if (error && !String(error.message ?? "").includes("duplicate key")) {
    throw error;
  }

  return true;
}
