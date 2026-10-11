"use client";

import clsx from "clsx";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { PreviewBadge } from "@/components/ui/preview-badge";

type Person = "sam" | "ana";

const PEOPLE: Record<Person, { name: string; lang: "en" | "es"; languageName: string }> = {
  sam: { name: "Sam", lang: "en", languageName: "English" },
  ana: { name: "Ana", lang: "es", languageName: "Español" },
};

/** Scripted conversation. Every line and its translation is hand-checked. */
const SCRIPT: { from: Person; original: string; translated: string }[] = [
  {
    from: "sam",
    original: "Hi! Is the apartment still available for next weekend?",
    translated: "¡Hola! ¿El departamento sigue disponible para el próximo fin de semana?",
  },
  {
    from: "ana",
    original: "¡Sí! Llegan el viernes, ¿verdad? Les dejo las llaves con mi vecina.",
    translated: "Yes! You're arriving on Friday, right? I'll leave the keys with my neighbor.",
  },
  {
    from: "sam",
    original: "Perfect. Is there a good place for tacos nearby?",
    translated: "Perfecto. ¿Hay algún buen lugar de tacos cerca?",
  },
  {
    from: "ana",
    original: "Hay una taquería en la esquina. Pidan los de pastor, no se van a arrepentir.",
    translated: "There's a taquería on the corner. Get the al pastor, you won't regret it.",
  },
];

export function ChatDemo() {
  const reduce = useReducedMotion() ?? false;
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const [viewer, setViewer] = useState<Person>("sam");
  const [visible, setVisible] = useState(0);
  const [typing, setTyping] = useState<Person | null>(null);
  const [run, setRun] = useState(0);
  const [showOriginal, setShowOriginal] = useState<Set<number>>(new Set());

  // Play the script once the phone scrolls into view.
  useEffect(() => {
    if (!inView || reduce) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let at = 400;
    SCRIPT.forEach((line, i) => {
      timers.push(setTimeout(() => setTyping(line.from), at));
      at += 1100;
      timers.push(
        setTimeout(() => {
          setTyping(null);
          setVisible(i + 1);
        }, at),
      );
      at += 900;
    });
    return () => timers.forEach(clearTimeout);
  }, [inView, reduce, run]);

  function replay() {
    setVisible(0);
    setShowOriginal(new Set());
    setRun((r) => r + 1);
  }

  function toggleOriginal(i: number) {
    setShowOriginal((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  const other: Person = viewer === "sam" ? "ana" : "sam";
  // Reduced motion: skip the playback and show the whole conversation.
  const count = reduce ? SCRIPT.length : visible;
  const done = count === SCRIPT.length;

  return (
    <div ref={ref} className="w-full max-w-[420px]">
      {/* Whose screen are we looking at? */}
      <div role="group" aria-label="Whose screen to show" className="mb-4 grid grid-cols-2 gap-1 rounded-full border-2 border-line-strong p-1">
        {(["sam", "ana"] as const).map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={viewer === p}
            onClick={() => setViewer(p)}
            className={clsx(
              "press min-h-11 rounded-full px-3 text-sm font-bold active:scale-[0.97]",
              viewer === p ? "bg-sun text-ink" : "text-cream hover:bg-white/10",
            )}
          >
            {PEOPLE[p].name}&rsquo;s screen <span className="font-semibold opacity-80">· {PEOPLE[p].languageName}</span>
          </button>
        ))}
      </div>

      <div className="on-light overflow-hidden rounded-[var(--radius-xl)] border-2 border-ink-deep bg-cream text-ink shadow-[0_8px_0_var(--ink-deep)]">
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
          <div>
            <p className="font-display text-base font-extrabold">Weekend in Mexico City</p>
            <p className="flex items-center gap-1.5 text-xs text-muted">
              <span aria-hidden className="size-2 rounded-full bg-[#2f9e5b]" /> Sam and Ana are here
            </p>
          </div>
          <PreviewBadge>Preview</PreviewBadge>
        </div>

        <ol className="flex min-h-[380px] flex-col gap-3 px-3 py-4 sm:px-4" aria-live="polite">
          <AnimatePresence initial={false}>
            {SCRIPT.slice(0, count).map((line, i) => {
              const mine = line.from === viewer;
              const original = showOriginal.has(i);
              // You always see your own words as you wrote them.
              const text = mine || original ? line.original : line.translated;
              const lang = mine || original ? PEOPLE[line.from].lang : PEOPLE[viewer].lang;
              return (
                <motion.li
                  key={`${run}-${i}`}
                  layout={!reduce}
                  initial={reduce ? false : { opacity: 0, y: 12, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 380, damping: 28 }}
                  className={clsx("flex max-w-[85%] flex-col", mine ? "items-end self-end" : "items-start self-start")}
                >
                  <span className="mb-1 px-1 text-xs font-bold text-muted">{PEOPLE[line.from].name}</span>
                  {mine ? (
                    <p lang={lang} className="rounded-[20px] rounded-br-md bg-ink px-4 py-2.5 text-cream">
                      {text}
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={() => toggleOriginal(i)}
                      aria-pressed={original}
                      className="press rounded-[20px] rounded-bl-md border-2 border-line bg-white px-4 py-2.5 text-left text-ink hover:border-line-strong active:scale-[0.98]"
                    >
                      <span lang={lang} className="block">
                        {text}
                      </span>
                      <span className="mt-1 block text-xs font-bold text-coral-text">
                        {original ? `Original · ${PEOPLE[line.from].languageName} · tap for ${PEOPLE[viewer].languageName}` : "Tap to see the original"}
                      </span>
                    </button>
                  )}
                </motion.li>
              );
            })}
          </AnimatePresence>
          {typing && (
            <li className={clsx("flex items-center gap-2 px-1 text-sm text-muted", typing === viewer ? "self-end" : "self-start")}>
              <span className="flex gap-1" aria-hidden>
                {[0, 1, 2].map((d) => (
                  <motion.span
                    key={d}
                    className="size-1.5 rounded-full bg-muted"
                    animate={{ y: [0, -3, 0] }}
                    transition={{ duration: 0.6, repeat: Infinity, delay: d * 0.12 }}
                  />
                ))}
              </span>
              {PEOPLE[typing].name} is typing
            </li>
          )}
        </ol>
      </div>

      <div className="mt-4 flex min-h-12 items-center justify-between gap-2">
        <p className="text-sm text-muted">
          {viewer === "sam" ? "Sam" : "Ana"} reads {PEOPLE[other].name}&rsquo;s messages in {PEOPLE[viewer].languageName}.
        </p>
        {done && !reduce && (
          <Button variant="outline" onClick={replay} className="min-h-11 shrink-0 px-4 text-sm">
            Play again
          </Button>
        )}
      </div>
    </div>
  );
}
