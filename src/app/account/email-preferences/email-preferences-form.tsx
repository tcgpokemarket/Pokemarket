"use client";

import { useMemo, useState } from "react";

const options = [
  "marketing",
  "live_alerts",
  "seller_updates",
  "auction_alerts",
  "giveaway_alerts",
  "community_notifications",
];

type Props = {
  initialPreferences: Array<{ notification_type: string; enabled: boolean }>;
};

export default function EmailPreferencesForm({ initialPreferences }: Props) {
  const [saved, setSaved] = useState<Record<string, boolean>>(
    Object.fromEntries(initialPreferences.map((row) => [row.notification_type, row.enabled]))
  );
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const enabledDefaults = useMemo(() => new Map(initialPreferences.map((row) => [row.notification_type, row.enabled])), [initialPreferences]);

  async function updatePreference(notificationType: string, enabled: boolean) {
    setSaving(notificationType);
    setError(null);
    const response = await fetch("/api/email/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationType, enabled }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({} as { error?: string }));
      setError(payload.error ?? "Unable to save preference");
      setSaving(null);
      return;
    }

    setSaved((current) => ({ ...current, [notificationType]: enabled }));
    setSaving(null);
  }

  return (
    <div>
      <div className="mt-6 grid gap-3">
        {options.map((option) => {
          const checked = saved[option] ?? enabledDefaults.get(option) ?? true;
          return (
            <label key={option} className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#13131f] px-4 py-3 text-sm">
              <span className="capitalize text-white">{option.replace(/_/g, " ")}</span>
              <input
                type="checkbox"
                checked={checked}
                onChange={(event) => updatePreference(option, event.target.checked)}
                disabled={saving === option}
                className="h-5 w-5 rounded border-white/20 bg-transparent text-yellow-400"
              />
            </label>
          );
        })}
      </div>
      <div className="mt-4 min-h-5 text-sm text-gray-400">{saving ? "Saving…" : error ?? "Changes save instantly."}</div>
    </div>
  );
}
