"use client";

import { AlertTriangle, ChevronDown, GitCompareArrows, Loader2, Play, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Delta } from "@/components/ui/delta";
import { Dialog } from "@/components/ui/dialog";
import { FormMessage, Select } from "@/components/ui/field";
import { Slider } from "@/components/ui/slider";
import { PRESETS, SCENARIOS, scenarioQuestion, simulate } from "@/lib/engine/simulate";
import type { Baseline, Level, ScenarioKind, ScenarioResult } from "@/lib/engine/types";
import { int, money, moneyDelta, pct, pctDelta } from "@/lib/format";
import { cn } from "@/lib/utils";
import { deleteScenario, saveScenario, type SavedScenario } from "@/server/data/scenario-actions";
import { useCompanyId } from "./workspace-context";
import { riskTone } from "./labels";

const KINDS = Object.entries(SCENARIOS) as [ScenarioKind, (typeof SCENARIOS)[ScenarioKind]][];

export function shortLabel(kind: ScenarioKind, v: number) {
  const sign = v > 0 ? "+" : v < 0 ? "−" : "";
  switch (kind) {
    case "price":
      return `Price ${sign}${Math.abs(v)}%`;
    case "marketing":
      return `Marketing ${sign}${Math.abs(v)}%`;
    case "newProduct":
      return `New product (${v}%)`;
    case "newMarket":
      return `New market (${v}%)`;
    case "costs":
      return `Costs −${v}%`;
  }
}

function Tile({ label, value, sub, accent, children }: { label: string; value?: string; sub?: React.ReactNode; accent?: boolean; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-sm text-muted">{label}</p>
      {value && <p className={cn("mt-1.5 text-2xl font-heavy leading-none tracking-tighter sm:text-[1.75rem]", accent ? "text-accent" : "text-ink")}>{value}</p>}
      {children}
      {sub && <div className="mt-2 text-xs text-muted">{sub}</div>}
    </div>
  );
}

