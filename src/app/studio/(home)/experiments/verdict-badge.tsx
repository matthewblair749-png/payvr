import type { VerdictStatus } from "@/lib/experiments/stats";

/** Status pill: icon + words (never color alone). */
export function VerdictBadge({
  status,
  winnerKey,
  ended,
  stopped,
}: {
  status: VerdictStatus;
  winnerKey: string | null;
  ended: boolean;
  stopped?: boolean;
}) {
  if (ended) {
    const text = stopped ? "Stopped" : winnerKey === "B" ? "Shipped B" : "Kept original";
    return <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1 text-sm font-semibold">■ {text}</span>;
  }
  const map: Record<VerdictStatus, { text: string; cls: string; icon: string }> = {
    b_better: { text: "B is winning", cls: "bg-[#DDF3E4] text-[#14532D]", icon: "▲" },
    leaning_b: { text: "B is ahead", cls: "bg-[#FFF3C4] text-[#0e0e10]", icon: "↗" },
    a_better: { text: "Original is winning", cls: "bg-[#FDE2DA] text-[#8A2A0B]", icon: "▼" },
    leaning_a: { text: "Original is ahead", cls: "bg-[#FFF3C4] text-[#0e0e10]", icon: "↘" },
    no_difference: { text: "No real difference", cls: "bg-surface text-ink", icon: "＝" },
    keep_going: { text: "No clear winner yet", cls: "bg-surface text-ink", icon: "…" },
    too_early: { text: "Too early to tell", cls: "bg-surface text-muted-strong", icon: "◷" },
  };
  const s = map[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${s.cls}`}>
      <span aria-hidden="true">{s.icon}</span> {s.text}
    </span>
  );
}
