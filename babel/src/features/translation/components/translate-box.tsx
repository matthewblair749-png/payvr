"use client";

import clsx from "clsx";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Button, Kbd } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Babi, type BabiMood } from "@/features/brand/babi";
import { useIsMac } from "@/lib/use-platform";
import { getLanguage, type LanguageCode } from "../languages";
import { DEMO_MAX_CHARS } from "../limits";
import { DEFAULT_PHRASE, lookupPhrase, PHRASEBOOK } from "../phrasebook";
import type { TranslateResponse, TranslationResult } from "../types";
import { AnimatedText } from "./animated-text";
import { LanguagePicker } from "./language-picker";

type Shown = Pick<TranslationResult, "text" | "from" | "to" | "provider"> & { id: number };

type Status =
  | { kind: "ready" }
  | { kind: "loading" }
  | { kind: "note"; message: string; tone: "info" | "error"; upgrade?: boolean };

const INITIAL: Shown = { id: 0, text: DEFAULT_PHRASE.translations.es, from: "en", to: "es", provider: "preview" };

const looksLikeLink = (text: string) => /^https?:\/\/\S+$/i.test(text.trim());

/**
 * A short, deliberate beat before a preview sentence resolves, so the
 * translation reads as an event rather than a swap. Real requests take
 * their own time and get no extra wait.
 */
const PREVIEW_BEAT_MS = 320;
/** How long Babi stays bright after a translation lands. */
const HAPPY_MS = 1100;
const FIRST_KEY = "babel:first-translation";

