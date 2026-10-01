import "server-only";
import { periodWindows } from "@/lib/date-range";
import { db } from "../db";
import { daily, n, PAID_STATUSES, type DailyPoint } from "./analytics";

/**
 * Home: the North Star (revenue) and the four KPI tiles, for the current
 * period and the previous one. Both periods come from the same daily rollup,
 * so the tiles, the chart and the deltas always agree.
 */

export type PeriodTotals = {
  revenueCents: number;
  orders: number;
  sessions: number;
  /** Paid sessions / sessions. */
  conversion: number;
  aovCents: number;
  /** Orders later refunded or disputed / paid orders. */
  issueRate: number;
};

export type HomeDay = {
  day: string;
  /** The matching day in the previous period (same offset). */
  prevDay: string;
  revenueCents: number;
  prevRevenueCents: number;
  orders: number;
  conversion: number | null;
  aovCents: number | null;
  issueRate: number | null;
};

export type HomeOverview = {
  days: number;
  currency: string;
  current: PeriodTotals;
  previous: PeriodTotals;
  series: HomeDay[];
};

type IssueDay = { day: string; paid: number; issues: number };

async function issuesByDay(merchantId: string, currency: string, from: Date, to: Date): Promise<Map<string, IssueDay>> {
  const rows = await db.$queryRaw<{ day: Date; paid: bigint; issues: bigint }[]>`
    SELECT date_trunc('day', COALESCE("paidAt", "createdAt")) AS day,
      count(*) AS paid,
      count(*) FILTER (WHERE "refundedCents" > 0 OR status = 'DISPUTED') AS issues
    FROM "Order"
    WHERE "merchantId" = ${merchantId} AND status IN ${PAID_STATUSES} AND currency = ${currency}
      AND COALESCE("paidAt", "createdAt") >= ${from} AND COALESCE("paidAt", "createdAt") < ${to}
    GROUP BY 1`;
  return new Map(
    rows.map((r) => {
      const day = r.day.toISOString().slice(0, 10);
      return [day, { day, paid: n(r.paid), issues: n(r.issues) }];
    }),
  );
}

function totals(series: DailyPoint[], issues: Map<string, IssueDay>): PeriodTotals {
  let revenueCents = 0;
  let orders = 0;
  let sessions = 0;
  let paidSessions = 0;
  for (const d of series) {
    revenueCents += d.revenueCents;
    orders += d.orders;
    sessions += d.sessions;
    paidSessions += d.paidSessions;
  }
  let paid = 0;
  let bad = 0;
  for (const i of issues.values()) {
    paid += i.paid;
    bad += i.issues;
  }
  return {
    revenueCents,
    orders,
    sessions,
    conversion: sessions ? paidSessions / sessions : 0,
    aovCents: orders ? Math.round(revenueCents / orders) : 0,
    issueRate: paid ? bad / paid : 0,
  };
}

export async function homeOverview(merchantId: string, currency: string, days: number, now = new Date()): Promise<HomeOverview> {
  const w = periodWindows(days, now);
  const [cur, prev, curIssues, prevIssues] = await Promise.all([
    daily({ merchantId, currency, ...w.current }),
    daily({ merchantId, currency, ...w.previous }),
    issuesByDay(merchantId, currency, w.current.from, w.current.to),
    issuesByDay(merchantId, currency, w.previous.from, w.previous.to),
  ]);

  const series: HomeDay[] = cur.map((d, i) => {
    const issue = curIssues.get(d.day);
    return {
      day: d.day,
      prevDay: prev[i]?.day ?? "",
      revenueCents: d.revenueCents,
      prevRevenueCents: prev[i]?.revenueCents ?? 0,
      orders: d.orders,
      conversion: d.sessions ? d.paidSessions / d.sessions : null,
      aovCents: d.orders ? Math.round(d.revenueCents / d.orders) : null,
      issueRate: issue?.paid ? issue.issues / issue.paid : null,
    };
  });

  return { days, currency, current: totals(cur, curIssues), previous: totals(prev, prevIssues), series };
}
