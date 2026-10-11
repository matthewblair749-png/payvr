"use client";

import clsx from "clsx";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { PreviewBadge } from "@/components/ui/preview-badge";
import { Mascot } from "@/features/brand/mascot";
import { getLanguage, LANGUAGES, type LanguageCode } from "../languages";
import { DEFAULT_PHRASE, lookupPhrase, PHRASEBOOK } from "../phrasebook";
import { DEMO_MAX_CHARS } from "../limits";
import type { TranslateResponse, TranslationResult } from "../types";
import { AnimatedText } from "./animated-text";

type Shown = Pick<TranslationResult, "text" | "from" | "to" | "provider"> & { id: number };

type Status =
  | { kind: "ready" }
  | { kind: "loading" }
  | { kind: "note"; message: string; tone: "info" | "error"; upgrade?: boolean };

const INITIAL: Shown = {
  id: 0,
  text: DEFAULT_PHRASE.translations.es,
  from: "en",
  to: "es",
  provider: "preview",
};

const looksLikeLink = (text: string) => /^https?:\/\/\S+$/i.test(text.trim());

/**
 * The hero demo: type or paste, pick a language chip, watch it translate.
 * Starts pre-filled so there's never an empty box. On the public demo,
 * phrasebook sentences are answered instantly on the client; anything else
 * (and everything when countUsage is set) goes to /api/translate.
 */
