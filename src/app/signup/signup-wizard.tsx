"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const STEP_TITLES = ["Account", "Type", "Profile", "Review"] as const;

type AccountType = "buyer" | "seller";

type FormState = {
  fullName: string;
  email: string;
  password: string;
  accountType: AccountType | "";
  username: string;
  sellerState: string;
  referralCode: string;
  agreeToTerms: boolean;
};

type FieldErrors = Partial<Record<keyof FormState, string>> & { auth?: string; submit?: string };

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
      <path fill="#EA4335" d="M12 9.5v5h6.9c-.3 1.8-2 5.3-6.9 5.3A7.8 7.8 0 1 1 12 4.2c2.2 0 3.7.9 4.6 1.8l3.1-3A11.8 11.8 0 0 0 12 0C5.4 0 .1 5.4.1 12S5.4 24 12 24c6.8 0 11.3-4.7 11.3-11.3 0-.8-.1-1.4-.2-2H12Z" />
      <path fill="#4285F4" d="M23.3 12.7c0-.7-.1-1.3-.2-2H12v4.1h6.3c-.3 1.5-1.1 2.9-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.7Z" />
      <path fill="#FBBC05" d="m5.6 14.3-.8.6-3 2.4A12 12 0 0 0 12 24c3.4 0 6.2-1.1 8.3-3l-3.7-2.9c-1 .7-2.3 1.2-4.6 1.2-4 0-7.4-2.7-8.5-6.4Z" />
      <path fill="#34A853" d="M12 24c3.4 0 6.2-1.1 8.3-3l-3.7-2.9c-1 .7-2.3 1.2-4.6 1.2-4 0-7.4-2.7-8.5-6.4l-3.3 2.5C2.7 20.7 7 24 12 24Z" />
    </svg>
  );
}

function Spinner() {
  return <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black" />;
}

function getSafeRedirect(value: string | null) {
  if (!value || !value.startsWith("/")) return "/dashboard";
  if (value.startsWith("/auth") || value === "/login" || value === "/signup") return "/dashboard";
  return value;
}

function getPasswordStrength(password: string) {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return score;
}

function getStrengthLabel(score: number) {
  if (score <= 1) return { label: "Weak", width: "25%", color: "bg-red-500" };
  if (score === 2) return { label: "Fair", width: "40%", color: "bg-orange-400" };
  if (score === 3) return { label: "Good", width: "65%", color: "bg-yellow-400" };
  if (score === 4) return { label: "Strong", width: "85%", color: "bg-emerald-400" };
  return { label: "Excellent", width: "100%", color: "bg-emerald-300" };
}

function normalizeUsername(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 20);
}

function SpinnerButton({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Spinner />
      {label}
    </span>
  );
}

