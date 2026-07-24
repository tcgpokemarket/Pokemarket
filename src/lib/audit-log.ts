export type AuditEventType =
  | "auth.login"
  | "auth.logout"
  | "auth.failed_login"
  | "auth.password_reset"
  | "auth.mfa"
  | "admin.action"
  | "finance.payout"
  | "finance.refund"
  | "finance.escrow"
  | "api.request"
  | "api.denied"
  | "security.alert"
  | "shipping.label"
  | "live.bid"
  | "live.moderation";

export type AuditLogEntry = {
  event_type: AuditEventType;
  actor_id: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  previous_value: unknown;
  new_value: unknown;
  ip_address: string | null;
  user_agent: string | null;
};

export function recordEscrowAuditEvent(entry: Omit<AuditLogEntry, "event_type"> & { action: string }) {
  recordAuditEvent({
    ...entry,
    event_type: "finance.escrow",
  });
}

export type SecurityEventEntry = {
  event_type: string;
  severity?: string;
  actor_id?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  details?: unknown;
};

const auditBuffer: AuditLogEntry[] = [];
const securityBuffer: SecurityEventEntry[] = [];

function canUseDatabase() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

async function writeJson(path: string, body: Record<string, unknown>) {
  if (!canUseDatabase()) return;
  try {
    await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${path}`, {
      method: 'POST',
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(body),
    });
  } catch {}
}

export function recordAuditEvent(entry: AuditLogEntry) {
  auditBuffer.unshift(entry);
  if (auditBuffer.length > 200) {
    auditBuffer.length = 200;
  }
  void writeJson('audit_logs', entry);
}

export function recordSecurityEvent(entry: SecurityEventEntry) {
  securityBuffer.unshift(entry);
  if (securityBuffer.length > 200) {
    securityBuffer.length = 200;
  }
  void writeJson('security_events', entry);
}

export function getRecentAuditEvents() {
  return auditBuffer.slice(0, 100);
}

export function getRecentSecurityEvents() {
  return securityBuffer.slice(0, 100);
}