export function TranslateBox({
  countUsage = false,
  onTranslated,
}: {
  countUsage?: boolean;
  /** Called after each successful server translation. */
  onTranslated?: () => void;
} = {}) {
  const [text, setText] = useState(DEFAULT_PHRASE.source);
  const [target, setTarget] = useState<LanguageCode>("es");
  const [shown, setShown] = useState<Shown>(INITIAL);
  const [status, setStatus] = useState<Status>({ kind: "ready" });
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const nextId = useRef(1);
  const ids = { input: useId(), chips: useId(), result: useId(), count: useId() };

  const run = useCallback(async (input: string, to: LanguageCode) => {
    abortRef.current?.abort();

    if (!input.trim()) {
      setStatus({ kind: "note", tone: "info", message: "Type or paste something above and I'll translate it." });
      return;
    }
    if (looksLikeLink(input)) {
      setStatus({
        kind: "note",
        tone: "info",
        message: "Reading whole pages from a link is on its way. For now, paste the words themselves and I'll translate them.",
      });
      return;
    }

    // Hand-checked phrases need no network round trip on the public demo.
    // Signed in, everything goes through the server so it counts as usage.
    const local = countUsage ? null : lookupPhrase(input, to);
    if (local) {
      setShown({ id: nextId.current++, text: local.text, from: local.from, to, provider: "preview" });
      setStatus({ kind: "ready" });
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setStatus({ kind: "loading" });
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input, to }),
        signal: controller.signal,
      });
      const data = (await res.json()) as TranslateResponse;
      if (data.ok) {
        setShown({ id: nextId.current++, ...data.result });
        setStatus({ kind: "ready" });
        onTranslated?.();
      } else {
        setStatus({
          kind: "note",
          tone: data.code === "not_in_preview" || data.code === "limit_reached" ? "info" : "error",
          message: data.message,
          upgrade: data.code === "limit_reached",
        });
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setStatus({ kind: "note", tone: "error", message: "I couldn't reach the translator. Check your connection and try again?" });
    }
  }, [countUsage, onTranslated]);

  useEffect(() => () => abortRef.current?.abort(), []);

  function chooseTarget(code: LanguageCode) {
    setTarget(code);
    void run(text, code);
  }

  function pickSuggestion(source: string) {
    setText(source);
    void run(source, target);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(shown.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setStatus({ kind: "note", tone: "error", message: "Your browser wouldn't let me copy that. You can select the text instead." });
    }
  }

  const language = getLanguage(shown.to);
  const detected = shown.from !== "unknown" && shown.from !== shown.to ? getLanguage(shown.from).name : null;
  const loading = status.kind === "loading";
  const overLimit = text.length > DEMO_MAX_CHARS;

  return (
    <div id="try" className="relative scroll-mt-40 pt-[142px] sm:pt-[163px]">
      {/* Mascot stands on the top edge of the card */}
      <div className="pointer-events-none absolute right-4 top-0 w-[136px] sm:right-8 sm:w-[156px]">
        <Mascot mood={loading ? "thinking" : "idle"} label={loading ? "The Babel mascot, thinking" : "The Babel mascot, waving hello"} />
      </div>

      <div className="relative overflow-hidden rounded-[var(--radius-lg)] border-2 border-ink bg-paper shadow-[0_6px_0_var(--ink)]">
        {/* Input */}
        <div className="p-4 sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor={ids.input} className="font-display text-lg font-extrabold">
              Your text
            </label>
            <span id={ids.count} className={clsx("text-sm tabular-nums", overLimit ? "font-bold text-coral-text" : "text-muted")}>
              {text.length.toLocaleString("en-US")} / {DEMO_MAX_CHARS.toLocaleString("en-US")}
            </span>
          </div>
          <textarea
            id={ids.input}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void run(text, target);
              }
            }}
            dir="auto"
            rows={3}
            aria-describedby={ids.count}
            className="mt-2 block w-full resize-y rounded-[var(--radius)] border-2 border-line-strong bg-cream px-4 py-3 text-lg leading-snug text-ink transition-colors duration-150 placeholder:text-muted hover:border-ink focus-visible:border-ink"
            placeholder="Type or paste anything…"
          />

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-muted">Try one:</span>
            {PHRASEBOOK.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => pickSuggestion(p.source)}
                className="press min-h-11 rounded-full px-3 text-sm font-bold text-ink underline decoration-line-strong decoration-2 underline-offset-4 hover:bg-cream hover:decoration-coral active:scale-[0.97]"
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Target language chips */}
          <div className="mt-4">
            <p id={ids.chips} className="font-display text-lg font-extrabold">
              Read it in
            </p>
            <div role="group" aria-labelledby={ids.chips} className="mt-2 flex flex-wrap gap-2">
              {LANGUAGES.map((l) => {
                const selected = l.code === target;
                return (
                  <button
                    key={l.code}
                    type="button"
                    lang={l.code}
                    aria-pressed={selected}
                    aria-label={`${l.native} (${l.name})`}
                    onClick={() => chooseTarget(l.code)}
                    className={clsx(
                      "press min-h-11 rounded-full border-2 px-4 font-bold active:scale-[0.95]",
                      selected
                        ? "border-ink bg-ink text-cream"
                        : "border-line-strong bg-cream text-ink hover:border-ink hover:bg-white",
                    )}
                  >
                    {l.native}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button onClick={() => void run(text, target)} disabled={loading || overLimit}>
              {loading ? "Translating…" : "Translate"}
            </Button>
            <span className="hidden text-sm text-muted sm:inline">
              or press <kbd className="rounded border border-line-strong px-1.5 font-sans text-xs">Ctrl</kbd> or{" "}
              <kbd className="rounded border border-line-strong px-1.5 font-sans text-xs">⌘</kbd> +{" "}
              <kbd className="rounded border border-line-strong px-1.5 font-sans text-xs">Enter</kbd>
            </span>
          </div>
        </div>

        {/* Output */}
        <div className="border-t-2 border-ink bg-sun-tint p-4 sm:p-6" aria-busy={loading}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p id={ids.result} className="font-display text-lg font-extrabold">
              In {language.native}
            </p>
            {status.kind !== "note" &&
              (shown.provider === "preview" ? (
                <PreviewBadge>Preview · hand-checked</PreviewBadge>
              ) : (
                <PreviewBadge>Live translation</PreviewBadge>
              ))}
          </div>

          <div aria-live="polite" aria-labelledby={ids.result} className="mt-2 min-h-[4.5rem]">
            {status.kind === "note" ? (
              <div className={clsx("rounded-[var(--radius)] px-4 py-3 font-semibold", status.tone === "error" ? "bg-coral-tint" : "bg-cream")}>
                <p>{status.message}</p>
                {status.upgrade && (
                  <a href="/pricing" className="mt-2 inline-flex min-h-11 items-center font-bold text-coral-text underline underline-offset-4">
                    See plans
                  </a>
                )}
              </div>
            ) : (
              <p
                key={shown.id}
                lang={shown.to}
                dir={language.dir}
                className={clsx(
                  "text-xl font-semibold leading-snug transition-opacity duration-200 sm:text-2xl",
                  loading && "opacity-40",
                )}
              >
                <AnimatedText text={shown.text} lang={shown.to} />
              </p>
            )}
          </div>

          {status.kind !== "note" && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted">{detected ? `Translated from ${detected}` : " "}</p>
              <Button variant="quiet" onClick={copy} className="-mr-3 min-h-11 text-sm">
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
