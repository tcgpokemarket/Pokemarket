"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function getRedirectTarget(value: string | null) {
  return value && value.startsWith("/") ? value : "/dashboard";
}

export default function AuthClient() {
  const searchParams = useSearchParams();
  const redirectTo = getRedirectTarget(searchParams.get("redirectTo"));

  const supabase = createClient();
  const router = useRouter();


  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) router.replace(redirectTo);
    });
  }, [redirectTo, router, supabase.auth]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (error) setMessage({ type: "error", text: error.message });
      else setMessage({ type: "success", text: "Check your email to confirm your account." });
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMessage({ type: "error", text: error.message });
      else router.replace(redirectTo);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0f0f1a] px-4 py-16 text-white">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div className="space-y-6">
          <div className="inline-flex rounded-full border border-yellow-400/20 bg-yellow-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-yellow-400">
            Account access
          </div>
          <h1 className="max-w-2xl text-4xl font-black leading-tight sm:text-5xl lg:text-6xl">
            {mode === "login" ? "Welcome back to TcgPoké Market." : "Create your TcgPoké Market account."}
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-gray-300">
            {mode === "login"
              ? "Sign in to buy, sell, and track your collection in one branded dashboard."
              : "Join the collector marketplace and start buying or selling with confidence."}
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            {[
              "Branded marketplace experience",
              "Access to seller tools",
              "Live auction and order tracking",
              "Fast path back to your dashboard",
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-gray-300">
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/20 backdrop-blur">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-widest text-yellow-400">Authentication</p>
              <h2 className="mt-2 text-2xl font-black">{mode === "login" ? "Sign in" : "Create account"}</h2>
            </div>
            <a href="/" className="rounded-2xl border border-yellow-400/20 bg-yellow-400/10 px-3 py-2 text-sm font-semibold text-yellow-400">
              Home
            </a>
          </div>

          <div className="mb-5 flex rounded-2xl border border-white/10 bg-black/20 p-1 text-sm font-semibold">
            <button
              type="button"
              onClick={() => { setMode("login"); setMessage(null); }}
              className={`flex-1 rounded-xl px-4 py-2 transition-colors ${mode === "login" ? "bg-yellow-400 text-black" : "text-gray-400 hover:text-white"}`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => { setMode("signup"); setMessage(null); }}
              className={`flex-1 rounded-xl px-4 py-2 transition-colors ${mode === "signup" ? "bg-yellow-400 text-black" : "text-gray-400 hover:text-white"}`}
            >
              Create account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-200">Full name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  placeholder="Ash Ketchum"
                  className="w-full rounded-2xl border border-white/10 bg-[#11111c] px-4 py-3 text-white outline-none transition placeholder:text-gray-500 focus:border-yellow-400/60"
                />
              </div>
            )}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-200">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="ash@pokemon.com"
                className="w-full rounded-2xl border border-white/10 bg-[#11111c] px-4 py-3 text-white outline-none transition placeholder:text-gray-500 focus:border-yellow-400/60"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-200">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                placeholder="••••••••"
                className="w-full rounded-2xl border border-white/10 bg-[#11111c] px-4 py-3 text-white outline-none transition placeholder:text-gray-500 focus:border-yellow-400/60"
              />
            </div>

            {message && (
              <div className={`rounded-2xl border px-4 py-3 text-sm ${message.type === "error" ? "border-red-500/30 bg-red-500/10 text-red-300" : "border-green-500/30 bg-green-500/10 text-green-300"}`}>
                {message.text}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-gradient-to-r from-[#e22400] to-[#ffab01] px-4 py-3 font-bold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Loading..." : mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-gray-400">
            {mode === "login" ? "Need an account? " : "Already have one? "}
            <button
              onClick={() => { setMode(mode === "login" ? "signup" : "login"); setMessage(null); }}
              className="font-semibold text-yellow-400 hover:text-yellow-300"
            >
              {mode === "login" ? "Create one" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
