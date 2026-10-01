import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { FUNNEL_STEPS, type FunnelStep } from "@/lib/tracking/events";
import { db } from "../db";

/**
 * Dashboard analytics. Every query is parameterized (Prisma.sql) and scoped
 * to one merchant. Days are UTC calendar days.
 *
 * Session funnel rank (a session's furthest point):
 *   1 view · 2 engaged · 3 payment · 4 submitted · 5 paid
 */

export type AnalyticsFilter = {
  merchantId: string;
  from: Date;
  to: Date;
  /** Limit to one checkout page. */
  pageId?: string | null;
  /** Revenue is reported in one currency (the merchant's default). */
  currency: string;
};

const PAID_STATUSES = Prisma.sql`('SUCCEEDED','PARTIALLY_REFUNDED','REFUNDED','DISPUTED')`;

function pageFilter(f: AnalyticsFilter, col = Prisma.sql`"checkoutPageId"`) {
  return f.pageId ? Prisma.sql`AND ${col} = ${f.pageId}` : Prisma.empty;
}

/**
 * One pass over the window's events → one row per session with everything the
 * dashboard needs (furthest step, device, entry page, last field touched, all
 * fields touched). Every query builds on this, so each does a single scan of
 * the (merchantId, createdAt) index instead of re-joining events.
 */
function sessionsCte(f: AnalyticsFilter) {
  return Prisma.sql`
    sessions AS (
      SELECT "sessionId",
        MAX(CASE
          WHEN type = 'PAYMENT_SUCCEEDED' THEN 5
          WHEN type = 'PAY_CLICK' OR step = 'submitted' THEN 4
          WHEN step = 'payment' OR (type = 'FIELD_FOCUS' AND field IN ('email','card','payment')) THEN 3
          WHEN step = 'engaged' OR type = 'FIELD_FOCUS' THEN 2
          ELSE 1 END) AS rank,
        MIN("createdAt") AS started,
        MAX("createdAt") AS last_seen,
        COALESCE((array_agg(device ORDER BY "createdAt", id) FILTER (WHERE type = 'VIEW'))[1], 'desktop') AS device,
        (array_agg("checkoutPageId" ORDER BY "createdAt", id) FILTER (WHERE type = 'VIEW'))[1] AS page_id,
        (array_agg(field ORDER BY "createdAt" DESC, id DESC) FILTER (WHERE type = 'FIELD_FOCUS'))[1] AS last_field,
        array_agg(DISTINCT field) FILTER (WHERE type = 'FIELD_FOCUS') AS fields
      FROM "CheckoutEvent"
      WHERE "merchantId" = ${f.merchantId}
        AND "createdAt" >= ${f.from} AND "createdAt" < ${f.to}
        ${pageFilter(f)}
      GROUP BY "sessionId"
      HAVING bool_or(type = 'VIEW')
    )`;
}

const n = (v: bigint | number | null | undefined) => Number(v ?? 0);

// ---------------------------------------------------------------------------

export type Funnel = { step: FunnelStep; sessions: number }[];

export async function funnel(f: AnalyticsFilter): Promise<Funnel> {
  const [row] = await db.$queryRaw<{ r1: bigint; r2: bigint; r3: bigint; r4: bigint; r5: bigint }[]>`
    WITH ${sessionsCte(f)}
    SELECT
      count(*) FILTER (WHERE rank >= 1) AS r1,
      count(*) FILTER (WHERE rank >= 2) AS r2,
      count(*) FILTER (WHERE rank >= 3) AS r3,
      count(*) FILTER (WHERE rank >= 4) AS r4,
      count(*) FILTER (WHERE rank >= 5) AS r5
    FROM sessions`;
  const values = [row?.r1, row?.r2, row?.r3, row?.r4, row?.r5].map(n);
  return FUNNEL_STEPS.map((step, i) => ({ step, sessions: values[i] }));
}

export type DailyPoint = { day: string; sessions: number; paidSessions: number; revenueCents: number; orders: number };

