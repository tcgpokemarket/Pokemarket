"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function Spinner() {
  return <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black" />;
}

function safeRedirect(value: string | null) {
  if (!value || !value.startsWith("/")) return "/";
  if (value.startsWith("/auth")) return "/";
  return value;
}

function defaultDestination(role: string | null) {
  if (role === "admin" || role === "super_admin") return "/admin";
  if (role === "seller") return "/dashboard";
  return "/";
}

function formatAuthError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  if (/invalid login credentials/i.test(message)) return "Incorrect email or password.";
  if (/email not confirmed/i.test(message)) return "Please confirm your email before signing in.";
  if (/rate limit/i.test(message)) return "Too many attempts. Please wait a moment and try again.";
  if (/already registered/i.test(message)) return "That email already has an account. Try signing in instead.";
  return message;
}

export default function AuthClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get("redirectTo");
  const redirectTo = useMemo(() => safeRedirect(redirectParam), [redirectParam]);
  const preserveRedirect = searchParams.has("redirectTo");
  const [mode, setMode] = useState<"signin" | "signup">(searchParams.get("mode") === "signup" ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(
    searchParams.get("reason") === "session_expired"
      ? { type: "error", text: "Your session has expired. Please log in again." }
      : searchParams.get("message") === "logged_out"
        ? { type: "success", text: "You have been logged out successfully." }
        : null
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const client = createClient({ rememberSession: rememberMe });

      if (mode === "signup") {
        const { error } = await client.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback${preserveRedirect ? `?redirectTo=${encodeURIComponent(redirectTo)}` : ""}`,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        setMessage({ type: "success", text: "Check your email to confirm your account." });
      } else {
        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace(defaultDestination((data.user?.app_metadata?.role ?? data.user?.user_metadata?.role) as string | null));
      }
    } catch (error) {
      setMessage({ type: "error", text: formatAuthError(error, "We could not sign you in right now.") });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!email) {
      setMessage({ type: "error", text: "Enter your email first, then click Forgot Password." });
      return;
    }

    setMessage(null);
    setResetLoading(true);

    try {
      const client = createClient({ rememberSession: rememberMe });
      const { error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password${preserveRedirect ? `?redirectTo=${encodeURIComponent(redirectTo)}` : ""}`,
      });
      if (error) throw error;
      setMessage({ type: "success", text: "Password reset email sent. Check your inbox, then use the reset link there." });
    } catch (error) {
      setMessage({ type: "error", text: formatAuthError(error, "Unable to send reset email.") });
    } finally {
      setResetLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const client = createClient({ rememberSession: rememberMe });
      const { error } = await client.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback${preserveRedirect ? `?redirectTo=${encodeURIComponent(redirectTo)}` : ""}`,
        },
      });
      if (error) throw error;
    } catch (error) {
      setMessage({ type: "error", text: formatAuthError(error, "Unable to continue with Google.") });
      setLoading(false);
    }
  };

  return (
    <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-4 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-7">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white">{mode === "signin" ? "Sign in" : "Create account"}</h2>
          <p className="mt-1 text-sm text-gray-400">Access your account, reset your password, or connect with Google.</p>
        </div>
        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="rounded-2xl border border-white/10 px-3 py-2 text-sm font-semibold text-gray-200 transition hover:bg-white/5"
        >
          {mode === "signin" ? "Create account" : "Sign in"}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === "signup" && (
          <div>
            <label htmlFor="full-name" className="mb-2 block text-sm font-medium text-gray-200">Full name</label>
            <input id="full-name" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" required disabled={loading || resetLoading} className="w-full rounded-2xl border border-white/10 bg-[#111827] px-4 py-3 text-white outline-none transition placeholder:text-gray-500 focus:border-yellow-400/60" />
          </div>
        )}

        <div>
          <label htmlFor="email" className="mb-2 block text-sm font-medium text-gray-200">Email</label>
          <input id="email" type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" autoComplete="email" enterKeyHint="next" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required disabled={loading || resetLoading} className="w-full rounded-2xl border border-white/10 bg-[#111827] px-4 py-3 text-white outline-none transition placeholder:text-gray-500 focus:border-yellow-400/60" />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <label htmlFor="password" className="block text-sm font-medium text-gray-200">Password</label>
            <div className="flex items-center gap-3">
              <button type="button" onClick={handlePasswordReset} disabled={loading || resetLoading} className="text-sm font-semibold text-yellow-400 hover:text-yellow-300 disabled:opacity-50">{resetLoading ? "Sending..." : "Forgot Password"}</button>
              <button type="button" onClick={() => setShowPassword((current) => !current)} disabled={loading || resetLoading} className="text-sm font-semibold text-gray-300 hover:text-white disabled:opacity-50">{showPassword ? "Hide" : "Show"}</button>
            </div>
          </div>
          <input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" enterKeyHint="go" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={8} disabled={loading || resetLoading} className="w-full rounded-2xl border border-white/10 bg-[#111827] px-4 py-3 text-white outline-none transition placeholder:text-gray-500 focus:border-yellow-400/60" />
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <button type="submit" disabled={loading || resetLoading} className="w-full rounded-2xl bg-gradient-to-r from-[#e22400] to-[#ffab01] px-4 py-3 font-bold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60">{loading ? <span className="inline-flex items-center gap-2"><Spinner /> Loading...</span> : mode === "signin" ? "Sign in" : "Create account"}</button>
          <button type="button" onClick={handleGoogleSignIn} disabled={loading || resetLoading} className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60">Continue with Google</button>
        </div>

        <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-gray-200">
          <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="h-4 w-4 rounded border-white/20 bg-transparent text-yellow-400 focus:ring-yellow-400" />
          Remember me on this device
        </label>

        {message && <div className={`rounded-2xl border px-4 py-3 text-sm ${message.type === "error" ? "border-red-500/30 bg-red-500/10 text-red-200" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"}`}>{message.text}</div>}
      </form>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-gray-400">
        <button type="button" onClick={handlePasswordReset} disabled={loading || resetLoading} className="font-semibold text-yellow-400 hover:text-yellow-300 disabled:opacity-50">Forgot Password</button>
        <a href="/terms" className="font-semibold text-gray-300 hover:text-white">Terms of Service</a>
        <a href="/privacy" className="font-semibold text-gray-300 hover:text-white">Privacy Policy</a>
      </div>
    </div>
  );
}