/**
 * The product's signature moment: type or paste, pick a language, and watch
 * the words resolve. Every input answers within 100ms (the chip selects,
 * Babi starts thinking, the old text steps back), and the result space is
 * reserved so nothing jumps.
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
  const [celebrate, setCelebrate] = useState<"happy" | "celebrate" | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const nextId = useRef(1);
  const ids = { input: useId(), into: useId(), result: useId(), count: useId() };
  const isMac = useIsMac();

  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));

  /** Shows a finished translation and lets Babi react. */
  const land = useCallback((next: Omit<Shown, "id">) => {
    setShown({ id: nextId.current++, ...next });
    setStatus({ kind: "ready" });
    setAnnouncement(`Translated into ${getLanguage(next.to).name}: ${next.text}`);
    let first = false;
    try {
      first = !localStorage.getItem(FIRST_KEY);
      if (first) localStorage.setItem(FIRST_KEY, "1");
    } catch {
      // Storage blocked: just be happy.
    }
    setCelebrate(first ? "celebrate" : "happy");
    timers.current.push(setTimeout(() => setCelebrate(null), first ? HAPPY_MS + 500 : HAPPY_MS));
  }, []);

  const run = useCallback(
    async (input: string, to: LanguageCode) => {
      abortRef.current?.abort();
      timers.current.forEach(clearTimeout);
      timers.current = [];
      setCelebrate(null);

      if (!input.trim()) {
        setStatus({ kind: "note", tone: "info", message: "Type or paste something and I'll translate it." });
        return;
      }
      if (looksLikeLink(input)) {
        setStatus({
          kind: "note",
          tone: "info",
          message: "Ooh, a link! Reading whole pages is coming soon. For now, paste the words themselves and I'll translate them.",
        });
        return;
      }

      setStatus({ kind: "loading" });

      // Hand-checked phrases are answered on the device for the public demo.
      // Signed in, everything goes through the server so it counts as usage.
      const local = countUsage ? null : lookupPhrase(input, to);
      if (local) {
        timers.current.push(setTimeout(() => land({ text: local.text, from: local.from, to, provider: "preview" }), PREVIEW_BEAT_MS));
        return;
      }

      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: input, to }),
          signal: controller.signal,
        });
        const data = (await res.json()) as TranslateResponse;
        if (data.ok) {
          land(data.result);
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
        setStatus({
          kind: "note",
          tone: "error",
          message: navigator.onLine
            ? "Sorry, I couldn't reach the translator just now. Give it another go in a moment."
            : "You're offline, so I can't translate new text right now. I'll be ready when you're back.",
        });
      }
    },
    [countUsage, land, onTranslated],
  );

  useEffect(
    () => () => {
      abortRef.current?.abort();
      timers.current.forEach(clearTimeout);
    },
    [],
  );

  function chooseTarget(code: LanguageCode) {
    if (code === target && status.kind !== "note") return;
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
      later(() => setCopied(false), 1600);
    } catch {
      setStatus({ kind: "note", tone: "error", message: "Your browser wouldn't let me copy that. You can select the text and copy it yourself." });
    }
  }

  const language = getLanguage(shown.to);
  const detected = shown.from !== "unknown" && shown.from !== shown.to ? getLanguage(shown.from).name : null;
  const loading = status.kind === "loading";
  const overLimit = text.length > DEMO_MAX_CHARS;
  const isLink = looksLikeLink(text);

  const mood: BabiMood = loading
    ? "thinking"
    : celebrate
      ? celebrate
      : status.kind === "note"
        ? status.tone === "error"
          ? "sorry"
          : isLink
            ? "curious"
            : "idle"
        : isLink
          ? "curious"
          : "idle";

  return (
    <div id="try" className="relative scroll-mt-24 pt-12 sm:pt-20">
      {/* Babi sits on the card's top edge, reacting to everything below */}
      <div className="pointer-events-none absolute right-4 top-0 z-10 w-20 sm:right-8 sm:w-28">
        <Babi mood={mood} wave="first-visit" autoSleep label={moodLabel(mood)} />
      </div>

      <div className="relative overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--inset-highlight),var(--shadow-float)]">
        {/* Input */}
        <div className="p-4 sm:p-6">
          <div className="relative">
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
              onPaste={() => setCelebrate(null)}
              dir="auto"
              rows={3}
              placeholder=" "
              aria-describedby={ids.count}
              className="peer block min-h-28 w-full resize-none rounded-lg border border-border bg-surface-2 px-4 pb-8 pt-8 text-base sm:min-h-32 sm:text-lg text-fg transition-[border-color,box-shadow] duration-[var(--dur-base)] ease-out hover:border-border-strong focus-visible:border-focus focus-visible:shadow-[0_0_0_3px_var(--violet-wash)] focus-visible:outline-none"
            />
            <label
              htmlFor={ids.input}
              className="pointer-events-none absolute left-4 top-6 origin-left text-base font-semibold text-fg-3 transition-transform duration-[var(--dur-base)] ease-spring peer-focus:-translate-y-3 peer-focus:scale-[0.8] peer-[:not(:placeholder-shown)]:-translate-y-3 peer-[:not(:placeholder-shown)]:scale-[0.8]"
            >
              Type or paste anything
            </label>
            <span
              id={ids.count}
              data-numeric
              className={clsx("pointer-events-none absolute bottom-2 right-3 text-xs", overLimit ? "font-bold text-danger" : "text-fg-3")}
            >
              {text.length.toLocaleString("en-US")} / {DEMO_MAX_CHARS.toLocaleString("en-US")}
            </span>
          </div>

          <div className="mt-3 flex items-center gap-3">
            {/* One row on every width: the samples scroll sideways on phones */}
            <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto [mask-image:linear-gradient(to_right,black_calc(100%-24px),transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <span className="shrink-0 text-sm text-fg-3">Try</span>
              {PHRASEBOOK.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => pickSuggestion(p.source)}
                  className="press min-h-11 shrink-0 rounded-full border border-border px-3 text-sm font-semibold text-fg-2 hover:border-border-strong hover:text-fg"
                >
                  {p.label}
                </button>
              ))}
            </div>
            <Button size="sm" onClick={() => void run(text, target)} disabled={loading || overLimit} className="shrink-0">
              Translate
              <span className="hidden items-center gap-1 sm:inline-flex" aria-hidden>
                <Kbd className="border-accent-fg/25 bg-transparent text-accent-fg shadow-none">{isMac ? "⌘" : "Ctrl"}</Kbd>
                <Kbd className="border-accent-fg/25 bg-transparent text-accent-fg shadow-none">↵</Kbd>
              </span>
            </Button>
          </div>
        </div>

        {/* Languages */}
        <div className="border-y border-border">
          <p id={ids.into} className="sr-only">
            Read it in
          </p>
          <LanguagePicker value={target} onChange={chooseTarget} labelledBy={ids.into} />
        </div>

        {/* Output */}
        <div className="bg-surface-3 p-4 sm:p-6" aria-busy={loading}>
          <div className="flex min-h-8 items-center justify-between gap-3">
            <p id={ids.result} className="font-display text-lg font-extrabold">
              {status.kind === "note" ? "Babi says" : `In ${language.native}`}
            </p>
            {status.kind !== "note" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--fg)_6%,transparent)] px-3 py-1 text-xs font-bold uppercase tracking-[0.06em] text-fg-2">
                {loading ? (
                  "Translating…"
                ) : shown.provider === "preview" ? (
                  <>
                    <Icon name="check" size={16} />
                    Preview · hand-checked
                  </>
                ) : (
                  <>
                    <Icon name="sparkle" size={16} />
                    Live
                  </>
                )}
              </span>
            )}
          </div>

          {/* Reserved height: switching languages never shifts the page */}
          <div className="mt-2 min-h-24">
            {status.kind === "note" ? (
              <div className="fade-up text-lg text-fg">
                <p>{status.message}</p>
                {status.upgrade && (
                  <a href="/pricing" className="mt-2 inline-flex min-h-11 items-center gap-1 font-bold text-accent-text underline-offset-4 hover:underline">
                    See plans <Icon name="arrowRight" size={16} />
                  </a>
                )}
              </div>
            ) : (
              <p
                key={shown.id}
                lang={shown.to}
                dir={language.dir}
                className={clsx(
                  "text-2xl font-semibold text-fg transition-opacity duration-[var(--dur-base)] ease-out sm:text-3xl sm:font-bold sm:tracking-[-0.01em]",
                  loading && "opacity-35",
                )}
              >
                {shown.id === 0 ? shown.text : <AnimatedText text={shown.text} lang={shown.to} />}
              </p>
            )}
          </div>

          {status.kind !== "note" && (
            <div className="mt-3 flex min-h-11 items-center justify-between gap-3">
              <p className="text-sm text-fg-3">{detected ? `From ${detected}` : " "}</p>
              <Button variant="ghost" size="sm" onClick={copy} className="-mr-3 font-sans">
                <span key={copied ? "y" : "n"} className="fade-up inline-flex">
                  <Icon name={copied ? "check" : "copy"} size={16} />
                </span>
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Screen readers hear each finished translation once, in full */}
      <p className="sr-only-live" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}

function moodLabel(mood: BabiMood): string {
  switch (mood) {
    case "thinking":
      return "Babi, thinking";
    case "happy":
    case "celebrate":
      return "Babi, delighted";
    case "sorry":
      return "Babi, looking apologetic";
    case "curious":
      return "Babi, curious";
    default:
      return "Babi, the Babel mascot";
  }
}
