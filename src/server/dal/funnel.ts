import "server-only";
import { periodWindows } from "@/lib/date-range";
import { FIELD_LABELS, LEAK_TITLES, STAGES, type StageKey } from "@/lib/tracking/events";
import { SOURCE_LABELS, VALUE_BANDS, type Source } from "@/lib/tracking/source";
import { db } from "../db";
import { n, PAID_STATUSES, sessionsCte, type AnalyticsFilter } from "./analytics";

/**
 * Home's checkout funnel (Visit → Start → Details → Payment → Paid) and its
 * drill-down. One grouped query per period returns sessions by furthest stage
 * and every segment dimension; everything else is arithmetic on those rows,
 * so the funnel, the leak and the drill-down always agree.
 */

type Row = { stage: number; pageId: string; device: string; source: string; visitor: string; band: string; lastField: string; n: number };

async function rows(f: AnalyticsFilter): Promise<Row[]> {
  const raw = await db.$queryRaw<{ stage: number; page_id: string; device: string; source: string; visitor: string; band: string; last_field: string; n: bigint }[]>`
    WITH ${sessionsCte(f)},
    firsts AS (
      SELECT "visitorId" AS v, MIN("createdAt") AS first_seen
      FROM "CheckoutEvent"
      WHERE "merchantId" = ${f.merchantId} AND type = 'VIEW'
        AND "visitorId" IN (SELECT visitor_id FROM sessions WHERE visitor_id IS NOT NULL)
      GROUP BY 1
    )
    SELECT s.stage,
      s.page_id,
      s.device,
      COALESCE(s.source, 'unknown') AS source,
      CASE WHEN s.visitor_id IS NULL THEN 'unknown'
           WHEN f.first_seen < s.started - interval '1 minute' THEN 'returning'
           ELSE 'new' END AS visitor,
      CASE WHEN s.value_cents IS NULL THEN 'unknown'
           WHEN s.value_cents < 5000 THEN 'under50'
           WHEN s.value_cents < 10000 THEN '50to99'
           ELSE '100plus' END AS band,
      COALESCE(s.last_field, 'none') AS last_field,
      count(*) AS n
    FROM sessions s LEFT JOIN firsts f ON f.v = s.visitor_id
    GROUP BY 1, 2, 3, 4, 5, 6, 7`;
  return raw.map((r) => ({ stage: Number(r.stage), pageId: r.page_id, device: r.device, source: r.source, visitor: r.visitor, band: r.band, lastField: r.last_field, n: n(r.n) }));
}

async function aovCents(f: AnalyticsFilter): Promise<number> {
  const [r] = await db.$queryRaw<{ revenue: bigint | null; orders: bigint }[]>`
    SELECT SUM("amountCents" - "refundedCents") AS revenue, count(*) AS orders
    FROM "Order"
    WHERE "merchantId" = ${f.merchantId} AND status IN ${PAID_STATUSES} AND currency = ${f.currency}
      AND COALESCE("paidAt", "createdAt") >= ${f.from} AND COALESCE("paidAt", "createdAt") < ${f.to}`;
  return r && n(r.orders) ? Math.round(n(r.revenue) / n(r.orders)) : 0;
}

// ---------------------------------------------------------------------------

const atLeast = (rs: Row[], stage: number) => rs.reduce((s, r) => s + (r.stage >= stage ? r.n : 0), 0);

export type Transition = {
  from: StageKey;
  to: StageKey;
  /** Sessions that reached `from`. */
  reached: number;
  /** …and went on to `to`. */
  continued: number;
  lost: number;
  dropRate: number;
  prevDropRate: number | null;
  /** Lost × the share who pay once past this step: orders this leak likely cost. */
  likelyLostOrders: number;
};

function transitions(cur: Row[], prev: Row[]): Transition[] {
  const paid = atLeast(cur, 5);
  return STAGES.slice(0, -1).map((s, i) => {
    const reached = atLeast(cur, i + 1);
    const continued = atLeast(cur, i + 2);
    const prevReached = atLeast(prev, i + 1);
    const lost = reached - continued;
    return {
      from: s.key,
      to: STAGES[i + 1].key,
      reached,
      continued,
      lost,
      dropRate: reached ? lost / reached : 0,
      prevDropRate: prevReached >= 20 ? (prevReached - atLeast(prev, i + 2)) / prevReached : null,
      likelyLostOrders: continued ? lost * (paid / continued) : 0,
    };
  });
}

