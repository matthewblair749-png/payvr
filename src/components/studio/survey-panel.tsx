"use client";

/** Studio: choose the one-tap question buyers see after paying. */
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EditorAction } from "@/lib/checkout/reducer";
import type { CheckoutConfig } from "@/lib/checkout/schema";
import { answersFor, SURVEY_QUESTION_KEYS, SURVEY_QUESTIONS } from "@/lib/survey/questions";

export function SurveyPanel({
  config,
  edit,
  previewing,
  onPreview,
}: {
  config: CheckoutConfig;
  edit: (a: EditorAction) => void;
  previewing: boolean;
  onPreview: (on: boolean) => void;
}) {
  const { enabled, question } = config.survey;
  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display text-xl font-bold tracking-[-0.03em]">One-tap question</h3>
        <p className="mt-1 text-sm text-muted-strong">
          Shown on the thank-you screen after payment. Optional for buyers, one tap to answer. Answers show up on your dashboard
          and feed the Research Assistant.
        </p>
      </div>

      <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl bg-surface/70 px-4 py-3 text-sm font-semibold">
        Ask a question after payment
        <input
          type="checkbox"
          role="switch"
          checked={enabled}
          onChange={(e) => edit({ type: "survey", patch: { enabled: e.target.checked } })}
          className="h-5 w-9 cursor-pointer appearance-none rounded-full bg-black/20 transition-colors before:block before:h-4 before:w-4 before:translate-x-0.5 before:rounded-full before:bg-white before:shadow before:transition-transform checked:bg-ink checked:before:translate-x-[18px]"
        />
      </label>

      <fieldset disabled={!enabled} className="space-y-2 disabled:opacity-50">
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Question</legend>
        {SURVEY_QUESTION_KEYS.map((key) => (
          <label
            key={key}
            className="block cursor-pointer rounded-2xl border-2 border-black/8 p-4 has-checked:border-ink has-focus-visible:outline-3 has-focus-visible:outline-ink"
          >
            <span className="flex items-center gap-2">
              <input
                type="radio"
                name="survey-question"
                className="accent-ink"
                checked={question === key}
                onChange={() => edit({ type: "survey", patch: { question: key } })}
              />
              <span className="font-semibold">{SURVEY_QUESTIONS[key].prompt}</span>
            </span>
            <span className="mt-2 flex flex-wrap gap-1.5 pl-5" aria-hidden="true">
              {answersFor(key).map((a) => (
                <span key={a.key} className="rounded-full bg-surface px-2.5 py-1 text-xs text-muted-strong">
                  {a.label}
                </span>
              ))}
            </span>
          </label>
        ))}
      </fieldset>

      <Button variant="outline" onClick={() => onPreview(!previewing)} aria-pressed={previewing}>
        {previewing ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
        {previewing ? "Back to the checkout" : "Preview thank-you screen"}
      </Button>
    </div>
  );
}
