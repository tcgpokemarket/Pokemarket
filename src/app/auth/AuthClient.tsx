"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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

function safeRedirect(value: string | null) {
  if (!value || !value.startsWith("/")) return "/dashboard";
  if (value.startsWith("/auth") || value === "/login" || value === "/signup") return "/dashboard";
  return value;
}

function defaultDestination(role: string | null) {
  return role === "admin" || role === "super_admin" ? "/admin" : "/dashboard";
}

export default function AuthClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = useMemo(() => safeRedirect(searchParams.get("redirectTo")), [searchParams]);
  const [mode, setMode] = useState<"signin" | "signup">(searchParams.get("mode") === "signup" ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  useEffect(() => {
    const client = createClient({ rememberSession: rememberMe });
    client.auth.getUser().then(({ data: { user } }) => {
      if (user) router.replace(redirectTo);
    });
  }, [rememberMe, redirectTo, router]);

  const handleGoogleSignIn = async () => {
    setMessage(null);
    setGoogleLoading(true);

    try {
      const client = createClient({ rememberSession: rememberMe });
      const { error } = await client.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?redirectTo=${encodeURIComponent(redirectTo)}`,
          queryParams: { prompt: "select_account" },
        },
      });
      if (error) throw error;
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Google sign-in failed. Please try again." });
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const client = createClient({ rememberSession: rememberMe });

      if (mode === "signup") {
        const { error } = await client.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?redirectTo=${encodeURIComponent(redirectTo)}`,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        setMessage({ type: "success", text: "Check your email to confirm your account." });
      } else {
        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace(defaultDestination(data.user?.app_metadata?.role ?? data.user?.user_metadata?.role));
      }
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Auth error" });
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
        redirectTo: `${window.location.origin}/auth/callback?redirectTo=/dashboard`,
      });
      if (error) throw error;
      setMessage({ type: "success", text: "Password reset email sent. Check your inbox." });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Unable to send reset email." });
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,171,1,0.18),_transparent_38%),linear-gradient(180deg,#09090f_0%,#11111c_45%,#09090f_100%)] px-4 py-8 text-white sm:px-6 sm:py-12 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-8 lg:grid-cols-[1.02fr_0.98fr]">
        <div className="space-y-6">
          <a href="/" className="inline-flex items-center gap-3 text-2xl font-black tracking-tight">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#e22400] to-[#ffab01] text-sm font-black text-black shadow-lg shadow-black/30">TCG</div>
            <span className="text-white">Poke</span>
            <span className="text-yellow-400">Market</span>
          </a>

          <div className="inline-flex rounded-full border border-yellow-400/20 bg-yellow-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.32em] text-yellow-400">
            Secure account access
          </div>

          <div className="max-w-2xl space-y-4">
            <h1 className="text-4xl font-black leading-tight sm:text-5xl lg:text-6xl">
              Welcome to the Pokémon marketplace built for collectors, sellers, and live auctions.
            </h1>
            <p className="max-w-xl text-base leading-7 text-gray-300 sm:text-lg">
              Sign in to continue to your dashboard, wallet, orders, rewards, or seller tools. New here? Create an account and we’ll take you straight to the right place.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              "Email and password sign in",
              "Continue with Google",
              "Password reset and session persistence",
              "Mobile-friendly and secure",
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-gray-300 backdrop-blur">
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-[#0f1627]/90 p-5 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-7">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-yellow-400">Account access</p>
              <h2 className="mt-2 text-2xl font-black text-white">{mode === "signin" ? "Sign In" : "Create Account"}</h2>
              <p className="mt-1 text-sm text-gray-400">{mode === "signin" ? "Enter your details to continue." : "Set up your marketplace account."}</p>
            </div>
            <button
              type="button"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="rounded-2xl border border-white/10 px-3 py-2 text-sm font-semibold text-gray-200 transition hover:bg-white/5"
            >
              {mode === "signin" ? "Create Account" : "Sign In"}
            </button>
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading || googleLoading || resetLoading}
            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-white px-4 py-3 font-bold text-black transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {googleLoading ? <Spinner /> : <GoogleIcon />}
            Continue with Google
          </button>

          <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-gray-500">
            <span className="h-px flex-1 bg-white/10" />
            <span>or email</span>
            <span className="h-px flex-1 bg-white/10" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <label htmlFor="full-name" className="mb-2 block text-sm font-medium text-gray-200">Full name</label>
                <input
                  id="full-name"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ash Ketchum"
                  required
                  disabled={loading || googleLoading || resetLoading}
                  className="w-full rounded-2xl border border-white/10 bg-[#111827] px-4 py-3 text-white outline-none transition placeholder:text-gray-500 focus:border-yellow-400/60"
                />
              </div>
            )}

            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-medium text-gray-200">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                disabled={loading || googleLoading || resetLoading}
                className="w-full rounded-2xl border border-white/10 bg-[#111827] px-4 py-3 text-white outline-none transition placeholder:text-gray-500 focus:border-yellow-400/60"
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <label htmlFor="password" className="block text-sm font-medium text-gray-200">Password</label>
                <button type="button" onClick={handlePasswordReset} disabled={loading || googleLoading || resetLoading} className="text-sm font-semibold text-yellow-400 hover:text-yellow-300 disabled:opacity-50">
                  {resetLoading ? "Sending..." : "Forgot Password"}
                </button>
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
                disabled={loading || googleLoading || resetLoading}
                className="w-full rounded-2xl border border-white/10 bg-[#111827] px-4 py-3 text-white outline-none transition placeholder:text-gray-500 focus:border-yellow-400/60"
              />
            </div>

            <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-gray-200">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-transparent text-yellow-400 focus:ring-yellow-400"
              />
              Remember me on this device
            </label>

            {message && (
              <div className={`rounded-2xl border px-4 py-3 text-sm ${message.type === "error" ? "border-red-500/30 bg-red-500/10 text-red-200" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"}`}>
                {message.text}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || googleLoading || resetLoading}
              className="w-full rounded-2xl bg-gradient-to-r from-[#e22400] to-[#ffab01] px-4 py-3 font-bold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? <span className="inline-flex items-center gap-2"><Spinner /> Loading...</span> : mode === "signin" ? "Sign In" : "Create Account"}
            </button>
          </form>

          <div className="mt-5 grid gap-3 text-center text-sm text-gray-400 sm:grid-cols-2">
            <button type="button" onClick={() => setMode("signin")} className="rounded-2xl border border-white/10 px-4 py-3 font-semibold text-white transition hover:bg-white/5">
              Sign In
            </button>
            <button type="button" onClick={() => setMode("signup")} className="rounded-2xl border border-white/10 px-4 py-3 font-semibold text-white transition hover:bg-white/5">
              Create Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