export async function daily(f: AnalyticsFilter): Promise<DailyPoint[]> {
  const rows = await db.$queryRaw<{ day: Date; sessions: bigint; paid: bigint; revenue: bigint | null; orders: bigint }[]>`
    WITH ${sessionsCte(f)},
    days AS (
      SELECT generate_series(date_trunc('day', ${f.from}::timestamp), date_trunc('day', ${f.to}::timestamp - interval '1 second'), interval '1 day') AS day
    ),
    s AS (
      SELECT date_trunc('day', started) AS day, count(*) AS sessions, count(*) FILTER (WHERE rank = 5) AS paid
      FROM sessions GROUP BY 1
    ),
    o AS (
      SELECT date_trunc('day', COALESCE("paidAt", "createdAt")) AS day,
        SUM("amountCents" - "refundedCents") AS revenue, count(*) AS orders
      FROM "Order"
      WHERE "merchantId" = ${f.merchantId} AND status IN ${PAID_STATUSES} AND currency = ${f.currency}
        AND COALESCE("paidAt", "createdAt") >= ${f.from} AND COALESCE("paidAt", "createdAt") < ${f.to}
        ${pageFilter(f)}
      GROUP BY 1
    )
    SELECT days.day, COALESCE(s.sessions, 0) AS sessions, COALESCE(s.paid, 0) AS paid,
           COALESCE(o.revenue, 0) AS revenue, COALESCE(o.orders, 0) AS orders
    FROM days LEFT JOIN s ON s.day = days.day LEFT JOIN o ON o.day = days.day
    ORDER BY days.day`;
  return rows.map((r) => ({
    day: r.day.toISOString().slice(0, 10),
    sessions: n(r.sessions),
    paidSessions: n(r.paid),
    revenueCents: n(r.revenue),
    orders: n(r.orders),
  }));
}

export type Kpis = { revenueCents: number; orders: number; sessions: number; conversion: number; aovCents: number };

export function kpisFrom(series: DailyPoint[]): Kpis {
  const revenueCents = series.reduce((s, d) => s + d.revenueCents, 0);
  const orders = series.reduce((s, d) => s + d.orders, 0);
  const sessions = series.reduce((s, d) => s + d.sessions, 0);
  const paid = series.reduce((s, d) => s + d.paidSessions, 0);
  return {
    revenueCents,
    orders,
    sessions,
    conversion: sessions ? paid / sessions : 0,
    aovCents: orders ? Math.round(revenueCents / orders) : 0,
  };
}

export type DropoffCell = { field: string; device: string; touched: number; exits: number };

/**
 * Where do people leave? For sessions that didn't pay (and have been idle for
 * 30+ minutes), the last block/field they touched. Returned per device with
 * how many sessions touched that field, so the UI can show an exit *rate*.
 */
export async function dropoff(f: AnalyticsFilter): Promise<DropoffCell[]> {
  const rows = await db.$queryRaw<{ field: string; device: string; touched: bigint; exits: bigint }[]>`
    WITH ${sessionsCte(f)},
    exits AS (
      SELECT COALESCE(last_field, 'none') AS field, device, count(*) AS exits
      FROM sessions
      WHERE rank < 5 AND last_seen < now() - interval '30 minutes'
      GROUP BY 1, 2
    ),
    reach AS (
      SELECT fld AS field, device, count(*) AS touched
      FROM sessions, unnest(fields) AS fld
      GROUP BY 1, 2
      UNION ALL
      -- "none" is measured against everyone who viewed.
      SELECT 'none', device, count(*) FROM sessions GROUP BY 2
    )
    SELECT r.field, r.device, r.touched, COALESCE(x.exits, 0) AS exits
    FROM reach r LEFT JOIN exits x ON x.field = r.field AND x.device = r.device`;
  return rows.map((r) => ({ field: r.field, device: r.device, touched: n(r.touched), exits: n(r.exits) }));
}

export type MethodCountryCell = { country: string; method: string; succeeded: number; failed: number; revenueCents: number };