export default function SignupWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const referralCode = useMemo(() => searchParams.get("ref") ?? searchParams.get("referral_code") ?? "", [searchParams]);
  const redirectTo = useMemo(() => getSafeRedirect(searchParams.get("redirectTo")), [searchParams]);
  const [step, setStep] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [progress, setProgress] = useState("Ready to create your account");
  const [form, setForm] = useState<FormState>({
    fullName: "",
    email: "",
    password: "",
    accountType: "",
    username: "",
    sellerState: "",
    referralCode,
    agreeToTerms: false,
  });

  useEffect(() => {
    setForm((current) => (current.referralCode === referralCode ? current : { ...current, referralCode }));
  }, [referralCode]);

  useEffect(() => {
    const client = createClient();
    client.auth.getUser().then(({ data: { user } }) => {
      if (user) router.replace(redirectTo);
    });
  }, [redirectTo, router]);

  const passwordStrength = useMemo(() => getPasswordStrength(form.password), [form.password]);
  const strength = getStrengthLabel(passwordStrength);

  const setValue = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
  };

  const validateStep = (currentStep: number) => {
    const errors: FieldErrors = {};

    if (currentStep === 0) {
      if (!form.fullName.trim()) errors.fullName = "Enter your full name.";
      if (!form.email.trim()) errors.email = "Enter your email address.";
      else if (!/^\S+@\S+\.\S+$/.test(form.email)) errors.email = "Enter a valid email address.";
      if (!form.password) errors.password = "Create a password.";
      else if (form.password.length < 8) errors.password = "Use at least 8 characters.";
    }

    if (currentStep === 1 && !form.accountType) errors.accountType = "Choose buyer or seller.";

    if (currentStep === 2) {
      if (!form.username.trim()) errors.username = "Choose a username.";
      if (form.accountType === "seller" && !form.sellerState.trim()) errors.sellerState = "Enter your two-letter state code.";
    }

    if (currentStep === 3 && !form.agreeToTerms) errors.agreeToTerms = "You must agree to continue.";

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const nextStep = () => {
    if (validateStep(step)) setStep((current) => Math.min(current + 1, STEP_TITLES.length - 1));
  };

  const previousStep = () => setStep((current) => Math.max(current - 1, 0));

  const handleGoogleSignIn = async () => {
    setFieldErrors({});
    setGoogleLoading(true);
    setProgress("Connecting Google account...");

    try {
      const client = createClient();
      const { error } = await client.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?redirectTo=${encodeURIComponent(redirectTo)}`,
          queryParams: { prompt: "select_account" },
        },
      });
      if (error) throw error;
    } catch (error) {
      setFieldErrors({ auth: error instanceof Error ? error.message : "Google sign-in failed. Please try again." });
      setGoogleLoading(false);
      setProgress("Ready to create your account");
    }
  };

  const completeSignup = async () => {
    if (!validateStep(0) || !validateStep(1) || !validateStep(2) || !validateStep(3)) return;
    setSubmitting(true);
    setFieldErrors({});
    setProgress("Creating your account...");

    try {
      const client = createClient();
      const result = await client.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?redirectTo=${encodeURIComponent(form.accountType === "seller" ? "/sell" : "/dashboard")}`,
          data: {
            full_name: form.fullName.trim(),
            role: form.accountType,
            referral_code: form.referralCode.trim() || undefined,
            referral_source: form.referralCode.trim() ? "referral code" : undefined,
          },
        },
      });

      if (result.error) throw result.error;

      const user = result.data.user;
      if (!user) throw new Error("Account created, but we could not finish signing you in.");

      const username = normalizeUsername(form.username || form.fullName || form.email.split("@")[0]);
      const provision = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          email: form.email.trim(),
          fullName: form.fullName.trim(),
          username,
          accountType: form.accountType,
          sellerState: form.accountType === "seller" ? form.sellerState.trim().toUpperCase() : null,
          referralCode: form.referralCode.trim(),
          avatarUrl: null,
        }),
      });

      const provisionData = await provision.json().catch(() => ({}));
      if (!provision.ok) throw new Error(provisionData.error ?? "We could not finish setting up your account.");

      const authResult = await client.auth.signInWithPassword({ email: form.email.trim(), password: form.password });
      if (authResult.error) throw authResult.error;

      setProgress(`Account created successfully. Redirecting to your ${form.accountType === "seller" ? "seller" : "buyer"} dashboard...`);
      router.replace(form.accountType === "seller" ? "/sell" : "/dashboard");
    } catch (error) {
      setFieldErrors({ submit: error instanceof Error ? error.message : "We could not create your account right now." });
      setSubmitting(false);
      setProgress("Ready to create your account");
    }
  };

  const stepComplete = (index: number) => step > index;
  const currentStrength = strength;
  const canContinue = step === 3 ? form.agreeToTerms : true;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,171,1,0.18),_transparent_32%),linear-gradient(180deg,#09090f_0%,#11111c_45%,#09090f_100%)] px-4 py-6 text-white sm:px-6 sm:py-10 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-7xl items-center gap-10 lg:grid-cols-[1.02fr_0.98fr]">
        <div className="space-y-6">
          <a href="/" className="inline-flex items-center gap-3 text-2xl font-black tracking-tight">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#e22400] to-[#ffab01] text-sm font-black text-black shadow-lg shadow-black/30">TCG</div>
            <span className="text-white">Poke</span>
            <span className="text-yellow-400">Market</span>
          </a>

          <div className="inline-flex rounded-full border border-yellow-400/20 bg-yellow-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.32em] text-yellow-400">
            Premium marketplace signup
          </div>

          <div className="max-w-2xl space-y-4">
            <h1 className="text-4xl font-black leading-tight sm:text-5xl lg:text-6xl">
              Join the Pokémon marketplace built for buyers and sellers.
            </h1>
            <p className="max-w-xl text-base leading-7 text-gray-300 sm:text-lg">
              Create your account in a fast, mobile-first flow with clear validation, referral support, and the right dashboard waiting when you finish.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {["Email or Google signup", "Buyer and seller paths", "Referral codes preserved", "Accessible and responsive"].map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-gray-300 backdrop-blur">
                {item}
              </div>
            ))}
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl shadow-black/20 backdrop-blur">
            <div className="flex items-center gap-3 text-sm font-semibold text-yellow-400">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-400/15 text-base">★</span>
              Trusted collector marketplace
            </div>
            <p className="mt-3 text-sm leading-6 text-gray-300">
              We keep the signup experience clean while preserving everything behind the scenes — account roles, referrals, wallets, and seller onboarding.
            </p>
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-[#0f1627]/90 p-5 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-7">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-yellow-400">Create account</p>
              <h2 className="mt-2 text-2xl font-black text-white">{STEP_TITLES[step]}</h2>
              <p className="mt-1 text-sm text-gray-400">{progress}</p>
            </div>
            <div className="text-right text-xs text-gray-400">
              <div>{step + 1} / {STEP_TITLES.length}</div>
              <div className="mt-1 flex justify-end gap-1">
                {STEP_TITLES.map((title, index) => (
                  <span key={title} className={`h-2 w-6 rounded-full ${step === index ? "bg-yellow-400" : stepComplete(index) ? "bg-emerald-400" : "bg-white/10"}`} />
                ))}
              </div>
            </div>
          </div>

          <div className="mb-5 grid gap-2 sm:grid-cols-4">
            {STEP_TITLES.map((title, index) => (
              <div key={title} className={`rounded-2xl border px-3 py-3 text-xs font-semibold uppercase tracking-[0.22em] ${step === index ? "border-yellow-400/40 bg-yellow-400/10 text-yellow-300" : stepComplete(index) ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-white/10 bg-white/5 text-gray-400"}`}>
                {title}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={submitting || googleLoading}
            className="mb-5 flex w-full items-center justify-center gap-3 rounded-2xl bg-white px-4 py-3 font-bold text-black transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {googleLoading ? <Spinner /> : <GoogleIcon />}
            Continue with Google
          </button>

          <div className="mb-5 flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-gray-500">
            <span className="h-px flex-1 bg-white/10" />
            <span>or email</span>
            <span className="h-px flex-1 bg-white/10" />
          </div>

          {fieldErrors.auth && <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{fieldErrors.auth}</div>}
          {fieldErrors.submit && <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{fieldErrors.submit}</div>}

          <form onSubmit={(e) => { e.preventDefault(); if (step === STEP_TITLES.length - 1) void completeSignup(); else nextStep(); }} className="space-y-4" noValidate>
            {step === 0 && (
              <>
                <label className="block text-sm font-medium text-gray-200">
                  Full name
                  <input
                    type="text"
                    value={form.fullName}
                    onChange={(e) => setValue("fullName", e.target.value)}
                    placeholder="Ash Ketchum"
                    autoComplete="name"
                    disabled={submitting || googleLoading}
                    aria-invalid={Boolean(fieldErrors.fullName)}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-[#111827] px-4 py-3 text-white outline-none transition placeholder:text-gray-500 focus:border-yellow-400/60"
                  />
                  {fieldErrors.fullName && <span className="mt-1 block text-xs text-red-300">{fieldErrors.fullName}</span>}
                </label>

                <label className="block text-sm font-medium text-gray-200">
                  Email
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setValue("email", e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    disabled={submitting || googleLoading}
                    aria-invalid={Boolean(fieldErrors.email)}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-[#111827] px-4 py-3 text-white outline-none transition placeholder:text-gray-500 focus:border-yellow-400/60"
                  />
                  {fieldErrors.email && <span className="mt-1 block text-xs text-red-300">{fieldErrors.email}</span>}
                </label>

                <label className="block text-sm font-medium text-gray-200">
                  Password
                  <div className="mt-2 flex items-stretch gap-2 rounded-2xl border border-white/10 bg-[#111827] pr-2 focus-within:border-yellow-400/60">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={form.password}
                      onChange={(e) => setValue("password", e.target.value)}
                      placeholder="Create a strong password"
                      autoComplete="new-password"
                      disabled={submitting || googleLoading}
                      aria-invalid={Boolean(fieldErrors.password)}
                      className="w-full rounded-2xl bg-transparent px-4 py-3 text-white outline-none placeholder:text-gray-500"
                    />
                    <button type="button" onClick={() => setShowPassword((current) => !current)} className="text-xs font-semibold text-yellow-400 hover:text-yellow-300">
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span>Password strength</span>
                      <span className="font-semibold text-gray-200">{currentStrength.label}</span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-white/10">
                      <div className={`h-2 rounded-full ${currentStrength.color}`} style={{ width: currentStrength.width }} />
                    </div>
                  </div>
                  {fieldErrors.password && <span className="mt-1 block text-xs text-red-300">{fieldErrors.password}</span>}
                </label>
              </>
            )}

            {step === 1 && (
              <div className="space-y-3">
                <div className="text-sm text-gray-300">Choose how you want to use the marketplace.</div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(["buyer", "seller"] as AccountType[]).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setValue("accountType", type)}
                      className={`rounded-3xl border p-5 text-left transition ${form.accountType === type ? "border-yellow-400/50 bg-yellow-400/10" : "border-white/10 bg-white/5 hover:border-white/20"}`}
                    >
                      <div className="text-lg font-bold text-white">{type === "buyer" ? "Buyer" : "Seller"}</div>
                      <p className="mt-2 text-sm text-gray-300">
                        {type === "buyer"
                          ? "Browse, buy, and track your collection with a fast checkout flow."
                          : "List cards, manage inventory, and unlock seller tools after verification."}
                      </p>
                    </button>
                  ))}
                </div>
                {fieldErrors.accountType && <div className="text-xs text-red-300">{fieldErrors.accountType}</div>}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <label className="block text-sm font-medium text-gray-200">
                  Username
                  <input
                    type="text"
                    value={form.username}
                    onChange={(e) => setValue("username", normalizeUsername(e.target.value))}
                    placeholder="ash-ketchum"
                    autoComplete="username"
                    disabled={submitting || googleLoading}
                    aria-invalid={Boolean(fieldErrors.username)}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-[#111827] px-4 py-3 text-white outline-none transition placeholder:text-gray-500 focus:border-yellow-400/60"
                  />
                  {fieldErrors.username && <span className="mt-1 block text-xs text-red-300">{fieldErrors.username}</span>}
                </label>

                <label className="block text-sm font-medium text-gray-200">
                  Referral code
                  <input
                    type="text"
                    value={form.referralCode}
                    onChange={(e) => setValue("referralCode", e.target.value.toUpperCase())}
                    placeholder="Optional"
                    disabled={submitting || googleLoading}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-[#111827] px-4 py-3 text-white outline-none transition placeholder:text-gray-500 focus:border-yellow-400/60"
                  />
                </label>

                {form.accountType === "seller" && (
                  <label className="block text-sm font-medium text-gray-200">
                    Seller state
                    <input
                      type="text"
                      value={form.sellerState}
                      onChange={(e) => setValue("sellerState", e.target.value.toUpperCase().slice(0, 2))}
                      placeholder="CA"
                      maxLength={2}
                      autoComplete="address-level1"
                      disabled={submitting || googleLoading}
                      aria-invalid={Boolean(fieldErrors.sellerState)}
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-[#111827] px-4 py-3 text-white outline-none transition placeholder:text-gray-500 focus:border-yellow-400/60"
                    />
                    <span className="mt-1 block text-xs text-gray-500">Used for seller tax rules and onboarding.</span>
                    {fieldErrors.sellerState && <span className="mt-1 block text-xs text-red-300">{fieldErrors.sellerState}</span>}
                  </label>
                )}
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="grid gap-3 text-sm text-gray-300">
                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#111827] px-4 py-3"><span>Name</span><span className="font-semibold text-white">{form.fullName || "—"}</span></div>
                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#111827] px-4 py-3"><span>Email</span><span className="font-semibold text-white">{form.email || "—"}</span></div>
                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#111827] px-4 py-3"><span>Account type</span><span className="font-semibold text-white">{form.accountType || "—"}</span></div>
                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#111827] px-4 py-3"><span>Username</span><span className="font-semibold text-white">{form.username || "—"}</span></div>
                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#111827] px-4 py-3"><span>Referral code</span><span className="font-semibold text-white">{form.referralCode || "None"}</span></div>
                  {form.accountType === "seller" && <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#111827] px-4 py-3"><span>Seller state</span><span className="font-semibold text-white">{form.sellerState || "—"}</span></div>}
                </div>

                <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-[#111827] px-4 py-3 text-sm text-gray-200">
                  <input
                    type="checkbox"
                    checked={form.agreeToTerms}
                    onChange={(e) => setValue("agreeToTerms", e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-white/20 bg-transparent text-yellow-400 focus:ring-yellow-400"
                  />
                  <span>I agree to the marketplace terms, privacy policy, and seller rules if I choose to sell.</span>
                </label>
                {fieldErrors.agreeToTerms && <div className="text-xs text-red-300">{fieldErrors.agreeToTerms}</div>}
              </div>
            )}

            {step === 2 && form.accountType === "seller" && !form.sellerState && <p className="text-xs text-gray-500">Seller state is required before you can continue.</p>}

            <div className="flex items-center gap-3 pt-2">
              {step > 0 ? (
                <button type="button" onClick={previousStep} disabled={submitting || googleLoading} className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-gray-200 transition hover:bg-white/5 disabled:opacity-50">
                  Back
                </button>
              ) : (
                <div className="rounded-2xl border border-white/10 px-4 py-3 text-sm text-gray-400">Step 1 starts here</div>
              )}

              <button
                type="submit"
                disabled={submitting || googleLoading || !canContinue}
                className="flex-1 rounded-2xl bg-gradient-to-r from-[#e22400] to-[#ffab01] px-4 py-3 font-bold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? <SpinnerButton label="Creating account..." /> : step === STEP_TITLES.length - 1 ? "Create account" : "Continue"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
