"use client";

import clsx from "clsx";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/features/brand/logo";
import { getLanguage } from "@/features/translation/languages";
import type { Credentials } from "../client/storage";
import type { FatalReason } from "../client/transport";
import { useRoom } from "../client/use-room";
import { Composer } from "./composer";
import { MessageBubble, PendingBubble } from "./message-bubble";
import { PeopleSheet, ReportSheet, type ReportTarget } from "./people-panel";

function StatusBar({ status, waiting }: { status: string; waiting: number }) {
  if (status === "connected" && waiting === 0) return null;
  const text =
    status === "offline"
      ? `No connection${waiting ? ` · ${waiting} waiting to send` : ""}. Everything you write is kept.`
      : status === "connected"
        ? `Sending ${waiting} message${waiting === 1 ? "" : "s"}…`
        : status === "connecting"
          ? "Connecting…"
          : `Reconnecting…${waiting ? ` ${waiting} waiting to send.` : ""}`;
  return (
    <p role="status" className="flex items-center justify-center gap-2 bg-sun-tint px-4 py-2 text-center text-sm font-semibold">
      <span aria-hidden className={clsx("size-2 rounded-full", status === "offline" ? "bg-muted" : "bg-sun")} />
      {text}
    </p>
  );
}

function InviteButton() {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="primary"
      className="min-h-11 px-4 text-sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(window.location.href);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          window.prompt("Copy this link:", window.location.href);
        }
      }}
    >
      {copied ? "Link copied" : "Invite"}
    </Button>
  );
}

export function RoomView({
  roomId,
  credentials,
  realtimeUrl,
  onFatal,
}: {
  roomId: string;
  credentials: Credentials;
  realtimeUrl: string;
  onFatal: (reason: FatalReason) => void;
}) {
  const room = useRoom(roomId, credentials, realtimeUrl);
  const { state } = room;
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  useEffect(() => {
    if (state.fatal) onFatal(state.fatal);
  }, [state.fatal, onFatal]);

  const blocked = useMemo(() => new Set(state.blocked), [state.blocked]);
  const visible = state.messages.filter((m) => !blocked.has(m.senderId));

  // Follow new messages unless the reader has scrolled up to read history.
  useEffect(() => {
    const el = listRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [visible.length, state.pending.length]);

  const typingNames = Object.keys(state.typing)
    .filter((id) => id !== state.me?.id && !blocked.has(id))
    .map((id) => state.participants.find((p) => p.id === id)?.name)
    .filter((n): n is string => Boolean(n));
  const online = state.participants.filter((p) => p.online);
  const waiting = state.pending.filter((p) => p.state !== "failed").length;
  const me = state.me;

  if (!me || !state.room) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="font-display text-2xl font-black">Opening the room…</p>
        <p className="text-muted" role="status">
          {state.status === "connecting" ? "Connecting to Babel." : "Still trying to connect. Check your internet connection."}
        </p>
      </div>
    );
  }

  const expires = new Date(state.room.expiresAt).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" });

  return (
    <div className="flex h-dvh flex-col bg-cream">
      <header className="flex items-center gap-2 border-b-2 border-ink bg-paper px-3 py-2 sm:gap-3 sm:px-4">
        <Link href="/" aria-label="babel, home" className="press flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-cream">
          <LogoMark className="h-6" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-lg font-black leading-tight sm:text-xl">{state.room.name}</h1>
          <p className="truncate text-xs text-muted">
            You read in {getLanguage(me.language).native} · closes {expires}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setPeopleOpen(true)}
          aria-label={`People in this room: ${online.length} here now`}
          className="press flex min-h-11 items-center gap-2 rounded-full border-2 border-ink bg-white px-3 text-sm font-bold hover:bg-cream active:scale-95"
        >
          <span aria-hidden className="size-2 rounded-full bg-[#2f9e5b]" />
          {online.length}
          <span className="hidden sm:inline">here</span>
        </button>
        <InviteButton />
      </header>

      <main id="main" className="flex min-h-0 flex-1 flex-col">
        <StatusBar status={state.status} waiting={waiting} />
        {state.notice && (
          <p role="alert" className="bg-coral-tint px-4 py-2 text-center text-sm font-semibold">
            {state.notice}
          </p>
        )}

        <div
          ref={listRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          }}
          role="log"
          aria-live="polite"
          aria-label="Messages"
          className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-4 sm:px-6"
        >
          <ol className="flex flex-1 flex-col gap-3">
            {visible.length === 0 && state.pending.length === 0 && (
              <li className="m-auto max-w-sm rounded-[var(--radius-lg)] border-2 border-dashed border-line-strong p-6 text-center">
                <p className="font-display text-xl font-black">It&rsquo;s quiet in here.</p>
                <p className="mt-2 text-muted">
                  Send the link to whoever you want to talk to. You write in {getLanguage(me.language).native}; they read it in theirs.
                </p>
                <div className="mt-4 flex justify-center">
                  <InviteButton />
                </div>
              </li>
            )}
            {visible.map((m, i) => {
              const mine = m.senderId === me.id;
              return (
                <MessageBubble
                  key={m.id}
                  message={m}
                  mine={mine}
                  showName={visible[i - 1]?.senderId !== m.senderId}
                  onReport={mine ? undefined : () => setReportTarget({ participantId: m.senderId, name: m.senderName, messageId: m.id })}
                />
              );
            })}
            {state.pending.map((p) => (
              <PendingBubble key={p.clientId} item={p} onRetry={() => room.retry(p.clientId)} onDiscard={() => room.discard(p.clientId)} />
            ))}
          </ol>
        </div>

        <p aria-live="polite" className="min-h-6 px-4 text-sm text-muted sm:px-6">
          {typingNames.length === 1 && `${typingNames[0]} is typing…`}
          {typingNames.length === 2 && `${typingNames[0]} and ${typingNames[1]} are typing…`}
          {typingNames.length > 2 && "Several people are typing…"}
        </p>

        <Composer
          language={me.language}
          voiceEnabled={state.room.voiceInput}
          disabledReason={state.notice}
          onSend={room.send}
          onTyping={room.setTyping}
        />
      </main>

      <PeopleSheet
        open={peopleOpen}
        onClose={() => setPeopleOpen(false)}
        participants={state.participants}
        meId={me.id}
        isOwner={me.role === "owner"}
        blocked={state.blocked}
        roomSize={state.room.roomSize}
        onBlock={room.block}
        onUnblock={room.unblock}
        onReport={(t) => {
          setPeopleOpen(false);
          setReportTarget(t);
        }}
        onRemove={room.remove}
        onCloseRoom={room.closeRoom}
      />
      <ReportSheet
        target={reportTarget}
        onClose={() => setReportTarget(null)}
        alreadyBlocked={reportTarget ? blocked.has(reportTarget.participantId) : false}
        onReport={(reason) =>
          reportTarget ? room.report(reportTarget.participantId, reason, reportTarget.messageId) : Promise.resolve({ ok: true, data: undefined })
        }
        onBlock={() => (reportTarget ? room.block(reportTarget.participantId) : Promise.resolve({ ok: true, data: undefined }))}
      />
    </div>
  );
}
