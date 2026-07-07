"use client";

import { useMemo } from "react";
import { RoomAudioRenderer, RoomContext, VideoConference } from "@livekit/components-react";
import { LiveKitRoom } from "@livekit/components-react";
import { ConnectionState, type RoomOptions } from "livekit-client";

const LIVEKIT_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL ?? "";

type LiveKitStageProps = {
  token: string | null;
  roomName: string;
};

export default function LiveKitStage({ token, roomName }: LiveKitStageProps) {
  const options = useMemo<RoomOptions>(() => ({
    adaptiveStream: true,
    dynacast: true,
  }), []);

  if (!LIVEKIT_URL || !token) {
    return (
      <div className="aspect-video rounded-2xl border border-white/10 bg-black/70 p-4 text-sm text-gray-300">
        Live video is not connected yet.
      </div>
    );
  }

  return (
    <LiveKitRoom
      serverUrl={LIVEKIT_URL}
      token={token}
      connect={true}
      options={options}
      data-lk-theme="default"
      className="aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black/70"
    >
      <RoomContext.Provider value={undefined as never}>
        <div className="flex h-full min-h-[360px] flex-col">
          <div className="border-b border-white/10 px-4 py-3 text-xs font-semibold uppercase tracking-widest text-gray-300">
            LiveKit room · {roomName}
          </div>
          <div className="min-h-0 flex-1">
            <VideoConference />
          </div>
        </div>
        <RoomAudioRenderer />
      </RoomContext.Provider>
    </LiveKitRoom>
  );
}
