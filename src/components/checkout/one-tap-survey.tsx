"use client";

/**
 * The one-tap post-purchase question. Lives on the success screen, styled
 * entirely from the checkout's --co-* theme variables.
 *
 * Optional by design: a quiet "No thanks", no required fields, and it never
 * blocks the buyer from leaving. One tap records the answer.
 */
import { AnimatePresence, m, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { useId, useState } from "react";
import { answersFor, SURVEY_QUESTIONS, type SurveyQuestionKey } from "@/lib/survey/questions";

type State = { phase: "asking" } | { phase: "sending"; answer: string } | { phase: "thanks"; answer: string } | { phase: "dismissed" };

export function OneTapSurvey({
  question,
  brandName,
  onAnswer,
  haptics = true,
}: {
  question: SurveyQuestionKey;
  brandName: string;
  /** Persist the answer. Resolve true when saved. */
  onAnswer: (answer: string) => Promise<boolean>;
  haptics?: boolean;
}) {
  const [state, setState] = useState<State>({ phase: "asking" });
  const [error, setError] = useState(false);
  const reduce = useReducedMotion();
  const titleId = useId();
  const answers = answersFor(question);

  async function choose(answer: string) {
    if (state.phase !== "asking") return;
    if (haptics && !reduce && "vibrate" in navigator) {
      try {
        navigator.vibrate(8);
      } catch {
        /* unsupported */
      }
    }
    setError(false);
    setState({ phase: "sending", answer });
    const ok = await onAnswer(answer);
    if (ok) {
      setState({ phase: "thanks", answer });
    } else {
      setError(true);
      setState({ phase: "asking" });
    }
  }

  if (state.phase === "dismissed") return null;
  const chosen = state.phase === "sending" || state.phase === "thanks" ? state.answer : null;

  return (
    <m.section
      aria-labelledby={titleId}
      initial={reduce ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: reduce ? 0 : 0.55, type: "spring", stiffness: 260, damping: 26 }}
      className="w-full rounded-(--co-radius) border border-(--co-border) bg-(--co-card) p-4 text-left"
    >
      <AnimatePresence mode="wait" initial={false}>
        {state.phase === "thanks" ? (
          <m.div
            key="thanks"
            initial={reduce ? false : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-3 py-1"
            role="status"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-(--co-accent) text-(--co-accent-fg)">
              <Check size={16} strokeWidth={3} aria-hidden="true" />
            </span>
            <p className="text-sm">
              <span className="font-semibold">Thanks!</span> That really helps {brandName.replace(/[.!?]+$/, "")}.
            </p>
          </m.div>
        ) : (
          <m.div key="ask" exit={{ opacity: 0, transition: { duration: 0.15 } }}>
            <div className="mb-3 flex items-start justify-between gap-3">
              <h3 id={titleId} className="font-semibold leading-snug">
                {SURVEY_QUESTIONS[question].prompt}
                <span className="block text-xs font-normal text-(--co-muted)">One tap, optional. It helps a small shop a lot.</span>
              </h3>
              <button
                type="button"
                onClick={() => setState({ phase: "dismissed" })}
                className="shrink-0 rounded-(--co-radius-sm) px-2 py-1 text-xs text-(--co-muted) underline-offset-2 hover:underline"
              >
                No thanks
              </button>
            </div>
            <div role="group" aria-labelledby={titleId} className="flex flex-wrap gap-2">
              {answers.map((a, i) => {
                const isChosen = chosen === a.key;
                return (
                  <m.button
                    key={a.key}
                    type="button"
                    disabled={state.phase === "sending"}
                    aria-pressed={isChosen}
                    onClick={() => choose(a.key)}
                    initial={reduce ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: chosen && !isChosen ? 0.4 : 1, y: 0, scale: isChosen ? 1.04 : 1 }}
                    transition={{ delay: reduce || chosen ? 0 : 0.65 + i * 0.05, type: "spring", stiffness: 420, damping: 28 }}
                    whileTap={reduce ? undefined : { scale: 0.95 }}
                    className="rounded-full border-2 border-(--co-border) bg-(--co-field) px-3.5 py-2 text-sm font-medium transition-colors hover:border-(--co-accent-ring) aria-pressed:border-(--co-accent-ring) aria-pressed:bg-(--co-accent) aria-pressed:text-(--co-accent-fg)"
                  >
                    {a.label}
                  </m.button>
                );
              })}
            </div>
            {error && (
              <p role="alert" className="mt-2 text-xs text-(--co-muted)">
                That didn&apos;t go through. Tap again to retry.
              </p>
            )}
          </m.div>
        )}
      </AnimatePresence>
    </m.section>
  );
}
