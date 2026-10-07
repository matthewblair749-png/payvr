import { int, money, monthLabel, pct, pctDelta } from "../format";
import type { Analysis, Insight } from "./types";

/**
 * Ask PIVOT, built-in answerer. Matches the question to a topic and answers
 * from the analysis only. When the data can't answer, it says so plainly
 * and suggests what it can answer. Used when no AI provider is configured,
 * and as the fallback when one fails.
 */

export const EXAMPLE_QUESTIONS = [
  "What is hurting our growth?",
  "Which product is performing best?",
  "What should we focus on?",
  "Why did revenue change?",
  "Show me our biggest opportunities.",
];

export interface LocalAnswer {
  answer: string;
  /** Topics the answer drew on, for "Based on" chips. */
  sources: string[];
}

const UNAVAILABLE: [RegExp, string][] = [
  [/\bcompetitor|competition|rival/, "competitors"],
  [/\bemployee|staff|hiring|headcount|payroll|salar/, "employees or payroll"],
  [/\binventory|stock level|warehouse|supplier/, "inventory or suppliers"],
  [/\bcountr|region|city|cities|state|geograph|international|location/, "locations or regions"],
  [/\bstock price|share price|valuation|investor|fundrais/, "valuation or investors"],
  [/\bweather|season(al)? forecast/, "outside factors like weather"],
  [/\bnps|review|rating|satisfaction|sentiment|feedback/, "customer feedback or reviews"],
  [/\bweb ?site speed|page speed|bounce|seo|keyword/, "website analytics beyond visitors"],
];

const has = (q: string, re: RegExp) => re.test(q);

/** An insight's "why", or for one beyond the plan's insight limit (blanked on the server), a pointer to Pro instead of nothing. */
const whyOf = (i: Insight) => (i.locked ? "Why it happened and what to do about it are on Pro." : i.why);
const nowWhatOf = (i: Insight) => (i.locked ? "" : ` ${i.nowWhat}`);

