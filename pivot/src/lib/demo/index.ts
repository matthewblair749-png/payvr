import { analyzeFacts } from "../engine/analyze";
import { computeFacts, type Facts } from "../engine/facts";
import type { Analysis, BusinessData } from "../engine/types";
import { lastCompleteMonth, northstarData } from "./northstar";

/**
 * The demo company, analyzed once per month (it's deterministic) and
 * shared by the landing page and the public /demo workspace.
 */
let cached: { key: string; data: BusinessData; facts: Facts; analysis: Analysis } | null = null;

export function getDemo(now: Date = new Date()) {
  const key = lastCompleteMonth(now);
  if (!cached || cached.key !== key) {
    const data = northstarData(now);
    const facts = computeFacts(data);
    cached = { key, data, facts, analysis: analyzeFacts(facts, data) };
  }
  return cached;
}
