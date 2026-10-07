import type { Analysis } from "../engine/types";

/**
 * Plans with an insight limit see the most important N insights in full; the
 * rest keep their headline (title and what happened) but not why, what it
 * means or what to do. Applied on the server, so locked text never reaches
 * the browser or the AI.
 */
export function limitInsights(a: Analysis, limit: number | null): Analysis {
  if (limit === null || a.insights.length <= limit) return a;
  return {
    ...a,
    insights: a.insights.map((i, k) => (k < limit ? i : { ...i, why: "", soWhat: "", nowWhat: "", evidence: {}, locked: true })),
  };
}