export function answerLocally(question: string, a: Analysis): LocalAnswer {
  const q = question.toLowerCase().trim();
  const cur = a.company.currency;
  const month = a.period ? monthLabel(a.period) : "the latest month";
  const kpi = (k: string) => a.kpis.find((x) => x.key === k);

  if (!a.kpis.length) {
    return { answer: "There's no business data in this workspace yet, so I can't answer that. Upload a CSV in Data and I'll analyze it.", sources: [] };
  }

  // Questions about data this workspace doesn't have: say so, don't guess.
  for (const [re, what] of UNAVAILABLE) {
    if (has(q, re)) {
      const topics = ["revenue", "customers", a.coverage.metrics.includes("marketingSpend") ? "marketing" : null, a.coverage.hasProducts ? "products" : null, a.coverage.hasSegments ? "customer segments" : null]
        .filter(Boolean)
        .join(", ");
      return {
        answer: `Your data doesn't include ${what}, so I can't answer that without guessing. I can answer questions about ${topics}.`,
        sources: [],
      };
    }
  }

  if (has(q, /\b(hurt|hurting|problem|wrong|risk|worr|concern|threat|bad|slow|holding)/)) {
    const bad = a.insights.filter((i) => i.severity !== "OPPORTUNITY").slice(0, 3);
    if (!bad.length) return { answer: `Nothing in your data looks like it's hurting growth right now. Revenue in ${month}: ${kpi("revenue")?.display ?? "n/a"}.`, sources: ["Insights"] };
    return {
      answer: [`${bad.length === 1 ? "One thing stands out" : `${bad.length} things stand out`}:`, ...bad.map((i, k) => `${k + 1}. **${i.title.replace(/\.$/, "")}.** ${i.what} ${whyOf(i)}`)].join("\n"),
      sources: ["Insights"],
    };
  }

  if (has(q, /\bproduct|best.?sell|perform(ing)? best|top seller/)) {
    if (!a.coverage.hasProducts) return { answer: "Your data doesn't break revenue down by product, so I can't compare products. Add a product column to your upload to unlock this.", sources: [] };
    const ins = a.insights.find((i) => i.key === "product-momentum");
    const chart = a.opportunities.find((o) => o.key === "expand-product");
    const lines = [ins ? `**${ins.title.replace(/\.$/, "")}.** ${ins.what} ${whyOf(ins)}` : null, chart ? `It's also your top opportunity (PIVOT Score ${chart.score}): ${chart.title.toLowerCase()}.` : null].filter(Boolean);
    return { answer: lines.length ? lines.join("\n") : "Your products are growing roughly in line with each other; none stands out this month.", sources: ["Products", "Opportunities"] };
  }

  if (has(q, /\bfocus|priorit|should we|what should|next move|recommend|advice|first/)) {
    const recs = a.recommendations.slice(0, 3);
    if (!recs.length) return { answer: "I don't have a recommendation yet. Upload more months of data so I can see trends.", sources: [] };
    return {
      answer: ["Here's what I'd focus on, in order:", ...recs.map((r) => `${r.rank}. **${r.title}** (impact ${r.impact.toLowerCase()}, about ${money(r.annualImpact, cur)} a year). ${r.reasoning}`)].join("\n"),
      sources: ["Recommendations"],
    };
  }

  if (has(q, /\bopportunit|upside|grow faster|where can we grow/)) {
    const ops = a.opportunities.slice(0, 3);
    if (!ops.length) return { answer: "I haven't found clear opportunities in your data yet. Product, channel and segment breakdowns help me find them.", sources: [] };
    return {
      answer: ["Your biggest opportunities:", ...ops.map((o, k) => `${k + 1}. **${o.title}** — PIVOT Score ${o.score}, about ${money(o.annualImpact, cur)} a year. ${o.whyFound.split(/(?<=\.)\s/)[0]}`)].join("\n"),
      sources: ["Opportunities"],
    };
  }

  if (has(q, /\bretention|churn|leav|losing customers|lost customers|stay/)) {
    const k = kpi("retention");
    if (!k) return { answer: "Your data doesn't include enough customer detail to measure retention. Add customers plus churned (or new) customers per month.", sources: [] };
    return { answer: `${k.explain.what} ${k.explain.why} ${k.explain.soWhat} ${k.explain.nowWhat}`, sources: ["Retention"] };
  }

  if (has(q, /\bmarketing|cac|acquisition|channel|ads?\b|ad spend|campaign/)) {
    const ins = a.insights.find((i) => i.key === "cac-rising");
    if (ins) return { answer: `**${ins.title.replace(/\.$/, "")}.** ${ins.what} ${whyOf(ins)}${nowWhatOf(ins)}`, sources: ["Marketing"] };
    const dim = a.health.dimensions.find((d) => d.key === "marketing");
    if (dim) return { answer: `Marketing scores ${dim.score}/100. ${dim.reason}`, sources: ["Business Health"] };
    return { answer: "Your data doesn't include marketing spend and new customers, so I can't analyze acquisition costs.", sources: [] };
  }

  if (has(q, /\bprofit|margin|cost|expens|spend/)) {
    const k = kpi("profit");
    if (!k) return { answer: "Your data doesn't include costs, so I can't calculate profit. Add cost of goods or operating expenses.", sources: [] };
    return { answer: `${k.explain.what} ${k.explain.why} ${k.explain.soWhat}`, sources: ["Profit"] };
  }

  if (has(q, /\bforecast|next month|predict|projection|expect|next quarter|future|will we/)) {
    const fc = a.revenueChart.series.find((s) => s.kind === "forecast")?.values.filter((v): v is number => v !== null) ?? [];
    if (fc.length < 2) return { answer: "I need at least a few months of revenue to project a trend.", sources: [] };
    const end = fc[fc.length - 1];
    return {
      answer: `If the last 12 months' trend continues, monthly revenue reaches about **${money(end, cur)}** in 3 months. That's a trend line, not a promise: it doesn't know about changes you're planning. Use What If? to test those.`,
      sources: ["Revenue trend"],
    };
  }

  if (has(q, /\bwhy\b.*\brevenue|\brevenue\b.*\b(change|up|down|grow|drop|fall|rise|increase|decrease)|\bsales\b/)) {
    const k = kpi("revenue");
    if (k) return { answer: `${k.explain.what} ${k.explain.why} ${k.explain.soWhat}`, sources: ["Revenue"] };
  }

  if (has(q, /\bsegment/)) {
    if (!a.coverage.hasSegments) return { answer: "Your data doesn't include customer segments. Add a segment column to see who's buying and who's leaving.", sources: [] };
    const ins = a.insights.find((i) => i.key === "retention-decline");
    return { answer: ins ? (ins.locked ? `${ins.what} ${whyOf(ins)}` : ins.why) : "Your segments are behaving similarly this month; none stands out.", sources: ["Segments"] };
  }

  if (has(q, /\bcustomer/)) {
    const k = kpi("customers");
    if (k) return { answer: `${k.explain.what} ${k.explain.why} ${k.explain.soWhat}`, sources: ["Customers"] };
  }

  if (has(q, /\bhealth|score|how are we|how('s| is) (the )?business|overall|summar|doing|update|status/)) {
    return {
      answer: `${a.summary.headline} ${a.summary.body} Business Health is ${a.health.score}/100 (${a.health.label.toLowerCase()}).`,
      sources: ["Summary", "Business Health"],
    };
  }

  if (has(q, /\brevenue|income|turnover/)) {
    const k = kpi("revenue");
    if (k) return { answer: `${k.explain.what} ${k.explain.why}`, sources: ["Revenue"] };
  }

  const rev = kpi("revenue");
  return {
    answer: `I can only answer from your business data, and I'm not sure what you're asking. ${rev ? `For example: revenue in ${month} was ${rev.display}${rev.change !== null ? ` (${pctDelta(rev.change)})` : ""}${kpi("customers") ? ` from ${int(kpi("customers")!.value)} customers` : ""}${kpi("retention") ? ` with ${pct(kpi("retention")!.value)} retention` : ""}.` : ""} Try one of the suggested questions.`,
    sources: [],
  };
}