/** Payment attempts by buyer country × payment method (from orders, so it's Stripe's truth). */
export async function methodsByCountry(f: AnalyticsFilter): Promise<MethodCountryCell[]> {
  const rows = await db.$queryRaw<{ country: string; method: string; ok: bigint; failed: bigint; revenue: bigint | null }[]>`
    SELECT COALESCE(country, '??') AS country, COALESCE("paymentMethod", 'unknown') AS method,
      count(*) FILTER (WHERE status IN ${PAID_STATUSES}) AS ok,
      count(*) FILTER (WHERE status = 'FAILED') AS failed,
      SUM("amountCents") FILTER (WHERE status IN ${PAID_STATUSES} AND currency = ${f.currency}) AS revenue
    FROM "Order"
    WHERE "merchantId" = ${f.merchantId} AND status <> 'PENDING'
      AND "createdAt" >= ${f.from} AND "createdAt" < ${f.to}
      ${pageFilter(f)}
    GROUP BY 1, 2`;
  return rows.map((r) => ({ country: r.country, method: r.method, succeeded: n(r.ok), failed: n(r.failed), revenueCents: n(r.revenue) }));
}

export type SurveySummary = { question: string; answers: { answer: string; count: number }[]; total: number }[];

export async function surveySummary(f: AnalyticsFilter): Promise<SurveySummary> {
  const rows = await db.surveyResponse.groupBy({
    by: ["question", "answer"],
    where: {
      merchantId: f.merchantId,
      createdAt: { gte: f.from, lt: f.to },
      ...(f.pageId ? { checkoutPageId: f.pageId } : {}),
    },
    _count: { _all: true },
  });
  const byQ = new Map<string, { answer: string; count: number }[]>();
  for (const r of rows) {
    const list = byQ.get(r.question) ?? [];
    list.push({ answer: r.answer, count: r._count._all });
    byQ.set(r.question, list);
  }
  return [...byQ.entries()].map(([question, answers]) => ({
    question,
    answers: answers.sort((a, b) => b.count - a.count),
    total: answers.reduce((s, a) => s + a.count, 0),
  }));
}

export type PageRow = { pageId: string; name: string; slug: string; sessions: number; paid: number; revenueCents: number };

/** Per-checkout comparison (ignores the page filter on purpose). */
export async function pageBreakdown(f: AnalyticsFilter): Promise<PageRow[]> {
  const rows = await db.$queryRaw<{ id: string; name: string; slug: string; sessions: bigint; paid: bigint; revenue: bigint | null }[]>`
    WITH ${sessionsCte({ ...f, pageId: null })},
    agg AS (
      SELECT page_id AS "checkoutPageId", count(*) AS sessions, count(*) FILTER (WHERE rank = 5) AS paid
      FROM sessions GROUP BY 1
    ),
    rev AS (
      SELECT "checkoutPageId", SUM("amountCents" - "refundedCents") AS revenue FROM "Order"
      WHERE "merchantId" = ${f.merchantId} AND status IN ${PAID_STATUSES} AND currency = ${f.currency}
        AND COALESCE("paidAt", "createdAt") >= ${f.from} AND COALESCE("paidAt", "createdAt") < ${f.to}
      GROUP BY 1
    )
    SELECT p.id, p.name, p.slug, COALESCE(agg.sessions, 0) AS sessions, COALESCE(agg.paid, 0) AS paid, COALESCE(rev.revenue, 0) AS revenue
    FROM "CheckoutPage" p
    LEFT JOIN agg ON agg."checkoutPageId" = p.id
    LEFT JOIN rev ON rev."checkoutPageId" = p.id
    WHERE p."merchantId" = ${f.merchantId} AND p.status <> 'ARCHIVED'
    ORDER BY revenue DESC, sessions DESC`;
  return rows.map((r) => ({ pageId: r.id, name: r.name, slug: r.slug, sessions: n(r.sessions), paid: n(r.paid), revenueCents: n(r.revenue) }));
}

/** Everything the dashboard needs, current + previous period, in parallel. */
export async function dashboardData(f: AnalyticsFilter) {
  const span = f.to.getTime() - f.from.getTime();
  const prev: AnalyticsFilter = { ...f, from: new Date(f.from.getTime() - span), to: f.from };
  const [series, prevSeries, fun, drop, methods, survey, pages] = await Promise.all([
    daily(f),
    daily(prev),
    funnel(f),
    dropoff(f),
    methodsByCountry(f),
    surveySummary(f),
    pageBreakdown(f),
  ]);
  return { series, kpis: kpisFrom(series), prevKpis: kpisFrom(prevSeries), funnel: fun, dropoff: drop, methods, survey, pages };
}
export type DashboardData = Awaited<ReturnType<typeof dashboardData>>;
