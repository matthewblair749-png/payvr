import type { Analysis } from "../engine/types";

/**
 * Plans with an insight limit see the most important N insights in full; the
 * rest keep their headline (title and what happened) but not why, what it
 * means or what to do. Applied on the server, so a locked insight's explanation
 * isn't sent to the browser or the AI. (Recommendations and KPI explanations
 * aren't plan-limited, and can cover some of the same ground.)
 */
export function limitInsights(a: Analysis, limit: number | null): Analysis {
  if (limit === null || a.insights.length <= limit) return a;
  return {
    ...a,
    insights: a.insights.map((i, k) => (k < limit ? i : { ...i, why: "", soWhat: "", nowWhat: "", evidence: {}, locked: true })),
  };
}