export type FunnelOverview = {
  days: number;
  currency: string;
  stages: { key: StageKey; label: string; hint: string; sessions: number; prevSessions: number }[];
  transitions: Transition[];
  /** The `to` key of the transition that likely cost the most orders. */
  biggestLeak: StageKey | null;
  aovCents: number;
};

export async function funnelOverview(merchantId: string, currency: string, days: number, now = new Date()): Promise<FunnelOverview> {
  const w = periodWindows(days, now);
  const [cur, prev, aov] = await Promise.all([
    rows({ merchantId, currency, ...w.current }),
    rows({ merchantId, currency, ...w.previous }),
    aovCents({ merchantId, currency, ...w.current }),
  ]);
  const ts = transitions(cur, prev);
  const leak = ts.filter((t) => t.lost >= 5).sort((a, b) => b.likelyLostOrders - a.likelyLostOrders)[0];
  return {
    days,
    currency,
    stages: STAGES.map((s, i) => ({ key: s.key, label: s.label, hint: s.hint, sessions: atLeast(cur, i + 1), prevSessions: atLeast(prev, i + 1) })),
    transitions: ts,
    biggestLeak: leak?.to ?? null,
    aovCents: aov,
  };
}

// ---------------------------------------------------------------------------
// Drill-down: one transition, segmented four ways.


const DIMENSIONS = [
  { key: "device", label: "Device", of: (r: Row) => r.device, order: ["mobile", "desktop", "tablet"] },
  { key: "source", label: "Traffic source", of: (r: Row) => r.source, order: null },
  { key: "visitor", label: "New vs returning", of: (r: Row) => r.visitor, order: ["new", "returning", "unknown"] },
  { key: "band", label: "Order value", of: (r: Row) => r.band, order: [...VALUE_BANDS.map((b) => b.key), "unknown"] },
] as const;
export type DimensionKey = (typeof DIMENSIONS)[number]["key"];

function valueLabel(dim: DimensionKey, v: string): string {
  if (v === "unknown") return dim === "visitor" ? "Not known" : "Not recorded";
  if (dim === "device") return v.charAt(0).toUpperCase() + v.slice(1);
  if (dim === "source") return SOURCE_LABELS[v as Source] ?? v;
  if (dim === "visitor") return v === "new" ? "New" : "Returning";
  return VALUE_BANDS.find((b) => b.key === v)?.label ?? v;
}

/** Fewer sessions than this and a segment's rate is "too few to tell". */
export const MIN_SEGMENT = 30;

export type SegmentRow = { value: string; label: string; reached: number; lost: number; dropRate: number; prevDropRate: number | null; small: boolean };

export type FunnelDrilldown = {
  days: number;
  currency: string;
  from: StageKey;
  to: StageKey;
  title: string;
  overall: Transition;
  dimensions: { key: DimensionKey; label: string; rows: SegmentRow[] }[];
  /** The segment losing the most shoppers beyond the rest of the funnel's rate. */
  worst: {
    dimension: DimensionKey;
    value: string;
    label: string;
    dropRate: number;
    othersDropRate: number;
    excessLost: number;
    /**
     * A realistic target for this segment: its own previous rate if it got
     * worse ("previous"), otherwise halfway to everyone else ("half").
     */
    targetRate: number;
    basis: "previous" | "half";
    /** Shoppers kept if the segment hit the target rate. */
    recoverable: number;
    /** The checkout where this segment lost the most shoppers at this step. */
    checkout: { id: string; name: string } | null;
  } | null;
  /** Where people were when they left (last field touched). */
  lastFields: { field: string; label: string; count: number; share: number }[];
  /** If the worst segment hit its target rate: likely extra revenue over the period (an estimate, not a promise). */
  opportunityCents: number;
  /** Of shoppers who got past this step, the share who went on to pay. */
  payRateAfter: number;
  aovCents: number;
};

