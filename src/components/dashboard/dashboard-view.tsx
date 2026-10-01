"use client";

/**
 * Dashboard layout. Pure presentation over DashboardData (all numbers are
 * computed server-side in src/server/dal/analytics.ts).
 */
import Link from "next/link";
import { useMemo } from "react";
import type { DashboardData } from "@/server/dal/analytics";
import { answerLabel, questionPrompt } from "@/lib/survey/questions";
import { FIELD_LABELS, STEP_LABELS } from "@/lib/tracking/events";
import { formatMoney } from "@/lib/utils";
import { ChartCard, DataTable, fmtDay, Heatmap, HBarList, StatTile, TimeSeriesChart, type HeatCell } from "./charts";

const pct = (v: number, digits = 1) => `${(v * 100).toFixed(digits)}%`;
const delta = (cur: number, prev: number) => (prev > 0 ? (cur - prev) / prev : null);

const DEVICES = [
  { key: "mobile", label: "Mobile" },
  { key: "desktop", label: "Desktop" },
  { key: "tablet", label: "Tablet" },
];

/** Rows of the drop-off heatmap, in the order a buyer meets them. */
const DROPOFF_ROWS = ["none", "orderSummary", "countdown", "upsell", "testimonial", "tipSlider", "coupon", "payIn4", "email", "card", "payment"];

const METHOD_LABELS: Record<string, string> = {
  card: "Card",
  apple_pay: "Apple Pay",
  google_pay: "Google Pay",
  link: "Link",
  klarna: "Klarna",
  ideal: "iDEAL",
  afterpay_clearpay: "Afterpay",
  affirm: "Affirm",
  unknown: "Unknown",
};
const methodLabel = (m: string) => METHOD_LABELS[m] ?? m.replace(/_/g, " ");

