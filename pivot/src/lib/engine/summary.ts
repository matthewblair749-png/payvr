import { money, monthLabel, pct, pctDelta } from "../format";
import type { Facts } from "./facts";
import type { Analysis, Summary } from "./types";

/**
 * The written executive summary, built from facts alone. This is what the
 * built-in (local) AI provider returns, and the fallback whenever an AI
 * provider is unavailable or its answer fails grounding checks.
 */
export function templateSummary(f: Facts, a: Pick<Analysis, "insights" | "recommendations" | "health">): Summary {
  const cur = f.currency;
  const month = f.period ? monthLabel(f.period).split(" ")[0] : "This month";
  const r = f.revenue;
  if (!r) return { headline: "Not enough data yet.", body: "Upload at least two months of revenue to get your first summary." };

  const up = (r.change ?? 0) >= 0;
  const problems = a.insights.filter((i) => i.severity === "ACTION" || i.severity === "WATCH");
  const top = a.recommendations[0];

  const issue = problems[0];
  const issueShort = issue
    ? issue.key === "retention-decline"
      ? "retention needs attention"
      : issue.key === "cac-rising"
        ? "acquisition costs are climbing"
        : issue.key === "revenue-decline"
          ? "the trend needs a closer look"
          : (() => {
              const t = issue.title.replace(/\.$/, "");
              return t.charAt(0).toLowerCase() + t.slice(1);
            })()
    : null;

  const headline =
    r.change === null
      ? `${money(r.now, cur)} revenue in ${month}.`
      : `Revenue is ${up ? "up" : "down"} ${pctDelta(r.change).replace(/^[+−]/, "")}${issueShort ? `, but ${issueShort}` : ""}.`;

  const parts: string[] = [];
  const drivers: string[] = [];
  if (f.customers?.change != null && f.customers.change > 0 && up) drivers.push(`${pctDelta(f.customers.change)} more customers`.replace("+", ""));
  if (f.topMover?.demand60 != null && up) drivers.push(`${f.topMover.name} (${pctDelta(f.topMover.demand60, 0)} demand in 60 days)`);
  parts.push(
    `${month} revenue ${up ? "grew" : "fell"} ${r.change !== null ? pctDelta(r.change).replace(/^[+−]/, "") + " " : ""}to ${money(r.now, cur)}${r.fastestGrowth ? `, its fastest growth in ${f.months} months` : ""}${drivers.length ? `, driven by ${drivers.join(" and ")}` : ""}.`,
  );

  const against: string[] = [];
  if (f.retention?.change != null && f.retention.change <= -0.005)
    against.push(`retention fell to ${pct(f.retention.now)}${f.churnDriver ? `, led by ${f.churnDriver.segment.name.toLowerCase()} customers` : ""}`);
  if (f.cac?.change != null && f.cac.change >= 0.1) against.push(`each new customer now costs ${pctDelta(f.cac.change, 0).replace("+", "")} more`);
  if (f.profit?.change != null && f.profit.change < 0) against.push(`profit fell ${pctDelta(f.profit.change).replace("−", "")}`);
  if (against.length) {
    parts.push(`${against.length === 1 ? "One thing is" : `${against.length === 2 ? "Two" : "Three"} things are`} working against it: ${against.join(", and ")}.`);
  }
  if (top) parts.push(`PIVOT's top recommendation is to ${top.title.charAt(0).toLowerCase()}${top.title.slice(1)}, worth about ${money(top.annualImpact, cur)} over the next year.`);

  return { headline, body: parts.join(" ") };
}
