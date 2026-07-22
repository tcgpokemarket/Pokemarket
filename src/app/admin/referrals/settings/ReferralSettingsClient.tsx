"use client";

import { useState, useTransition } from "react";
import type { ReferralProgramSettings } from "@/lib/referral-types";

interface Props {
  settings: ReferralProgramSettings;
}

// Only the subset of columns we expose in the UI.
// Field names match the actual DB column names.
interface SettingsFormState {
  enabled: boolean;
  reward_as_pct_of_platform_revenue: number;
  max_reward_per_referral: number;
  max_monthly_rewards_per_referrer: number;
  max_annual_rewards_per_referrer: number;
  max_lifetime_rewards_per_referrer: number;
  min_order_amount: number;
  payout_delay_days: number;
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-200">{label}</label>
      {hint && <p className="mt-0.5 text-xs text-gray-500">{hint}</p>}
      <div className="mt-2">{children}</div>
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  min,
  max,
  step,
  prefix,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  prefix?: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[#111827] px-4 py-2.5">
      {prefix && <span className="text-gray-500">{prefix}</span>}
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step ?? 1}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full bg-transparent text-sm text-white outline-none"
      />
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3">
      <div
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition-colors ${checked ? "bg-yellow-400" : "bg-white/10"}`}
      >
        <div
          className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </div>
      <span className="text-sm text-gray-300">{label}</span>
    </label>
  );
}

export default function ReferralSettingsClient({ settings }: Props) {
  const [form, setForm] = useState<SettingsFormState>({
    enabled: settings.enabled ?? true,
    reward_as_pct_of_platform_revenue: settings.reward_as_pct_of_platform_revenue ?? 5,
    max_reward_per_referral: settings.max_reward_per_referral ?? 25,
    max_monthly_rewards_per_referrer: settings.max_monthly_rewards_per_referrer ?? 100,
    max_annual_rewards_per_referrer: settings.max_annual_rewards_per_referrer ?? 1000,
    max_lifetime_rewards_per_referrer: settings.max_lifetime_rewards_per_referrer ?? 5000,
    min_order_amount: settings.min_order_amount ?? 0,
    payout_delay_days: settings.payout_delay_days ?? 14,
  });
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function set<K extends keyof SettingsFormState>(
    key: K,
    value: SettingsFormState[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    setError(null);
    setSuccess(false);

    if (form.reward_as_pct_of_platform_revenue > 30) {
      setError("Reward percentage cannot exceed 30% of platform revenue.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/referral/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          throw new Error(data.error ?? "Failed to save settings");
        }
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
      <div className="space-y-6">
        {/* Program toggle */}
        <section className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400">Program</h2>
          <Toggle
            checked={form.enabled}
            onChange={(v) => set("enabled", v)}
            label="Program active"
          />
        </section>

        <hr className="border-white/10" />

        {/* Reward structure */}
        <section className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400">Reward structure</h2>

          <Field
            label="Reward % of platform revenue"
            hint="Must be ≤ 30%. The referrer earns this percentage of the platform fee on the referred user's first qualifying order."
          >
            <NumberInput
              value={form.reward_as_pct_of_platform_revenue}
              onChange={(v) => set("reward_as_pct_of_platform_revenue", v)}
              min={0}
              max={30}
              step={0.5}
              prefix="%"
            />
          </Field>

          <Field
            label="Max reward per referral"
            hint="Hard cap in dollars per individual referral event."
          >
            <NumberInput
              value={form.max_reward_per_referral}
              onChange={(v) => set("max_reward_per_referral", v)}
              min={0}
              step={0.5}
              prefix="$"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Monthly cap ($)">
              <NumberInput
                value={form.max_monthly_rewards_per_referrer}
                onChange={(v) => set("max_monthly_rewards_per_referrer", v)}
                min={0}
                prefix="$"
              />
            </Field>
            <Field label="Annual cap ($)">
              <NumberInput
                value={form.max_annual_rewards_per_referrer}
                onChange={(v) => set("max_annual_rewards_per_referrer", v)}
                min={0}
                prefix="$"
              />
            </Field>
            <Field label="Lifetime cap ($)">
              <NumberInput
                value={form.max_lifetime_rewards_per_referrer}
                onChange={(v) => set("max_lifetime_rewards_per_referrer", v)}
                min={0}
                prefix="$"
              />
            </Field>
          </div>
        </section>

        <hr className="border-white/10" />

        {/* Timing + eligibility */}
        <section className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400">Timing & eligibility</h2>

          <Field
            label="Reward hold days"
            hint="Days after order completion before reward becomes payable."
          >
            <NumberInput
              value={form.payout_delay_days}
              onChange={(v) => set("payout_delay_days", v)}
              min={0}
              max={90}
            />
          </Field>

          <Field
            label="Minimum order amount ($)"
            hint="Referred user's qualifying order must be at least this amount."
          >
            <NumberInput
              value={form.min_order_amount}
              onChange={(v) => set("min_order_amount", v)}
              min={0}
              step={0.5}
              prefix="$"
            />
          </Field>
        </section>

        {/* Status messages */}
        {error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-2xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-400">
            Settings saved successfully.
          </div>
        )}

        {/* Save */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            className="rounded-2xl bg-yellow-400 px-8 py-3 text-sm font-bold text-black transition hover:bg-yellow-300 active:scale-95"
          >
            Save settings
          </button>
        </div>
      </div>
    </div>
  );
}