let regionNames: Intl.DisplayNames | null = null;
function countryName(code: string) {
  if (code === "??") return "Unknown";
  try {
    regionNames ??= new Intl.DisplayNames(["en"], { type: "region" });
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}

export function DashboardView({ data, currency, days }: { data: DashboardData; currency: string; days: number }) {
  const money = (c: number) => formatMoney(c, currency);
  const compactMoney = (c: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency, notation: "compact", maximumFractionDigits: 1 }).format(c / 100);

  const { kpis, prevKpis, series } = data;
  const noData = kpis.sessions === 0 && kpis.orders === 0;

  // --- Drop-off heatmap cells
  const dropoff = useMemo(() => {
    const cells: Record<string, HeatCell> = {};
    const rates: number[] = [];
    for (const c of data.dropoff) {
      if (c.touched > 0) rates.push(c.exits / c.touched);
    }
    const maxRate = Math.max(0.01, ...rates);
    const present = new Set<string>();
    for (const c of data.dropoff) {
      const rate = c.touched ? c.exits / c.touched : 0;
      const label = FIELD_LABELS[c.field] ?? c.field;
      const device = DEVICES.find((d) => d.key === c.device)?.label ?? c.device;
      present.add(c.field);
      cells[`${c.field}|${c.device}`] = {
        t: rate / maxRate,
        label: pct(rate, 0),
        sub: `of ${c.touched.toLocaleString()}`,
        lowData: c.touched < 15,
        detail:
          c.field === "none"
            ? `${device}: ${pct(rate, 0)} of visitors left without touching anything (${c.exits.toLocaleString()} of ${c.touched.toLocaleString()}).`
            : `${device} · ${label}: ${pct(rate, 0)} of people who touched it left without paying (${c.exits.toLocaleString()} of ${c.touched.toLocaleString()}).`,
      };
    }
    const rows = DROPOFF_ROWS.filter((r) => present.has(r)).map((r) => ({ key: r, label: FIELD_LABELS[r] ?? r }));
    // Headline: the worst field (by exit rate) with enough data.
    const worst = data.dropoff
      .filter((c) => c.field !== "none" && c.touched >= 30)
      .reduce<{ field: string; rate: number } | null>((best, c) => {
        const all = data.dropoff.filter((x) => x.field === c.field);
        const rate = all.reduce((s, x) => s + x.exits, 0) / Math.max(1, all.reduce((s, x) => s + x.touched, 0));
        return !best || rate > best.rate ? { field: c.field, rate } : best;
      }, null);
    return { cells, rows, maxRate, worst };
  }, [data.dropoff]);

  // --- Payment method × country
  const methods = useMemo(() => {
    const attemptsBy = (key: "country" | "method") => {
      const m = new Map<string, number>();
      for (const c of data.methods) m.set(c[key], (m.get(c[key]) ?? 0) + c.succeeded + c.failed);
      return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
    };
    const countries = attemptsBy("country").slice(0, 8);
    const methodKeys = attemptsBy("method").slice(0, 6);
    const cells: Record<string, HeatCell> = {};
    for (const c of data.methods) {
      const attempts = c.succeeded + c.failed;
      const fail = attempts ? c.failed / attempts : 0;
      cells[`${c.country}|${c.method}`] = {
        // Color = failure rate (darker = more failed payments), capped at 30% so small differences show.
        t: Math.min(1, fail / 0.3),
        label: attempts ? pct(1 - fail, 0) : "–",
        sub: `${attempts.toLocaleString()} tries`,
        lowData: attempts < 5,
        detail: `${countryName(c.country)} · ${methodLabel(c.method)}: ${pct(1 - fail, 0)} succeeded (${c.succeeded.toLocaleString()} of ${attempts.toLocaleString()} attempts).`,
      };
    }
    return {
      rows: countries.map((k) => ({ key: k, label: countryName(k) })),
      cols: methodKeys.map((k) => ({ key: k, label: methodLabel(k) })),
      cells,
    };
  }, [data.methods]);

  const tsPoints = series.map((d) => ({ key: d.day, label: fmtDay(d.day) }));
  const funnelTop = data.funnel[0]?.sessions ?? 0;

  if (noData) {
    return (
      <div data-dashboard className="rounded-[28px] border-2 border-dashed border-black/12 bg-white px-6 py-16 text-center">
        <p className="font-display text-2xl font-bold tracking-[-0.03em]">No checkout visits in this period</p>
        <p className="mt-2 text-muted-strong">
          Publish a checkout and share its link. Visits, drop-offs and sales show up here within seconds.{" "}
          <Link href="/studio/checkouts" className="font-semibold text-orange-deep underline">
            Go to checkouts
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div data-dashboard className="space-y-5">
      {/* KPI tiles. Revenue leads: it's the one number merchants look for first. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Revenue (net of refunds)" value={money(kpis.revenueCents)} delta={delta(kpis.revenueCents, prevKpis.revenueCents)} hero />
        <StatTile label="Orders" value={kpis.orders.toLocaleString()} delta={delta(kpis.orders, prevKpis.orders)} />
        <StatTile label="Checkout conversion" value={pct(kpis.conversion)} delta={delta(kpis.conversion, prevKpis.conversion)} />
        <StatTile label="Average order" value={money(kpis.aovCents)} delta={delta(kpis.aovCents, prevKpis.aovCents)} />
      </div>

      {/* Two separate charts: revenue and conversion have different scales (never a dual axis). */}
      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard
          title="Revenue per day"
          subtitle={`Last ${days} days, ${currency}`}
          table={
            <DataTable
              caption="Revenue and orders per day"
              head={["Day", "Revenue", "Orders"]}
              rows={series.map((d) => [fmtDay(d.day), money(d.revenueCents), d.orders])}
            />
          }
        >
          <TimeSeriesChart
            kind="columns"
            points={tsPoints.map((p, i) => ({ ...p, value: series[i].revenueCents }))}
            formatValue={money}
            formatAxis={compactMoney}
            tooltipLabel="revenue"
            describe={`Revenue per day over the last ${days} days, totalling ${money(kpis.revenueCents)}.`}
          />
        </ChartCard>
        <ChartCard
          title="Conversion per day"
          subtitle="Share of checkout visits that paid"
          table={
            <DataTable
              caption="Checkout conversion per day"
              head={["Day", "Visits", "Paid", "Conversion"]}
              rows={series.map((d) => [fmtDay(d.day), d.sessions, d.paidSessions, d.sessions ? pct(d.paidSessions / d.sessions) : "–"])}
            />
          }
        >
          <TimeSeriesChart
            kind="line"
            points={tsPoints.map((p, i) => ({ ...p, value: series[i].sessions >= 5 ? series[i].paidSessions / series[i].sessions : null }))}
            formatValue={(v) => pct(v)}
            formatAxis={(v) => pct(v, 0)}
            tooltipLabel="converted"
            describe={`Daily checkout conversion over the last ${days} days, averaging ${pct(kpis.conversion)}.`}
          />
        </ChartCard>
      </div>

      <div className="grid gap-5 lg:grid-cols-[2fr_3fr]">
        <ChartCard
          title="Checkout funnel"
          subtitle="How far each visit got"
          table={
            <DataTable
              caption="Checkout funnel"
              head={["Step", "Visits", "Of all visits"]}
              rows={data.funnel.map((f) => [STEP_LABELS[f.step], f.sessions.toLocaleString(), funnelTop ? pct(f.sessions / funnelTop) : "–"])}
            />
          }
        >
          <HBarList
            describe="Checkout funnel"
            max={funnelTop}
            bars={data.funnel.map((f, i) => {
              const prev = data.funnel[i - 1]?.sessions;
              const lost = prev ? prev - f.sessions : 0;
              return {
                key: f.step,
                label: STEP_LABELS[f.step],
                value: f.sessions,
                valueLabel: `${f.sessions.toLocaleString()} · ${funnelTop ? pct(f.sessions / funnelTop, 0) : "–"}`,
                note: i > 0 && prev ? `${lost.toLocaleString()} left here (${pct(lost / prev, 0)} of the step before)` : undefined,
              };
            })}
          />
        </ChartCard>

        <ChartCard
          title="Where people leave"
          subtitle={
            dropoff.worst
              ? `The last thing touched before leaving without paying. ${FIELD_LABELS[dropoff.worst.field] ?? dropoff.worst.field} loses ${pct(dropoff.worst.rate, 0)} of the people who touch it.`
              : "The last thing touched before leaving without paying."
          }
          table={
            <DataTable
              caption="Exit rate by last field touched and device"
              head={["Last touched", "Device", "Touched", "Left", "Exit rate"]}
              rows={data.dropoff
                .filter((c) => c.touched > 0)
                .sort((a, b) => b.exits / b.touched - a.exits / a.touched)
                .map((c) => [FIELD_LABELS[c.field] ?? c.field, c.device, c.touched, c.exits, pct(c.exits / c.touched)])}
            />
          }
        >
          <Heatmap
            rows={dropoff.rows}
            cols={DEVICES}
            cells={dropoff.cells}
            caption="Exit rate by last field touched and device"
            legend={{ title: "Exit rate", low: "0%", high: pct(dropoff.maxRate, 0) }}
          />
        </ChartCard>
      </div>

      <ChartCard
        title="Payment methods by country"
        subtitle="Share of payment attempts that succeeded. Darker cells have more failed payments."
        table={
          <DataTable
            caption="Payment success by country and method"
            head={["Country", "Method", "Succeeded", "Failed", "Success rate"]}
            rows={data.methods
              .sort((a, b) => b.succeeded + b.failed - (a.succeeded + a.failed))
              .map((c) => [countryName(c.country), methodLabel(c.method), c.succeeded, c.failed, pct(c.succeeded / Math.max(1, c.succeeded + c.failed))])}
          />
        }
      >
        {methods.rows.length ? (
          <Heatmap
            rows={methods.rows}
            cols={methods.cols}
            cells={methods.cells}
            caption="Payment success rate by country and payment method"
            legend={{ title: "Failed payments", low: "0%", high: "30%+" }}
          />
        ) : (
          <p className="text-sm text-muted-strong">No payment attempts yet.</p>
        )}
      </ChartCard>

      <div className="grid gap-5 lg:grid-cols-2">
        {data.survey.length === 0 ? (
          <ChartCard title="One-tap answers" subtitle="Buyers' answers to your post-purchase question will appear here.">
            <p className="text-sm text-muted-strong">No answers yet.</p>
          </ChartCard>
        ) : (
          data.survey.map((q) => (
            <ChartCard
              key={q.question}
              title={questionPrompt(q.question)}
              subtitle={`${q.total.toLocaleString()} buyers answered · one-tap question after checkout`}
              table={
                <DataTable
                  caption={questionPrompt(q.question)}
                  head={["Answer", "Buyers", "Share"]}
                  rows={q.answers.map((a) => [answerLabel(q.question, a.answer), a.count, pct(a.count / q.total)])}
                />
              }
            >
              <HBarList
                describe={questionPrompt(q.question)}
                bars={q.answers.map((a) => ({
                  key: a.answer,
                  label: answerLabel(q.question, a.answer),
                  value: a.count,
                  valueLabel: pct(a.count / q.total, 0),
                }))}
              />
            </ChartCard>
          ))
        )}
      </div>

      <ChartCard title="Checkouts" subtitle="Each checkout's visits, conversion and revenue in this period">
        <DataTable
          caption="Performance by checkout"
          head={["Checkout", "Visits", "Conversion", "Revenue"]}
          rows={data.pages.map((p) => [p.name, p.sessions.toLocaleString(), p.sessions ? pct(p.paid / p.sessions) : "–", money(p.revenueCents)])}
        />
      </ChartCard>
    </div>
  );
}
