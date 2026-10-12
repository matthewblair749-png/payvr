"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Mascot } from "@/features/brand/mascot";
import type { LanguageCode } from "@/features/translation/languages";
import { loadCredentials, saveCredentials, saveOutbox, type Credentials } from "../client/storage";
import type { FatalReason } from "../client/transport";
import { JoinForm } from "./join-form";
import { RoomView } from "./room-view";

type Phase =
  | { kind: "loading" }
  | { kind: "join" }
  | { kind: "room"; credentials: Credentials }
  | { kind: "ended"; reason: "closed" | "removed" }
  | { kind: "error"; message: string };

export function EndedScreen({ reason }: { reason: "closed" | "removed" }) {
  return (
    <main id="main" className="wrap flex min-h-dvh flex-col items-center justify-center py-12 text-center">
      <div className="w-[110px]">
        <Mascot mood="idle" waving={false} />
      </div>
      <h1 className="mt-6 text-4xl">{reason === "closed" ? "This room has closed." : "You've left this room."}</h1>
      <p className="mt-4 max-w-md text-lg text-muted">
        {reason === "closed"
          ? "Rooms close after a while or when the host ends them. Its messages were deleted, as promised."
          : "The host removed you from this room."}
      </p>
      <ButtonLink href="/" className="mt-8">
        Go to babel
      </ButtonLink>
    </main>
  );
}

type RoomAppProps = {
  roomId: string;
  roomName: string;
  realtimeUrl: string;
  /** Set when the signed-in visitor owns this room. */
  owner: { displayName: string; language: LanguageCode } | null;
};

const noopSubscribe = () => () => {};

const Opening = () => (
  <p role="status" className="flex min-h-dvh items-center justify-center font-display text-2xl font-black">
    Opening the room…
  </p>
);

/**
 * Decides what a visitor to /r/:id sees: the join form, the room itself, or
 * a closed/removed screen. The room's owner, when signed in, skips the form.
 * Stored credentials live in the browser, so the server renders a placeholder.
 */
export function RoomApp(props: RoomAppProps) {
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  return hydrated ? <RoomAppClient {...props} /> : <Opening />;
}

function RoomAppClient({
  roomId,
  roomName,
  realtimeUrl,
  owner,
}: RoomAppProps) {
  const [phase, setPhase] = useState<Phase>(() => {
    const stored = loadCredentials(roomId);
    if (stored) return { kind: "room", credentials: stored };
    return owner ? { kind: "loading" } : { kind: "join" };
  });

  // Asks the server for the owner's seat. Returns the next phase; never throws.
  const requestOwnerSeat = useCallback(async (): Promise<Phase> => {
    if (!owner) return { kind: "join" };
    try {
      const res = await fetch(`/api/rooms/${roomId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(owner),
      });
      const data = (await res.json()) as { ok: boolean; participantId?: string; token?: string; message?: string; code?: string };
      if (data.ok && data.participantId && data.token) {
        const credentials = { participantId: data.participantId, token: data.token };
        saveCredentials(roomId, credentials);
        return { kind: "room", credentials };
      }
      if (data.code === "closed") return { kind: "ended", reason: "closed" };
      return { kind: "error", message: data.message ?? "Couldn't open the room." };
    } catch {
      return { kind: "error", message: "Couldn't reach Babel. Check your connection and refresh." };
    }
  }, [owner, roomId]);

  // The owner without stored credentials gets their seat from the server.
  const needsOwnerSeat = phase.kind === "loading" && owner !== null;
  useEffect(() => {
    if (!needsOwnerSeat) return;
    let cancelled = false;
    void (async () => {
      const next = await requestOwnerSeat();
      if (!cancelled) setPhase(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [needsOwnerSeat, requestOwnerSeat]);

  const onFatal = useCallback(
    (reason: FatalReason) => {
      if (reason === "unauthorized") {
        // Stale or replaced credentials: start over.
        saveCredentials(roomId, null);
        // The owner goes back through "loading", which fetches a fresh seat.
        setPhase(owner ? { kind: "loading" } : { kind: "join" });
        return;
      }
      saveCredentials(roomId, null);
      saveOutbox(roomId, []);
      setPhase({ kind: "ended", reason });
    },
    [roomId, owner],
  );

  switch (phase.kind) {
    case "loading":
      return <Opening />;
    case "join":
      return (
        <main id="main" className="wrap">
          <JoinForm
            roomId={roomId}
            roomName={roomName}
            onJoined={(credentials) => {
              saveCredentials(roomId, credentials);
              setPhase({ kind: "room", credentials });
            }}
          />
        </main>
      );
    case "room":
      return <RoomView roomId={roomId} credentials={phase.credentials} realtimeUrl={realtimeUrl} onFatal={onFatal} />;
    case "ended":
      return <EndedScreen reason={phase.reason} />;
    case "error":
      return (
        <main id="main" className="wrap flex min-h-dvh flex-col items-center justify-center text-center">
          <h1 className="text-3xl">That didn&rsquo;t work.</h1>
          <p role="alert" className="mt-3 text-muted">
            {phase.message}
          </p>
        </main>
      );
  }
}
