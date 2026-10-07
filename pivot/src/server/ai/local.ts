import "server-only";
import { answerLocally } from "@/lib/engine/ask";
import type { AIProvider } from "./provider";

/**
 * The built-in provider: no external calls. Summaries come from the
 * engine's template; answers from the engine's topic matcher. Used when no
 * AI key is configured, when a company turns AI narratives off, and as the
 * fallback when the AI service fails.
 */
export const localProvider: AIProvider = {
  id: "local",
  label: "PIVOT analysis engine",
  async summarize() {
    return null;
  },
  async *answer({ question, analysis }) {
    const { answer } = answerLocally(question, analysis);
    // Stream in small pieces so the UI behaves the same as with an AI provider.
    for (const piece of answer.match(/\S+\s*/g) ?? [answer]) yield piece;
  },
};
