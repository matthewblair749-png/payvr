import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FlaskConical } from "lucide-react";
import { listExperiments, type ExperimentSummary } from "@/server/dal/experiments";
import { requireMerchant } from "@/server/dal/session";
import { VerdictBadge } from "./verdict-badge";

export const metadata: Metadata = { title: "Experiments" };

const date = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" });

export default async function ExperimentsPage() {
  const merchant = await requireMerchant("/studio/experiments");
  const all = await listExperiments(merchant.id);
  const running = all.filter((e) => e.status === "RUNNING");
  const finished = all.filter((e) => e.status !== "RUNNING");

  return (
    <>
      <h1 className="font-display text-5xl font-bold tracking-[-0.05em]">Experiments</h1>
      <p className="mt-2 text-muted-strong">A/B tests on your checkouts, explained in plain words.</p>

      {all.length === 0 ? (
        <div className="mt-10 rounded-[28px] border-2 border-dashed border-black/12 bg-white px-6 py-16 text-center">
          <FlaskConical size={32} className="mx-auto text-orange-deep" aria-hidden="true" />
          <p className="mt-4 font-display text-2xl font-bold tracking-[-0.03em]">No tests yet</p>
          <p className="mt-2 text-muted-strong">
            Start one from a{" "}
            <Link href="/studio/research" className="font-semibold text-orange-deep underline">
              Research suggestion
            </Link>
            , or add a B version to any checkout in the Studio.
          </p>
        </div>
      ) : (
        <>
          <Section title="Running" items={running} empty="Nothing running right now." />
          <Section title="Finished" items={finished} empty="No finished tests yet." />
        </>
      )}
    </>
  );
}

function Section({ title, items, empty }: { title: string; items: ExperimentSummary[]; empty: string }) {
  return (
    <section className="mt-10" aria-labelledby={`sec-${title}`}>
      <h2 id={`sec-${title}`} className="font-display text-2xl font-bold tracking-[-0.03em]">
        {title}
      </h2>
      {items.length === 0 ? (
        <p className="mt-3 text-muted-strong">{empty}</p>
      ) : (
        <ul className="mt-4 grid gap-4 lg:grid-cols-2">
          {items.map((e) => (
            <li key={e.id} className="group relative rounded-[24px] bg-white p-5 shadow-soft ring-1 ring-black/5 transition-transform hover:-translate-y-0.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-strong">{e.checkoutName}</p>
                  <h3 className="mt-1 truncate font-display text-xl font-bold tracking-[-0.03em]">
                    <Link href={`/studio/experiments/${e.id}`} className="after:absolute after:inset-0">
                      {e.name}
                    </Link>
                  </h3>
                </div>
                <ArrowRight size={18} aria-hidden="true" className="mt-6 shrink-0 text-muted transition-transform group-hover:translate-x-1" />
              </div>
              <div className="mt-3">
                <VerdictBadge status={e.verdict.status} winnerKey={e.winnerKey} ended={e.status !== "RUNNING"} stopped={e.status === "STOPPED"} />
              </div>
              <p className="mt-2 text-sm text-muted-strong">
                {e.status === "RUNNING" ? e.verdict.detail : null}
                {e.status !== "RUNNING" && e.winnerKey === "B" && "B was shipped to everyone."}
                {e.status !== "RUNNING" && e.winnerKey === "A" && "The original was kept."}
                {e.status === "STOPPED" && "Stopped without picking a winner."}
              </p>
              <p className="mt-3 text-xs text-muted-strong">
                {e.visits.toLocaleString()} visits · {e.metric === "revenue_per_visit" ? "revenue per visit" : "conversion"} ·{" "}
                {e.startedAt ? date.format(new Date(e.startedAt)) : "—"}
                {e.endedAt ? ` – ${date.format(new Date(e.endedAt))}` : " – now"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
