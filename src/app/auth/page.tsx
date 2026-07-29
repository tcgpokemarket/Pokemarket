import { Suspense } from "react";
import AuthClient from "./AuthClient";

export default function AuthPage() {
  return (
    <div className="min-h-dvh overflow-y-auto bg-[#080a12] px-4 py-4 text-white sm:px-6 sm:py-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100dvh-2rem)] max-w-md items-start pt-4 sm:pt-8">
        <div className="w-full rounded-[2rem] border border-white/10 bg-[#0f1627]/95 p-4 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-6">
          <Suspense fallback={null}>
            <AuthClient />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
