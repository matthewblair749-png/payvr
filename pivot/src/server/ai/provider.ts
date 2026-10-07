import "server-only";
import type { Analysis, Summary } from "@/lib/engine/types";
import type { AIFacts } from "./facts";

export type ChatTurn = { role: "user" | "assistant"; text: string };

/**
 * The AI provider seam. PIVOT's numbers, insights and scores always come
 * from the deterministic engine; a provider only writes language from
 * those facts. Swap providers by adding an implementation and selecting it
 * in ./index.ts.
 */
export interface AIProvider {
  readonly id: "anthropic" | "local";
  readonly label: string;
  /** An executive summary from the facts, or null to use the engine's template. */
  summarize(facts: AIFacts, signal?: AbortSignal): Promise<Summary | null>;
  /** Stream an answer to a question about this company, from the facts only. */
  answer(input: { question: string; history: ChatTurn[]; facts: AIFacts; analysis: Analysis; signal?: AbortSignal }): AsyncGenerator<string>;
}
