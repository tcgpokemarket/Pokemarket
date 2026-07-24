"use client";

import { useEffect, useState } from "react";
import { ControlBar, LiveKitRoom, RoomAudioRenderer, VideoConference } from "@livekit/components-react";
import "@livekit/components-styles";

type LiveKitStageProps = {
  roomName: string;
  canPublish: boolean;
  title?: string;
  returnTo: string;
};

export default function LiveKitStage({ roomName, canPublish, title = "Live stage", returnTo }: LiveKitStageProps) {
  const [token, setToken] = useState<string | null>(null);
  const [livekitUrl, setLivekitUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();

    const loadToken = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/livekit/token?room=${encodeURIComponent(roomName)}&publish=${canPublish ? "true" : "false"}`, {
          credentials: "include",
          signal: controller.signal,
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data.error ?? "Unable to connect to the live room.");
        }

        if (!alive) return;
        setToken(typeof data.token === "string" ? data.token : null);
        setLivekitUrl(typeof data.url === "string" ? data.url : null);
      } catch (loadError) {
        if (!alive || controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : "Unable to connect to the live room.");
      } finally {
        if (alive) setLoading(false);
      }
    };

    void loadToken();

    return () => {
      alive = false;
      controller.abort();
    };
  }, [canPublish, roomName]);

  if (loading) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-black text-center text-white">
        <div>
          <div className="text-2xl font-black">Connecting to live room</div>
          <p className="mt-2 text-sm text-gray-300">{title}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.3em] text-yellow-400">Loading stream</p>
        </div>
      </div>
    );
  }

  if (error || !token || !livekitUrl) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-black text-center text-white">
        <div className="max-w-md px-6">
          <div className="text-2xl font-black">Live room unavailable</div>
          <p className="mt-2 text-sm text-gray-300">{error ?? "The live stream could not be opened right now."}</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-sm">
            <a href={`/auth?redirectTo=${encodeURIComponent(returnTo)}`} className="rounded-full bg-yellow-400 px-4 py-2 font-bold text-black">
              Sign in to join
            </a>
            <a href="/support" className="rounded-full border border-white/10 px-4 py-2 font-semibold text-white">
              Get help
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <LiveKitRoom
      token={token}
      serverUrl={livekitUrl}
      connect
      audio={canPublish}
      video={canPublish}
      className="flex aspect-video min-h-0 flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-950 text-white"
    >
      <RoomAudioRenderer />
      <div className="flex items-center justify-between gap-4 border-b border-white/10 bg-black/60 px-4 py-3 text-sm backdrop-blur">
        <div>
          <div className="text-xs uppercase tracking-[0.35em] text-yellow-400">{canPublish ? "Broadcasting" : "Watching live"}</div>
          <div className="font-semibold text-white">{title}</div>
        </div>
        <div className="text-right text-xs text-gray-400">
          <div>Room</div>
          <div className="font-semibold text-white">{roomName}</div>
        </div>
      </div>
      <div className="min-h-0 flex-1 bg-black">
        <VideoConference />
      </div>
      {canPublish && (
        <div className="border-t border-white/10 bg-black/70 px-3 py-2">
          <ControlBar variation="minimal" controls={{ camera: true, microphone: true, screenShare: true, leave: true }} />
        </div>
      )}
    </LiveKitRoom>
  );
}
