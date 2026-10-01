import type { Metadata } from "next";
import { ResearchView, type InsightView } from "@/components/research/research-view";
import { requireMerchant } from "@/server/dal/session";
import { assistantEnabled, listThreads } from "@/server/research/agent";
import { ensureFreshInsights, listInsights } from "@/server/research/insights";
import { getProposal } from "@/server/research/proposals";

export const metadata: Metadata = { title: "Research" };

export default async function ResearchPage({ searchParams }: PageProps<"/studio/research">) {
  const sp = await searchParams;
  const merchant = await requireMerchant("/studio/research");
  // Deterministic insights are cheap (~150ms); refresh them when stale.
  await ensureFreshInsights(merchant.id);
  const [rows, threads] = await Promise.all([listInsights(merchant.id), listThreads(merchant.id)]);
  const insights: InsightView[] = await Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      kind: r.kind,
      title: r.title,
      body: r.body,
      proposal: (r.data as { proposal?: unknown } | null)?.proposal ? await getProposal(merchant.id, r.id) : null,
    })),
  );

  return (
    <>
      <h1 className="font-display text-figure font-bold tracking-[-0.03em]">Research</h1>
      <p className="mt-1 text-body text-app-muted">Why people buy, why they almost didn&apos;t, and what to try next.</p>
      <ResearchView
        insights={insights}
        threads={threads.map((t) => ({ id: t.id, title: t.title, updatedAt: t.updatedAt.toISOString() }))}
        enabled={assistantEnabled()}
        initialThreadId={typeof sp.thread === "string" ? sp.thread : null}
        initialQuestion={typeof sp.ask === "string" ? sp.ask.slice(0, 500) : ""}
      />
    </>
  );
}
