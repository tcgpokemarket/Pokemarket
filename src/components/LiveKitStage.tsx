"use client";

export default function LiveKitStage({ roomName }: { token: string | null; roomName: string }) {
  return (
    <div className="flex aspect-video items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-black text-center text-white">
      <div>
        <div className="text-2xl font-black">Live stage</div>
        <p className="mt-2 text-sm text-gray-300">Room: {roomName}</p>
        <p className="mt-1 text-xs uppercase tracking-[0.3em] text-yellow-400">Streaming preview</p>
      </div>
    </div>
  );
}
