import { Suspense } from "react";
import AuthClient from "./AuthClient";

export default function AuthPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,171,1,0.12),_transparent_28%),linear-gradient(180deg,#09090f_0%,#11111c_46%,#09090f_100%)] px-4 py-6 text-white sm:px-6 sm:py-10 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-xl items-center">
        <section className="w-full rounded-[2rem] border border-white/10 bg-[#0f1627]/90 p-5 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-7">
          <div className="flex items-center gap-3 text-2xl font-black tracking-tight">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#e22400] to-[#ffab01] text-sm font-black text-black shadow-lg shadow-black/30">TCG</div>
            <span className="text-white">Poke</span>
            <span className="text-yellow-400">Market</span>
          </div>
          <h1 className="mt-8 text-4xl font-black leading-tight sm:text-5xl">Sign in to continue.</h1>
          <p className="mt-4 text-base leading-7 text-gray-300">Sign in with email or Google.</p>
          <div className="mt-8">
            <Suspense fallback={null}>
              <AuthClient />
            </Suspense>
          </div>
        </section>
      </div>
    </main>
  );
}