export async function funnelDrilldown(merchantId: string, currency: string, days: number, to: StageKey, now = new Date()): Promise<FunnelDrilldown> {
  const toIndex = STAGES.findIndex((s) => s.key === to);
  if (toIndex < 1) throw new Error("Unknown funnel step");
  const fromStage = toIndex; // 1-based stage number of `from`
  const w = periodWindows(days, now);
  const [cur, prev, aov] = await Promise.all([
    rows({ merchantId, currency, ...w.current }),
    rows({ merchantId, currency, ...w.previous }),
    aovCents({ merchantId, currency, ...w.current }),
  ]);
  const overall = transitions(cur, prev)[toIndex - 1];
  const payRate = overall.continued ? atLeast(cur, 5) / overall.continued : 0;

  // Sessions that reached `from`: the population for every segment.
  const pop = (rs: Row[]) => rs.filter((r) => r.stage >= fromStage);
  const curPop = pop(cur);
  const prevPop = pop(prev);
  const left = (r: Row) => r.stage === fromStage;

  let worst: FunnelDrilldown["worst"] = null;
  const dimensions = DIMENSIONS.map((d) => {
    const tally = (rs: Row[]) => {
      const m = new Map<string, { reached: number; lost: number }>();
      for (const r of rs) {
        const k = d.of(r);
        const t = m.get(k) ?? { reached: 0, lost: 0 };
        t.reached += r.n;
        if (left(r)) t.lost += r.n;
        m.set(k, t);
      }
      return m;
    };
    const c = tally(curPop);
    const p = tally(prevPop);
    const keys = [...c.keys()].sort((a, b) =>
      d.order ? d.order.indexOf(a as never) - d.order.indexOf(b as never) : a === "unknown" ? 1 : b === "unknown" ? -1 : c.get(b)!.reached - c.get(a)!.reached,
    );
    const rowsOut: SegmentRow[] = keys.map((k) => {
      const t = c.get(k)!;
      const pt = p.get(k);
      return {
        value: k,
        label: valueLabel(d.key, k),
        reached: t.reached,
        lost: t.lost,
        dropRate: t.reached ? t.lost / t.reached : 0,
        prevDropRate: pt && pt.reached >= MIN_SEGMENT ? pt.lost / pt.reached : null,
        small: t.reached < MIN_SEGMENT,
      };
    });
    for (const r of rowsOut) {
      if (r.small || r.value === "unknown") continue;
      const othersReached = overall.reached - r.reached;
      // A segment needs a real comparison group (not "everyone vs nobody").
      if (othersReached < MIN_SEGMENT) continue;
      const othersRate = othersReached ? (overall.lost - r.lost) / othersReached : 0;
      const excess = r.reached * (r.dropRate - othersRate);
      // Only a real gap counts: 5+ points worse than everyone else.
      if (r.dropRate - othersRate >= 0.05 && excess > (worst?.excessLost ?? 0)) {
        const gotWorse = r.prevDropRate != null && r.prevDropRate <= r.dropRate - 0.02;
        const targetRate = gotWorse ? Math.max(r.prevDropRate!, othersRate) : r.dropRate - (r.dropRate - othersRate) / 2;
        worst = {
          dimension: d.key,
          value: r.value,
          label: r.label,
          dropRate: r.dropRate,
          othersDropRate: othersRate,
          excessLost: excess,
          targetRate,
          basis: gotWorse ? "previous" : "half",
          recoverable: r.reached * (r.dropRate - targetRate),
          checkout: null,
        };
      }
    }
    return { key: d.key, label: d.label, rows: rowsOut };
  });

  const fieldCounts = new Map<string, number>();
  for (const r of curPop) if (left(r)) fieldCounts.set(r.lastField, (fieldCounts.get(r.lastField) ?? 0) + r.n);
  const lastFields = [...fieldCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([field, count]) => ({ field, label: FIELD_LABELS[field] ?? field, count, share: overall.lost ? count / overall.lost : 0 }));

  // (TS narrows `worst` to null inside the closure-free return; re-widen it.)
  const w0 = worst as FunnelDrilldown["worst"];
  if (w0) {
    const dim = DIMENSIONS.find((d) => d.key === w0.dimension)!;
    const byPage = new Map<string, number>();
    for (const r of curPop) if (left(r) && dim.of(r) === w0.value) byPage.set(r.pageId, (byPage.get(r.pageId) ?? 0) + r.n);
    const topId = [...byPage.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const page = topId ? await db.checkoutPage.findFirst({ where: { id: topId, merchantId }, select: { id: true, name: true } }) : null;
    w0.checkout = page;
  }
  return {
    days,
    currency,
    from: STAGES[toIndex - 1].key,
    to,
    title: LEAK_TITLES[to as Exclude<StageKey, "visit">],
    overall,
    dimensions,
    worst: w0,
    lastFields,
    opportunityCents: w0 ? Math.round(w0.recoverable * payRate * aov) : 0,
    payRateAfter: payRate,
    aovCents: aov,
  };
}

export const isStageKey = (v: unknown): v is Exclude<StageKey, "visit"> => typeof v === "string" && v !== "visit" && STAGES.some((s) => s.key === v);