export function WhatIfStudio({
  baseline,
  currency,
  initial,
  saved: initialSaved,
  mode,
  canSave,
  base,
}: {
  baseline: Baseline;
  currency: string;
  initial: { kind: ScenarioKind; value: number };
  saved: SavedScenario[];
  mode: "app" | "demo";
  canSave: boolean;
  base: string;
}) {
  const companyId = useCompanyId();
  const [kind, setKind] = useState<ScenarioKind>(initial.kind);
  const [value, setValue] = useState(initial.value);
  const [saved, setSaved] = useState(initialSaved);
  const [selected, setSelected] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [showAssumptions, setShowAssumptions] = useState(false);
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const cfg = SCENARIOS[kind];
  const r = useMemo(() => simulate(baseline, kind, value, currency), [baseline, kind, value, currency]);

  function pick(k: ScenarioKind, v: number) {
    setKind(k);
    setValue(v);
    setMsg(null);
  }

  function run() {
    setMsg(null);
    if (mode === "demo") {
      const s: SavedScenario = { id: `demo-${Date.now()}`, name: r.question, kind, value: r.value, result: r, createdAt: new Date().toISOString() };
      setSaved((x) => [s, ...x]);
      setMsg({ tone: "success", text: "Simulation added below. In the demo, scenarios aren't saved after you leave." });
      return;
    }
    start(async () => {
      const res = await saveScenario(companyId, kind, value);
      if (res.ok) {
        setSaved((x) => [res.data, ...x]);
        setMsg({ tone: "success", text: "Simulation saved. Select two or more to compare them." });
      } else setMsg({ tone: "error", text: res.error });
    });
  }

  function remove(id: string) {
    setSelected((s) => s.filter((x) => x !== id));
    if (mode === "demo") return setSaved((x) => x.filter((s) => s.id !== id));
    start(async () => {
      const res = await deleteScenario(id);
      if (res.ok) setSaved((x) => x.filter((s) => s.id !== id));
      else setMsg({ tone: "error", text: res.error });
    });
  }

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= 3 ? s : [...s, id]));
  const compared = saved.filter((s) => selected.includes(s.id));
  const shareKnown = r.baseline.marketSharePct !== null;
  const custKnown = r.baseline.customers > 0;

  return (
    <div className="space-y-4">
      <div className="pv-scroll-x -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Scenarios">
        {PRESETS.map((p) => {
          const active = p.kind === kind && p.value === value;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => pick(p.kind, p.value)}
              aria-pressed={active}
              className={cn(
                "h-9 shrink-0 rounded-full border px-4 text-sm",
                active ? "border-ink bg-ink font-heavy text-white" : "border-line-strong bg-surface text-ink-2 hover:border-ink/35 hover:text-ink",
              )}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <section className="rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6 xl:col-span-2" aria-label="Scenario builder">
          <label htmlFor="scenario-kind" className="text-sm text-muted">
            Scenario
          </label>
          <Select id="scenario-kind" value={kind} onChange={(e) => pick(e.target.value as ScenarioKind, SCENARIOS[e.target.value as ScenarioKind].defaultValue)} className="mt-1.5">
            {KINDS.map(([k, c]) => (
              <option key={k} value={k}>
                {c.label}
              </option>
            ))}
          </Select>
          <p className="mt-6 text-2xl font-heavy leading-tight tracking-tight text-ink">{scenarioQuestion(kind, value)}</p>
          <div className="mt-5 flex items-center justify-between text-sm">
            <span className="text-muted">{cfg.leverLabel}</span>
            <span className="font-heavy text-ink">{cfg.format(value)}</span>
          </div>
          <Slider
            value={value}
            min={cfg.min}
            max={cfg.max}
            step={cfg.step}
            onValueChange={setValue}
            label={cfg.leverLabel}
            valueText={cfg.format(value)}
            centered={cfg.min < 0}
          />
          <div className="flex justify-between text-xs text-muted" aria-hidden="true">
            <span>{cfg.format(cfg.min)}</span>
            <span>{cfg.format(cfg.max)}</span>
          </div>
          <p className="mt-6 text-[15px] leading-relaxed text-ink-2">{r.summary}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button variant="accent" onClick={run} disabled={pending || (mode === "app" && !canSave)}>
              {pending ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
              Run simulation
            </Button>
            <Button variant="secondary" onClick={() => setCompareOpen(true)} disabled={compared.length < 1}>
              <GitCompareArrows size={16} aria-hidden="true" /> Compare scenarios{compared.length ? ` (${compared.length})` : ""}
            </Button>
          </div>
          {mode === "app" && !canSave && (
            <p className="mt-3 text-sm text-muted">
              Saving and comparing simulations is part of Pro.{" "}
              <Link href={`${base}/settings/billing`} className="text-ink underline underline-offset-4">
                Upgrade
              </Link>
            </p>
          )}
          {msg && (
            <div className="mt-4">
              <FormMessage tone={msg.tone}>{msg.text}</FormMessage>
            </div>
          )}
        </section>

        <section className="space-y-4 xl:col-span-3" aria-label="Results" aria-live="polite">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Tile label="Revenue" value={moneyDelta(r.deltas.revenue, currency)} accent sub={`${money(r.projected.revenue, currency)} a month`} />
            <Tile label="Customers" value={custKnown ? pctDelta(r.deltas.customersPct) : "–"} sub={custKnown ? `${int(r.projected.customers)} customers` : "Not in your data"} />
            <Tile label="Profit" sub={`${money(r.projected.profit, currency)} a month`}>
              <p className={cn("mt-1.5 text-2xl font-heavy leading-none tracking-tighter sm:text-[1.75rem]", r.deltas.profit >= 0 ? "text-positive-text" : "text-negative-text")}>
                {moneyDelta(r.deltas.profit, currency)}
              </p>
            </Tile>
            <Tile
              label="Market share"
              value={r.deltas.marketSharePts !== null ? `${r.deltas.marketSharePts >= 0 ? "+" : "−"}${Math.abs(r.deltas.marketSharePts).toFixed(1)} pts` : "–"}
              sub={
                r.deltas.marketSharePts !== null ? (
                  `${r.projected.marketSharePct!.toFixed(1)}% share`
                ) : kind === "newMarket" ? (
                  "Share in a new market"
                ) : shareKnown ? (
                  "No change"
                ) : (
                  <Link href={`${base}/settings/company`} className="underline underline-offset-2">
                    Add your market share
                  </Link>
                )
              }
            />
            <Tile label="Risk">
              <p className="mt-2">
                <Badge tone={riskTone(r.risk)} className="px-3 py-1.5 text-sm font-heavy">
                  {r.risk}
                </Badge>
              </p>
            </Tile>
            <Tile label="Confidence" value={`${r.confidence}%`} sub="How much your data supports it" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { title: "Current strategy", s: r.baseline, tone: "border-line" },
              { title: "Simulated strategy", s: r.projected, tone: "border-ink" },
            ].map((c) => (
              <div key={c.title} className={cn("rounded-2xl border bg-surface p-5", c.tone)}>
                <p className="text-[12px] font-heavy uppercase tracking-[0.08em] text-ink">{c.title}</p>
                <dl className="mt-3 space-y-2 text-[15px]">
                  <div className="flex justify-between">
                    <dt className="text-muted">Revenue</dt>
                    <dd className="font-heavy text-ink">{money(c.s.revenue, currency)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted">Profit</dt>
                    <dd className="font-heavy text-ink">{money(c.s.profit, currency)}</dd>
                  </div>
                  {custKnown && (
                    <div className="flex justify-between">
                      <dt className="text-muted">Customers</dt>
                      <dd className="font-heavy text-ink">{int(c.s.customers)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-muted">Margin</dt>
                    <dd className="font-heavy text-ink">{pct(c.s.margin)}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-caution/30 bg-caution-soft p-4 text-sm text-ink-2">
            <p className="flex items-start gap-2">
              <AlertTriangle size={17} className="mt-0.5 shrink-0 text-caution-text" aria-hidden="true" />
              <span>
                <span className="font-heavy text-ink">These are AI estimates, not guaranteed outcomes.</span> Monthly figures, 6 months after the change, from your latest month of data.
              </span>
            </p>
            <button type="button" onClick={() => setShowAssumptions((s) => !s)} aria-expanded={showAssumptions} className="mt-2 inline-flex items-center gap-1 pl-6 text-sm font-heavy text-ink">
              {showAssumptions ? "Hide" : "Show"} assumptions <ChevronDown size={15} className={cn("transition-transform", showAssumptions && "rotate-180")} aria-hidden="true" />
            </button>
            {showAssumptions && (
              <ul className="mt-2 list-disc space-y-1.5 pl-11">
                {r.assumptions.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      <section aria-label="Saved scenarios" className="rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-[15px] font-heavy text-ink">{mode === "demo" ? "Your simulations" : "Saved simulations"}</h2>
            <p className="mt-1 text-sm text-muted">Select up to three to compare side by side.</p>
          </div>
        </div>
        {saved.length ? (
          <ul className="mt-4 divide-y divide-line">
            {saved.map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-3">
                <input
                  type="checkbox"
                  id={`cmp-${s.id}`}
                  checked={selected.includes(s.id)}
                  onChange={() => toggle(s.id)}
                  disabled={!selected.includes(s.id) && selected.length >= 3}
                  className="size-4 shrink-0 accent-ink"
                />
                <label htmlFor={`cmp-${s.id}`} className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] text-ink">{s.name}</span>
                  <span className="block text-xs text-muted">
                    Revenue {moneyDelta(s.result.deltas.revenue, currency)} · Profit {moneyDelta(s.result.deltas.profit, currency)} · {s.result.risk} risk
                  </span>
                </label>
                <button type="button" onClick={() => pick(s.kind, s.value)} className="hidden h-9 rounded-full px-3 text-sm text-ink-2 hover:bg-sunken hover:text-ink sm:block">
                  Open
                </button>
                <button type="button" onClick={() => remove(s.id)} aria-label={`Delete ${s.name}`} className="grid size-9 place-items-center rounded-full text-muted hover:bg-sunken hover:text-negative-text">
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-[15px] text-muted">Run a simulation to keep it here.</p>
        )}
      </section>

      <Dialog open={compareOpen} onClose={() => setCompareOpen(false)} title="Compare scenarios" description="Monthly figures, 6 months after each change." className="max-w-3xl">
        <div className="relative overflow-x-auto p-6">
          <CompareTable scenarios={compared.map((s) => s.result)} currency={currency} />
        </div>
      </Dialog>
    </div>
  );
}

function CompareTable({ scenarios, currency }: { scenarios: ScenarioResult[]; currency: string }) {
  if (!scenarios.length) return <p className="text-sm text-muted">Select scenarios to compare.</p>;
  const base = scenarios[0].baseline;
  const cols = [{ label: "Current strategy", s: base, r: null as ScenarioResult | null }, ...scenarios.map((r) => ({ label: shortLabel(r.kind, r.value), s: r.projected, r }))];
  const bestProfit = Math.max(...scenarios.map((r) => r.projected.profit));
  const row = (label: string, f: (c: (typeof cols)[number]) => React.ReactNode) => (
    <tr className="border-t border-line">
      <th scope="row" className="py-3 pr-4 text-left font-normal text-muted">
        {label}
      </th>
      {cols.map((c) => (
        <td key={c.label} className="num-col px-3 py-3 text-right text-ink">
          {f(c)}
        </td>
      ))}
    </tr>
  );
  const lvl = (l: Level) => <Badge tone={riskTone(l)}>{l}</Badge>;
  return (
    <table className="w-full min-w-[34rem] text-sm">
      <thead>
        <tr>
          <th className="pb-3" />
          {cols.map((c) => (
            <th key={c.label} scope="col" className="px-3 pb-3 text-right text-[13px] text-ink">
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {row("Revenue", (c) => money(c.s.revenue, currency))}
        {row("Profit", (c) => (
          <span className={cn(c.r && c.s.profit === bestProfit && "font-heavy")}>
            {money(c.s.profit, currency)}
            {c.r && <Delta className="ml-2" label={moneyDelta(c.s.profit - base.profit, currency)} direction={c.s.profit >= base.profit ? "up" : "down"} good={c.s.profit >= base.profit} />}
          </span>
        ))}
        {row("Customers", (c) => (c.s.customers ? int(c.s.customers) : "–"))}
        {row("Margin", (c) => pct(c.s.margin))}
        {row("Market share", (c) => (c.s.marketSharePct !== null ? `${c.s.marketSharePct.toFixed(1)}%` : "–"))}
        {row("Risk", (c) => (c.r ? lvl(c.r.risk) : "–"))}
        {row("Confidence", (c) => (c.r ? `${c.r.confidence}%` : "–"))}
      </tbody>
    </table>
  );
}
