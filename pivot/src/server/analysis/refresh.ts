import "server-only";
import { fromMetricRows } from "@/lib/data/metrics";
import { analyze } from "@/lib/engine/analyze";
import type { Analysis } from "@/lib/engine/types";
import { Prisma } from "@/generated/prisma/client";
import { db } from "../db";
import { appUrl, sendEmail } from "../email";

const ym = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;

/**
 * Re-run the analysis after a company's data changes and persist the
 * insights, opportunities and recommendations. Rows are keyed by the
 * engine's stable keys, so a status the team set ("done", "dismissed")
 * survives re-analysis; rows the new analysis no longer produces are marked
 * inactive rather than deleted. Newly appearing "action needed" insights
 * trigger Smart Alerts.
 */
export async function refreshAnalysis(companyId: string): Promise<Analysis> {
  const company = await db.company.findUniqueOrThrow({
    where: { id: companyId },
    select: { name: true, currency: true, industry: true, marketSharePct: true, dataVersion: true },
  });
  const rows = await db.metric.findMany({
    where: { companyId, dataset: { status: "READY" } },
    select: { period: true, key: true, dimension: true, value: true },
    orderBy: [{ dataset: { createdAt: "asc" } }],
  });
  const data = fromMetricRows(
    rows.map((r) => ({ period: ym(r.period), key: r.key, dimension: r.dimension, value: r.value })),
    { name: company.name, currency: company.currency, industry: (company.industry as never) ?? "other", marketSharePct: company.marketSharePct },
  );
  const a = analyze(data);
  const v = company.dataVersion;

  // Writes are serialized per company: a page view's safety-net refresh can overlap the
  // refresh an import starts. Under the lock, a run whose data is older than what's already
  // persisted does nothing, so it can't roll the analysis back or send an alert twice.
  const result = await db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${companyId}::text))`;
      const cur = await tx.company.findUniqueOrThrow({ where: { id: companyId }, select: { analyzedVersion: true } });
      if (cur.analyzedVersion >= v) return null;
      const before = await tx.insight.findMany({ where: { companyId, active: true }, select: { key: true } });

      for (const [rank, i] of a.insights.entries()) {
        await tx.insight.upsert({
          where: { companyId_key: { companyId, key: i.key } },
          create: { companyId, key: i.key, severity: i.severity, rank, content: json(i), dataVersion: v },
          update: { severity: i.severity, rank, content: json(i), dataVersion: v, active: true },
        });
      }
      await tx.insight.updateMany({ where: { companyId, key: { notIn: a.insights.map((i) => i.key) } }, data: { active: false } });
      for (const o of a.opportunities) {
        await tx.opportunity.upsert({
          where: { companyId_key: { companyId, key: o.key } },
          create: { companyId, key: o.key, score: o.score, content: json(o), dataVersion: v },
          update: { score: o.score, content: json(o), dataVersion: v, active: true },
        });
      }
      await tx.opportunity.updateMany({ where: { companyId, key: { notIn: a.opportunities.map((o) => o.key) } }, data: { active: false } });
      for (const r of a.recommendations) {
        await tx.recommendation.upsert({
          where: { companyId_key: { companyId, key: r.key } },
          create: { companyId, key: r.key, rank: r.rank, content: json(r), dataVersion: v },
          update: { rank: r.rank, content: json(r), dataVersion: v, active: true },
        });
      }
      await tx.recommendation.updateMany({ where: { companyId, key: { notIn: a.recommendations.map((r) => r.key) } }, data: { active: false } });
      await tx.company.update({ where: { id: companyId }, data: { analyzedVersion: v, analyzedAt: new Date() } });
      return { wasActive: new Set(before.map((x) => x.key)), firstAnalysis: cur.analyzedVersion === 0 };
    },
    { timeout: 60_000, maxWait: 30_000 },
  );

  // Smart Alerts: new "action needed" insights, emailed to members who want them.
  // Only from the run that persisted this version, and not on the first analysis:
  // the person who uploaded is looking at it already.
  const fresh = result ? a.insights.filter((i) => i.severity === "ACTION" && !result.wasActive.has(i.key)) : [];
  if (result && fresh.length && !result.firstAnalysis) {
    const members = await db.companyMember.findMany({ where: { companyId, user: { notifyAlerts: true } }, select: { user: { select: { email: true } } } });
    for (const m of members) {
      sendEmail({
        to: m.user.email,
        subject: `PIVOT alert: ${fresh[0].title.replace(/\.$/, "")}`,
        heading: fresh[0].title,
        body: `${fresh[0].what} ${fresh[0].why}`,
        cta: { label: "See the insight", url: appUrl("/app/insights") },
      }).catch((e) => console.error("[pivot] alert email failed", e));
    }
  }
  return a;
}
