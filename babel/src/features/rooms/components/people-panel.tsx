"use client";

import clsx from "clsx";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { REPORT_REASONS, type ReportReason } from "@/config/rooms";
import { getLanguage } from "@/features/translation/languages";
import type { Ack, ParticipantView } from "../protocol";
import { Sheet } from "./sheet";

const REASON_LABELS: Record<ReportReason, string> = {
  spam: "Spam or scams",
  harassment: "Harassment or threats",
  inappropriate: "Sexual or violent content",
  other: "Something else",
};

export interface ReportTarget {
  participantId: string;
  name: string;
  messageId?: string;
}

export function ReportSheet({
  target,
  onClose,
  onReport,
  onBlock,
  alreadyBlocked,
}: {
  target: ReportTarget | null;
  onClose: () => void;
  onReport: (reason: ReportReason) => Promise<Ack>;
  onBlock: () => Promise<Ack>;
  alreadyBlocked: boolean;
}) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [state, setState] = useState<{ kind: "idle" | "sending" | "sent" } | { kind: "error"; message: string }>({ kind: "idle" });

  function close() {
    setReason(null);
    setState({ kind: "idle" });
    onClose();
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!reason) return;
    setState({ kind: "sending" });
    const result = await onReport(reason);
    setState(result.ok ? { kind: "sent" } : { kind: "error", message: result.error });
  }

  return (
    <Sheet open={target !== null} onClose={close} title={target?.messageId ? "Report this message" : `Report ${target?.name ?? ""}`}>
      {state.kind === "sent" ? (
        <div className="grid gap-4">
          <p className="text-lg">Thanks for telling us. We&rsquo;ll take a look.</p>
          {!alreadyBlocked && (
            <p className="text-muted">You can also block {target?.name} so you stop seeing their messages.</p>
          )}
          <div className="flex flex-wrap gap-3">
            {!alreadyBlocked && (
              <Button
                variant="ink"
                onClick={async () => {
                  await onBlock();
                  close();
                }}
              >
                Block {target?.name}
              </Button>
            )}
            <Button variant="outline" onClick={close}>
              Done
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="grid gap-4">
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-muted">What&rsquo;s wrong? Reports go to the Babel team, not the host.</legend>
            {REPORT_REASONS.map((r) => (
              <label
                key={r}
                className={clsx(
                  "press flex min-h-12 cursor-pointer items-center gap-3 rounded-[var(--radius)] border-2 px-4 font-semibold",
                  reason === r ? "border-ink bg-sun-tint" : "border-line-strong bg-white hover:border-ink",
                )}
              >
                <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="size-5 accent-[var(--ink)]" />
                {REASON_LABELS[r]}
              </label>
            ))}
          </fieldset>
          {state.kind === "error" && (
            <p role="alert" className="rounded-[var(--radius)] bg-coral-tint px-4 py-3 font-semibold">
              {state.message}
            </p>
          )}
          <Button type="submit" disabled={!reason || state.kind === "sending"}>
            {state.kind === "sending" ? "Sending…" : "Send report"}
          </Button>
        </form>
      )}
    </Sheet>
  );
}

export function PeopleSheet({
  open,
  onClose,
  participants,
  meId,
  isOwner,
  blocked,
  roomSize,
  onBlock,
  onUnblock,
  onReport,
  onRemove,
  onCloseRoom,
}: {
  open: boolean;
  onClose: () => void;
  participants: ParticipantView[];
  meId: string;
  isOwner: boolean;
  blocked: string[];
  roomSize: number;
  onBlock: (id: string) => Promise<Ack>;
  onUnblock: (id: string) => Promise<Ack>;
  onReport: (target: ReportTarget) => void;
  onRemove: (id: string) => Promise<Ack>;
  onCloseRoom: () => Promise<Ack>;
}) {
  const [confirm, setConfirm] = useState<{ kind: "remove"; id: string; name: string } | { kind: "close" } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<Ack>) {
    setError(null);
    const result = await action();
    if (!result.ok) setError(result.error);
    setConfirm(null);
  }

  return (
    <Sheet open={open} onClose={onClose} title={`People here · ${participants.length} of ${roomSize}`}>
      {error && (
        <p role="alert" className="mb-3 rounded-[var(--radius)] bg-coral-tint px-4 py-3 font-semibold">
          {error}
        </p>
      )}
      <ul className="grid gap-2">
        {participants.map((p) => {
          const me = p.id === meId;
          const isBlocked = blocked.includes(p.id);
          return (
            <li key={p.id} className="rounded-[var(--radius)] border-2 border-line bg-white p-3">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className={clsx("size-2.5 shrink-0 rounded-full", p.online ? "bg-[#2f9e5b]" : "bg-line-strong")}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">
                    {p.name}
                    {me && <span className="font-semibold text-muted"> (you)</span>}
                    {p.role === "owner" && <span className="font-semibold text-muted"> · host</span>}
                  </p>
                  <p className="text-sm text-muted">
                    Reads {getLanguage(p.language).native} · {p.online ? "here now" : "away"}
                    {isBlocked && " · blocked"}
                  </p>
                </div>
              </div>
              {!me && (
                <div className="mt-2 flex flex-wrap gap-1">
                  <Button variant="quiet" className="min-h-11 px-3 text-sm" onClick={() => run(() => (isBlocked ? onUnblock(p.id) : onBlock(p.id)))}>
                    {isBlocked ? "Unblock" : "Block"}
                  </Button>
                  <Button variant="quiet" className="min-h-11 px-3 text-sm" onClick={() => onReport({ participantId: p.id, name: p.name })}>
                    Report
                  </Button>
                  {isOwner && p.role !== "owner" && (
                    <Button variant="quiet" className="min-h-11 px-3 text-sm text-coral-text" onClick={() => setConfirm({ kind: "remove", id: p.id, name: p.name })}>
                      Remove from room
                    </Button>
                  )}
                </div>
              )}
              {confirm?.kind === "remove" && confirm.id === p.id && (
                <div className="mt-2 rounded-[var(--radius-sm)] bg-coral-tint p-3">
                  <p className="font-semibold">Remove {confirm.name}? They won&rsquo;t be able to come back to this room.</p>
                  <div className="mt-2 flex gap-2">
                    <Button variant="ink" className="min-h-11 px-4 text-sm" onClick={() => run(() => onRemove(p.id))}>
                      Remove
                    </Button>
                    <Button variant="outline" className="min-h-11 px-4 text-sm" onClick={() => setConfirm(null)}>
                      Keep them
                    </Button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-sm text-muted">Blocking hides someone&rsquo;s messages from you only. They aren&rsquo;t told.</p>

      {isOwner && (
        <div className="mt-6 border-t-2 border-line pt-4">
          {confirm?.kind === "close" ? (
            <div className="rounded-[var(--radius)] bg-coral-tint p-4">
              <p className="font-semibold">Close the room for everyone? All messages are deleted, and the link stops working.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="ink" onClick={() => run(onCloseRoom)}>
                  Close and delete
                </Button>
                <Button variant="outline" onClick={() => setConfirm(null)}>
                  Keep it open
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" className="w-full text-coral-text" onClick={() => setConfirm({ kind: "close" })}>
              Close room for everyone
            </Button>
          )}
        </div>
      )}
    </Sheet>
  );
}
