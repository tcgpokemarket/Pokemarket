"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function safeRedirect(value: string | null) {
  if (!value || !value.startsWith("/")) return "/dashboard";
  if (value.startsWith("/auth")) return "/dashboard";
  return value;
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = safeRedirect(searchParams.get("redirectTo"));
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  useEffect(() => {
    const client = createClient();
    client.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace("/auth");
      }
    });
  }, [router]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);

    if (password.length < 8) {
      setMessage({ type: "error", text: "Use at least 8 characters." });
      return;
    }

    if (password !== confirmPassword) {
      setMessage({ type: "error", text: "Passwords must match." });
      return;
    }

    setLoading(true);

    try {
      const client = createClient();
      const { error } = await client.auth.updateUser({ password });
      if (error) throw error;
      setMessage({ type: "success", text: "Password updated. Redirecting you now." });
      router.replace(redirectTo);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Unable to update your password right now." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,171,1,0.18),_transparent_32%),linear-gradient(180deg,#09090f_0%,#11111c_45%,#09090f_100%)] px-4 py-6 text-white sm:px-6 sm:py-10 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl items-center gap-8 lg:grid-cols-[1.02fr_0.98fr]">
        <section className="space-y-6">
          <div className="flex items-center gap-3 text-2xl font-black tracking-tight">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#e22400] to-[#ffab01] text-sm font-black text-black shadow-lg shadow-black/30">TCG</div>
            <span className="text-white">Poke</span>
            <span className="text-yellow-400">Market</span>
          </div>
          <div className="inline-flex rounded-full border border-yellow-400/20 bg-yellow-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.32em] text-yellow-400">
            Password reset
          </div>
          <h1 className="max-w-2xl text-4xl font-black leading-tight sm:text-5xl lg:text-6xl">
            Set a new password.
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-gray-300">
            Finish the reset flow and go straight back to your marketplace account.
          </p>
        </section>

        <div className="rounded-[2rem] border border-white/10 bg-[#0f1627]/90 p-5 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-7">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-medium text-gray-200">New password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                required
                className="w-full rounded-2xl border border-white/10 bg-[#111827] px-4 py-3 text-white outline-none transition placeholder:text-gray-500 focus:border-yellow-400/60"
              />
            </div>
            <div>
              <label htmlFor="confirm-password" className="mb-2 block text-sm font-medium text-gray-200">Confirm password</label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                minLength={8}
                required
                className="w-full rounded-2xl border border-white/10 bg-[#111827] px-4 py-3 text-white outline-none transition placeholder:text-gray-500 focus:border-yellow-400/60"
              />
            </div>

            {message && (
              <div className={`rounded-2xl border px-4 py-3 text-sm ${message.type === "error" ? "border-red-500/30 bg-red-500/10 text-red-200" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"}`}>
                {message.text}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-gradient-to-r from-[#e22400] to-[#ffab01] px-4 py-3 font-bold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Updating..." : "Update password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
