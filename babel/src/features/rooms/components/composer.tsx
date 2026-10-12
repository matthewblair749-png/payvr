"use client";

import clsx from "clsx";
import { useEffect, useId, useRef, useState } from "react";
import { ROOMS } from "@/config/rooms";
import type { LanguageCode } from "@/features/translation/languages";
import { BROWSER_SPEECH_PRIVACY_NOTE, BrowserSpeechToText, type SpeechToText } from "../client/speech";

export function Composer({
  language,
  voiceEnabled,
  disabledReason,
  onSend,
  onTyping,
}: {
  language: LanguageCode;
  /** The room owner's plan includes voice input. */
  voiceEnabled: boolean;
  /** When set, sending is paused and this explains why. */
  disabledReason: string | null;
  onSend: (text: string) => void;
  onTyping: (typing: boolean) => void;
}) {
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [voiceNote, setVoiceNote] = useState<string | null>(null);
  const speech = useRef<SpeechToText | null>(null);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const ids = { input: useId(), count: useId(), voice: useId() };
  // Text that was already in the box when voice started; speech appends to it.
  const baseText = useRef("");

  useEffect(() => {
    speech.current = new BrowserSpeechToText();
    // Feature detection has to wait for the browser.
    setVoiceSupported(speech.current.supported);
    return () => speech.current?.stop();
  }, []);

  // Grow with the text, up to about five lines.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  const tooLong = text.length > ROOMS.maxMessageChars;
  const nearLimit = text.length > ROOMS.maxMessageChars * 0.8;
  const canSend = text.trim().length > 0 && !tooLong && !disabledReason;

  function submit() {
    if (!canSend) return;
    speech.current?.stop();
    onSend(text.trim());
    onTyping(false);
    setText("");
    textareaRef.current?.focus();
  }

  function toggleVoice() {
    const engine = speech.current;
    if (!engine) return;
    if (listening) {
      engine.stop();
      return;
    }
    setVoiceNote(null);
    baseText.current = text ? `${text.trimEnd()} ` : "";
    setListening(true);
    engine.start(language, {
      onInterim: (t) => setText(baseText.current + t),
      onFinal: (t) => {
        baseText.current = `${baseText.current}${t} `;
        setText(baseText.current);
      },
      onError: (message) => setVoiceNote(message),
      onEnd: () => setListening(false),
    });
  }

  const showVoice = voiceEnabled && voiceSupported;

  return (
    <div className="border-t-2 border-ink bg-paper px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 sm:px-4">
      {disabledReason && (
        <p role="status" className="mb-2 rounded-[var(--radius)] bg-sun-tint px-3 py-2 text-sm font-semibold">
          {disabledReason}
        </p>
      )}
      {(listening || voiceNote) && (
        <p id={ids.voice} role="status" className="mb-2 text-sm text-muted">
          {voiceNote ?? (
            <>
              <span className="font-bold text-ink">Listening…</span> Voice input is an early version.{" "}
              {BROWSER_SPEECH_PRIVACY_NOTE}
            </>
          )}
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex items-end gap-2"
      >
        <label htmlFor={ids.input} className="sr-only">
          Your message
        </label>
        <textarea
          id={ids.input}
          ref={textareaRef}
          value={text}
          rows={1}
          dir="auto"
          onChange={(e) => {
            setText(e.target.value);
            onTyping(e.target.value.length > 0);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          aria-describedby={nearLimit ? ids.count : undefined}
          placeholder="Write in your language…"
          className="min-h-12 flex-1 resize-none rounded-[var(--radius)] border-2 border-line-strong bg-white px-4 py-2.5 text-base leading-snug hover:border-ink focus-visible:border-ink"
        />
        {showVoice && (
          <button
            type="button"
            onClick={toggleVoice}
            aria-pressed={listening}
            aria-label={listening ? "Stop voice input" : "Speak instead of typing (early version)"}
            title="Voice input (early version)"
            className={clsx(
              "press flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-ink active:scale-95",
              listening ? "bg-coral text-ink" : "bg-white text-ink hover:bg-sun-tint",
            )}
          >
            <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
            </svg>
          </button>
        )}
        <button
          type="submit"
          disabled={!canSend}
          aria-label="Send message"
          className="press flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-coral text-ink shadow-[0_3px_0_var(--ink)] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-[0_1px_0_var(--ink)] disabled:opacity-40 disabled:shadow-none"
        >
          <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 12h13M13 6l6 6-6 6" />
          </svg>
        </button>
      </form>
      <div className="mt-1 flex justify-between gap-2 px-1 text-xs text-muted">
        <span className="hidden sm:inline">Enter to send, Shift + Enter for a new line</span>
        {showVoice && !listening && <span className="font-semibold">Voice input: early version</span>}
        {nearLimit && (
          <span id={ids.count} className={clsx("ml-auto tabular-nums", tooLong && "font-bold text-coral-text")}>
            {text.length.toLocaleString("en-US")} / {ROOMS.maxMessageChars.toLocaleString("en-US")}
          </span>
        )}
      </div>
    </div>
  );
}
