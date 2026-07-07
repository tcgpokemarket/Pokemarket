"use client";

import { useEffect, useState } from "react";
import { getIntegrationHealth, setIntegrationEnabled } from "@/lib/api-integrations";

export default function ApiManagementPage() {
  const [health, setHealth] = useState(getIntegrationHealth());

  useEffect(() => {
    setHealth(getIntegrationHealth());
  }, []);

  return (
    <div className="min-h-screen bg-[#0f0f1a] px-4 py-10 text-white">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <p className="text-sm uppercase tracking-widest text-yellow-400">API management</p>
          <h1 className="mt-1 text-3xl font-black">Connected integrations</h1>
          <p className="mt-2 text-sm text-gray-400">Enable, inspect, and monitor the modular API layer without affecting marketplace flows.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {health.map((item) => (
            <div key={item.key} className="rounded-2xl border border-white/10 bg-[#13131f] p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-bold">{item.name}</h2>
                  <p className="text-xs text-gray-500">{item.key}</p>
                </div>
                <span className={`rounded-full border px-2 py-0.5 text-xs ${item.enabled ? "border-green-400/30 bg-green-400/10 text-green-300" : "border-gray-400/30 bg-gray-400/10 text-gray-300"}`}>{item.status}</span>
              </div>
              <div className="mt-4 space-y-2 text-sm text-gray-300">
                <div className="flex justify-between"><span>Requests</span><span>{item.requestCount}</span></div>
                <div className="flex justify-between"><span>Rate limit</span><span>{item.rateLimit}</span></div>
                <div className="flex justify-between"><span>Last sync</span><span>{item.lastSync ?? "—"}</span></div>
              </div>
              {item.errors.length > 0 && (
                <div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-xs text-red-200">
                  {item.errors[0]}
                </div>
              )}
              <div className="mt-4 flex gap-2">
                <button onClick={() => { setIntegrationEnabled(item.key as never, true); setHealth(getIntegrationHealth()); }} className="rounded-lg bg-yellow-400 px-3 py-2 text-sm font-semibold text-black">Enable</button>
                <button onClick={() => { setIntegrationEnabled(item.key as never, false); setHealth(getIntegrationHealth()); }} className="rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold text-white">Disable</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
