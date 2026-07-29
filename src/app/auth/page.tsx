import { Suspense } from "react";
import AuthClient from "./AuthClient";

export default function AuthPage() {
  return (
    <div className="min-h-screen bg-[#080a12] px-4 py-8 text-white sm:px-6 sm:py-10 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center">
        <div className="w-full rounded-[2rem] border border-white/10 bg-[#0f1627]/95 p-4 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-6">
          <Suspense fallback={null}>
            <AuthClient />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
