"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function safeRedirect(value: string | null) {
  if (!value || !value.startsWith("/")) return "/dashboard";
  if (value.startsWith("/auth") || value === "/login" || value === "/signup") return "/dashboard";
  return value;
}

function formatAuthError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  if (/session|auth session/i.test(message)) return "Your reset link may have expired. Please request a new one.";
  if (/password/i.test(message) && /weak|short|min/i.test(message)) return "Choose a stronger password with at least 8 characters.";
  return message;
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get("redirectTo");
  const redirectTo = useMemo(() => safeRedirect(redirectParam), [redirectParam]);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const client = createClient();
    let alive = true;

    const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");

    const bootstrap = async () => {
      if (accessToken && refreshToken) {
        const { error } = await client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        if (error) throw error;
      }
      await client.auth.getSession();
      if (alive) setReady(true);
    };

    bootstrap().catch((error) => {
      if (!alive) return;
      setMessage({ type: "error", text: formatAuthError(error, "Your reset link could not be opened.") });
    });

    return () => {
      alive = false;
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (password.length < 8) {
      setMessage({ type: "error", text: "Choose a password with at least 8 characters." });
      return;
    }

    if (password !== confirmPassword) {
      setMessage({ type: "error", text: "Passwords do not match." });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const client = createClient();
      const { error } = await client.auth.updateUser({ password });
      if (error) throw error;
      setMessage({ type: "success", text: "Your password has been updated. Redirecting you back to sign in..." });
      router.replace(redirectTo);
    } catch (error) {
      setMessage({ type: "error", text: formatAuthError(error, "We could not update your password.") });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0f1a] px-4 py-10 text-white sm:py-16">
      <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1.02fr_0.98fr] lg:items-center">
        <section className="space-y-6">
          <a href="/" className="inline-flex items-center gap-2 text-2xl font-black">
            <span className="text-3xl">⚡</span>
            <span className="text-white">TCG</span>
            <span className="text-yellow-400">Poke</span>
            <span className="text-white">Market</span>
          </a>
          <div className="inline-flex rounded-full border border-yellow-400/20 bg-yellow-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-yellow-400">
            Reset your password
          </div>
          <h1 className="max-w-2xl text-4xl font-black leading-tight sm:text-5xl">
            Choose a new password for your account.
          </h1>
          <p className="max-w-xl text-base leading-7 text-gray-300 sm:text-lg">
            Use the link from your email to set a new password, then continue back to the marketplace.
          </p>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-gray-300 backdrop-blur">
            {ready ? "Your reset link is ready." : "Checking your reset link..."}
          </div>
        </section>

        <aside className="rounded-[2rem] border border-white/10 bg-[#0f1627]/90 p-5 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-7">
          <div className="mb-6">
            <p className="text-xs uppercase tracking-[0.3em] text-yellow-400">New password</p>
            <h2 className="mt-2 text-2xl font-black text-white">Update credentials</h2>
            <p className="mt-1 text-sm text-gray-400">Choose a password you haven’t used before.</p>
          </div>

          {message && (
            <div className={`mb-4 rounded-2xl border px-4 py-3 text-sm ${message.type === "error" ? "border-red-500/30 bg-red-500/10 text-red-200" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"}`}>
              {message.text}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block text-sm font-medium text-gray-200">
              New password
              <div className="mt-2 flex items-stretch gap-2 rounded-2xl border border-white/10 bg-[#111827] pr-2 focus-within:border-yellow-400/60">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  disabled={!ready || loading}
                  className="w-full rounded-2xl bg-transparent px-4 py-3 text-white outline-none placeholder:text-gray-500"
                  placeholder="Create a new password"
                />
                <button type="button" onClick={() => setShowPassword((value) => !value)} className="text-xs font-semibold text-yellow-400 hover:text-yellow-300">
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </label>

            <label className="block text-sm font-medium text-gray-200">
              Confirm password
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                required
                disabled={!ready || loading}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-[#111827] px-4 py-3 text-white outline-none placeholder:text-gray-500 focus:border-yellow-400/60"
                placeholder="Repeat the new password"
              />
            </label>

            <button
              type="submit"
              disabled={!ready || loading}
              className="w-full rounded-2xl bg-gradient-to-r from-[#e22400] to-[#ffab01] px-4 py-3 font-bold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Saving..." : "Update password"}
            </button>

            <div className="text-center text-sm text-gray-400">
              <a href="/auth" className="font-semibold text-yellow-400 hover:text-yellow-300">
                Back to sign in
              </a>
            </div>
          </form>
        </aside>
      </div>
    </div>
  );
}
