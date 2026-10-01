import type { Metadata } from "next";
import { ResearchView, type InsightView } from "@/components/research/research-view";
import { requireMerchant } from "@/server/dal/session";
import { assistantEnabled, listThreads } from "@/server/research/agent";
import { ensureFreshInsights, listInsights } from "@/server/research/insights";
import { getProposal } from "@/server/research/proposals";

export const metadata: Metadata = { title: "Research" };

export default async function ResearchPage() {
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
      <h1 className="font-display text-5xl font-bold tracking-[-0.05em]">Research</h1>
      <p className="mt-2 text-muted-strong">Why people buy, why they almost didn&apos;t, and what to try next.</p>
      <ResearchView
        insights={insights}
        threads={threads.map((t) => ({ id: t.id, title: t.title, updatedAt: t.updatedAt.toISOString() }))}
        enabled={assistantEnabled()}
      />
    </>
  );
}
