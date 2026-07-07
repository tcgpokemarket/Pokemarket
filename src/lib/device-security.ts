export type DeviceSessionRecord = {
  user_id: string;
  device_name: string | null;
  device_hash: string | null;
  ip_address: string | null;
  user_agent: string | null;
  last_seen_at: string;
  active: boolean;
  created_at: string;
};

const sessions: DeviceSessionRecord[] = [];

function canUseDatabase() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

async function writeSession(entry: DeviceSessionRecord) {
  if (!canUseDatabase()) return;
  try {
    await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/device_sessions`, {
      method: 'POST',
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(entry),
    });
  } catch {}
}

export function recordDeviceSession(entry: Omit<DeviceSessionRecord, "created_at"> & { created_at?: string }) {
  const created_at = entry.created_at ?? new Date().toISOString();
  const current = sessions.findIndex((session) => session.user_id === entry.user_id && session.device_hash === entry.device_hash);
  const record: DeviceSessionRecord = { ...entry, created_at };
  if (current >= 0) {
    sessions[current] = record;
  } else {
    sessions.unshift(record);
  }
  if (sessions.length > 100) {
    sessions.length = 100;
  }
  void writeSession(record);
  return record;
}

export function getRecentDeviceSessions() {
  return sessions.slice(0, 50);
}
