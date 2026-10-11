"use client";

import clsx from "clsx";
import { useState } from "react";
import { getLanguage } from "@/features/translation/languages";
import type { MessageView } from "../protocol";
import type { PendingMessage } from "../client/use-room";

function time(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function MessageBubble({
  message,
  mine,
  showName,
  onReport,
}: {
  message: MessageView;
  mine: boolean;
  showName: boolean;
  onReport?: () => void;
}) {
  const [showOriginal, setShowOriginal] = useState(false);
  const differs = message.originalLang !== message.lang;
  const canToggle = !mine && differs;
  const text = showOriginal ? message.original : message.text;
  const textLang = showOriginal ? message.originalLang : message.lang;
  const dir = getLanguage(textLang).dir;

  return (
    <li className={clsx("flex max-w-[85%] flex-col sm:max-w-[70%]", mine ? "items-end self-end" : "items-start self-start")}>
      {showName && !mine && <span className="mb-1 px-1 text-xs font-bold text-muted">{message.senderName}</span>}
      {mine ? (
        <p lang={textLang} dir={dir} className="whitespace-pre-wrap break-words rounded-[20px] rounded-br-md bg-ink px-4 py-2.5 text-cream">
          {text}
        </p>
      ) : (
        <button
          type="button"
          onClick={() => canToggle && setShowOriginal((s) => !s)}
          aria-pressed={canToggle ? showOriginal : undefined}
          disabled={!canToggle}
          className="press whitespace-pre-wrap break-words rounded-[20px] rounded-bl-md border-2 border-line bg-white px-4 py-2.5 text-left text-ink enabled:hover:border-line-strong enabled:active:scale-[0.98] disabled:cursor-text"
        >
          <span lang={textLang} dir={dir} className="block">
            {text}
          </span>
          {canToggle && (
            <span className="mt-1 block text-xs font-bold text-coral-text">
              {showOriginal
                ? `Original · ${getLanguage(message.originalLang).native} · tap for ${getLanguage(message.lang).native}`
                : "Tap to see the original"}
            </span>
          )}
          {!message.translated && (
            <span className="mt-1 block text-xs font-bold text-muted">Couldn&rsquo;t translate this one, so here&rsquo;s the original.</span>
          )}
        </button>
      )}
      <span className="mt-1 flex items-center gap-2 px-1 text-xs text-muted">
        <time dateTime={message.createdAt}>{time(message.createdAt)}</time>
        {onReport && (
          <button type="button" onClick={onReport} className="press min-h-8 rounded px-1 font-semibold underline-offset-2 hover:underline">
            Report
          </button>
        )}
      </span>
    </li>
  );
}

export function PendingBubble({ item, onRetry, onDiscard }: { item: PendingMessage; onRetry: () => void; onDiscard: () => void }) {
  return (
    <li className="flex max-w-[85%] flex-col items-end self-end sm:max-w-[70%]">
      <p
        className={clsx(
          "whitespace-pre-wrap break-words rounded-[20px] rounded-br-md px-4 py-2.5",
          item.state === "failed" ? "border-2 border-coral bg-coral-tint text-ink" : "bg-ink/70 text-cream",
        )}
      >
        {item.text}
      </p>
      <span className="mt-1 flex items-center gap-2 px-1 text-xs text-muted" role={item.state === "failed" ? "alert" : undefined}>
        {item.state === "sending" && "Sending…"}
        {item.state === "waiting" && "Waiting for connection. It'll send when you're back."}
        {item.state === "failed" && (
          <>
            <span className="font-semibold text-ink">{item.error ?? "Didn't send."}</span>
            <button type="button" onClick={onRetry} className="press min-h-8 rounded px-1 font-bold text-coral-text underline">
              Try again
            </button>
            <button type="button" onClick={onDiscard} className="press min-h-8 rounded px-1 font-semibold underline">
              Delete
            </button>
          </>
        )}
      </span>
    </li>
  );
}
