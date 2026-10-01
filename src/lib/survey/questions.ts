/**
 * One-tap post-purchase questions. Stable keys are stored in SurveyResponse;
 * labels can change freely. (The buyer-facing flow ships in Phase 5.)
 */
export const SURVEY_QUESTIONS = {
  nearly_stopped: {
    prompt: "What nearly stopped you?",
    answers: {
      shipping: "Shipping cost",
      price: "The price",
      trust: "Wasn't sure it's legit",
      payment_options: "Payment options",
      nothing: "Nothing. Take my money",
    },
  },
  heard_about: {
    prompt: "Where did you hear about us?",
    answers: {
      instagram: "Instagram",
      tiktok: "TikTok",
      friend: "A friend",
      google: "Google",
      newsletter: "Newsletter",
      other: "Somewhere else",
    },
  },
} as const;

export type SurveyQuestionKey = keyof typeof SURVEY_QUESTIONS;

export function answerLabel(question: string, answer: string): string {
  const q = SURVEY_QUESTIONS[question as SurveyQuestionKey];
  return (q?.answers as Record<string, string> | undefined)?.[answer] ?? answer.replace(/_/g, " ");
}

export function questionPrompt(question: string): string {
  return SURVEY_QUESTIONS[question as SurveyQuestionKey]?.prompt ?? question.replace(/_/g, " ");
}
