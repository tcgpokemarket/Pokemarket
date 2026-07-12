"use client";

import { useState } from "react";
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

export default function SignIn() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? "/dashboard";
  const callbackUrl = `/auth/signin?redirectTo=${encodeURIComponent(redirectTo)}`;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);

  const handleGoogleSignIn = async () => {
    setError("");
    setGoogleLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}${callbackUrl}`,
          queryParams: { prompt: "select_account" },
        },
      });
      if (error) throw error;
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Google sign-in failed. Please try again.");
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const supabase = createClient();

      if (isSignUp) {
        const result = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}${callbackUrl}` } });
        if (result.error) throw result.error;
        router.push(callbackUrl);
      } else {
        const result = await supabase.auth.signInWithPassword({ email, password });
        if (result.error) throw result.error;
        router.push(redirectTo);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Auth error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0f1a] px-4 py-10 text-white sm:py-16">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div className="space-y-6">
          <a href="/" className="inline-flex items-center gap-2 text-2xl font-black">
            <span className="text-3xl">⚡</span>
            <span className="text-white">TCG</span>
            <span className="text-yellow-400">Poke</span>
            <span className="text-white">Market</span>
          </a>
          <div className="inline-flex rounded-full border border-yellow-400/20 bg-yellow-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-yellow-400">
            {isSignUp ? "Create your account" : "Buyer sign in"}
          </div>
          <h1 className="max-w-2xl text-4xl font-black leading-tight sm:text-5xl lg:text-6xl">
            {isSignUp ? "Join the Pokémon TCG marketplace." : "Sign in to buy, sell, and track your collection."}
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-gray-300">
            Use email or Google to access your wallet, orders, live auctions, watchlists, and seller tools.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/20 backdrop-blur sm:p-8">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-widest text-yellow-400">Account access</p>
              <h2 className="mt-2 text-2xl font-black">{isSignUp ? "Create your account" : "Welcome back"}</h2>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsSignUp((current) => !current);
                setError("");
              }}
              className="rounded-2xl border border-white/10 px-3 py-2 text-sm font-semibold text-gray-200 transition hover:bg-white/5"
            >
              {isSignUp ? "Sign in" : "Sign up"}
            </button>
          </div>

          {error && (
            <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading || googleLoading}
            className="mb-4 flex w-full items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white px-4 py-3 font-bold text-black transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {googleLoading ? <Spinner /> : <GoogleIcon />}
            Continue with Google
          </button>

          <div className="relative mb-4 flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-gray-500">
            <span className="h-px flex-1 bg-white/10" />
            <span>or email</span>
            <span className="h-px flex-1 bg-white/10" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-200">Full name</label>
                <input
                  type="text"
                  required
                  disabled={loading || googleLoading}
                  placeholder="Ash Ketchum"
                  className="w-full rounded-2xl border border-white/10 bg-[#11111c] px-4 py-3 text-white outline-none transition placeholder:text-gray-500 focus:border-yellow-400/60"
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
                required
                disabled={loading || googleLoading}
                placeholder="you@example.com"
                className="w-full rounded-2xl border border-white/10 bg-[#11111c] px-4 py-3 text-white outline-none transition placeholder:text-gray-500 focus:border-yellow-400/60"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-medium text-gray-200">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading || googleLoading}
                placeholder="••••••••"
                className="w-full rounded-2xl border border-white/10 bg-[#11111c] px-4 py-3 text-white outline-none transition placeholder:text-gray-500 focus:border-yellow-400/60"
              />
            </div>

            <button
              type="submit"
              disabled={loading || googleLoading}
              className="w-full rounded-2xl bg-gradient-to-r from-[#e22400] to-[#ffab01] px-4 py-3 font-bold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? <span className="inline-flex items-center gap-2"><Spinner /> Loading...</span> : isSignUp ? "Create account" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
