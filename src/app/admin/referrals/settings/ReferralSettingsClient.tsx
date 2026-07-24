"use client";

import { useState, useTransition } from "react";
import type { ReferralProgramSettings } from "@/lib/referral-types";

interface Props {
  settings: ReferralProgramSettings;
}

interface SettingsFormState {
  enabled: boolean;
  paused: boolean;
  reward_amount: number;
  required_successful_volume: number;
  max_lifetime_commission_share_percent: number;
  payout_delay_days: number;
  campaign_starts_at: string;
  campaign_ends_at: string;
  requires_verified_account: boolean;
  requires_first_successful_order: boolean;
  requires_no_open_disputes: boolean;
  requires_no_chargebacks: boolean;
  fraud_score_block_threshold: number;
  fraud_score_review_threshold: number;
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

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-2xl border border-white/10 bg-[#111827] px-4 py-2.5 text-sm text-white outline-none placeholder:text-gray-500"
    />
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
    paused: settings.paused ?? false,
    reward_amount: settings.reward_amount ?? 5,
    required_successful_volume: settings.required_successful_volume ?? 200,
    max_lifetime_commission_share_percent: settings.max_lifetime_commission_share_percent ?? 20,
    payout_delay_days: settings.payout_delay_days ?? 14,
    campaign_starts_at: settings.campaign_starts_at ?? "",
    campaign_ends_at: settings.campaign_ends_at ?? "",
    requires_verified_account: settings.requires_verified_account ?? true,
    requires_first_successful_order: settings.requires_first_successful_order ?? true,
    requires_no_open_disputes: settings.requires_no_open_disputes ?? true,
    requires_no_chargebacks: settings.requires_no_chargebacks ?? true,
    fraud_score_block_threshold: settings.fraud_score_block_threshold ?? 70,
    fraud_score_review_threshold: settings.fraud_score_review_threshold ?? 40,
  });
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function set<K extends keyof SettingsFormState>(key: K, value: SettingsFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    setError(null);
    setSuccess(false);

    if (form.max_lifetime_commission_share_percent > 20) {
      setError("Lifetime payout share cannot exceed 20% of commission earned.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/referral/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...form,
            campaign_starts_at: form.campaign_starts_at || null,
            campaign_ends_at: form.campaign_ends_at || null,
          }),
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
        <section className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400">Program</h2>
          <Toggle checked={form.enabled} onChange={(v) => set("enabled", v)} label="Program active" />
          <Toggle checked={form.paused} onChange={(v) => set("paused", v)} label="Pause all payouts" />
        </section>

        <hr className="border-white/10" />

        <section className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400">Reward structure</h2>

          <Field
            label="Reward amount"
            hint="Fixed bonus paid only after the referred account clears the required successful volume and commission cap."
          >
            <NumberInput value={form.reward_amount} onChange={(v) => set("reward_amount", v)} min={0} step={0.5} prefix="$" />
          </Field>

          <Field
            label="Required successful volume"
            hint="The referred account must complete this amount in successful marketplace activity before the reward is eligible."
          >
            <NumberInput
              value={form.required_successful_volume}
              onChange={(v) => set("required_successful_volume", v)}
              min={0}
              step={1}
              prefix="$"
            />
          </Field>

          <Field
            label="Max lifetime payout share"
            hint="The total lifetime payout for one referred account cannot exceed this share of commission earned."
          >
            <NumberInput
              value={form.max_lifetime_commission_share_percent}
              onChange={(v) => set("max_lifetime_commission_share_percent", v)}
              min={0}
              max={20}
              step={0.5}
              prefix="%"
            />
          </Field>
        </section>

        <hr className="border-white/10" />

        <section className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400">Timing & eligibility</h2>

          <Field label="Reward hold days" hint="Days after qualification before payout becomes available.">
            <NumberInput value={form.payout_delay_days} onChange={(v) => set("payout_delay_days", v)} min={0} max={90} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Campaign starts">
              <TextInput value={form.campaign_starts_at} onChange={(v) => set("campaign_starts_at", v)} placeholder="YYYY-MM-DD or ISO date" />
            </Field>
            <Field label="Campaign ends">
              <TextInput value={form.campaign_ends_at} onChange={(v) => set("campaign_ends_at", v)} placeholder="YYYY-MM-DD or ISO date" />
            </Field>
          </div>

          <Field label="Fraud block threshold" hint="Scores at or above this value are automatically blocked.">
            <NumberInput value={form.fraud_score_block_threshold} onChange={(v) => set("fraud_score_block_threshold", v)} min={0} max={100} />
          </Field>

          <Field label="Fraud review threshold" hint="Scores at or above this value are flagged for manual review.">
            <NumberInput value={form.fraud_score_review_threshold} onChange={(v) => set("fraud_score_review_threshold", v)} min={0} max={100} />
          </Field>
        </section>

        <hr className="border-white/10" />

        <section className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400">Eligibility rules</h2>
          <Toggle checked={form.requires_verified_account} onChange={(v) => set("requires_verified_account", v)} label="Require verified account" />
          <Toggle checked={form.requires_first_successful_order} onChange={(v) => set("requires_first_successful_order", v)} label="Require first successful order" />
          <Toggle checked={form.requires_no_open_disputes} onChange={(v) => set("requires_no_open_disputes", v)} label="Require no open disputes" />
          <Toggle checked={form.requires_no_chargebacks} onChange={(v) => set("requires_no_chargebacks", v)} label="Require no chargebacks" />
        </section>

        {error && <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">{error}</div>}
        {success && <div className="rounded-2xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-400">Settings saved successfully.</div>}

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
