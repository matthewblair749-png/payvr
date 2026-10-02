"use client";

import { answerSurveyAction } from "@/app/pay/[slug]/actions";
import { OneTapSurvey } from "@/components/checkout/one-tap-survey";
import { SuccessCheck } from "@/components/checkout/success-check";
import type { SurveyQuestionKey } from "@/lib/survey/questions";

/** Brand-colored success mark (the hosted theme isn't known on this page). */
export function CompleteCheck() {
  return (
    <div style={{ ["--co-accent" as string]: "#F04A1A", ["--co-accent-fg" as string]: "#FFFFFF" }}>
      <SuccessCheck size={72} />
    </div>
  );
}

export function CompleteSurvey({
  slug,
  sessionId,
  question,
  brandName,
}: {
  slug: string;
  sessionId: string;
  question: SurveyQuestionKey;
  brandName: string;
}) {
  return (
    <OneTapSurvey
      question={question}
      brandName={brandName}
      onAnswer={async (answer) => (await answerSurveyAction({ slug, sessionId, question, answer })).ok}
    />
  );
}
