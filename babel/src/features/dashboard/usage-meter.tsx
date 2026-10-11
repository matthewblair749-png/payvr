import clsx from "clsx";

/** One allowance, in words first and a bar second. */
export function UsageMeter({
  label,
  usedText,
  used,
  limit,
  footnote,
}: {
  label: string;
  usedText: string;
  used: number;
  limit: number;
  footnote: string;
}) {
  const ratio = limit > 0 ? Math.min(1, used / limit) : 1;
  const low = ratio >= 0.9;
  return (
    <div className="rounded-[var(--radius-lg)] border-2 border-ink bg-white p-5 sm:p-6">
      <h3 className="font-display text-lg font-extrabold">{label}</h3>
      <p className="mt-2 text-2xl font-bold tabular-nums">{usedText}</p>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={Math.min(used, limit)}
        className="mt-4 h-3 overflow-hidden rounded-full bg-paper"
      >
        <div
          className={clsx("h-full rounded-full transition-[width] duration-300 ease-out", low ? "bg-coral" : "bg-violet")}
          style={{ width: `${Math.max(ratio * 100, used > 0 ? 3 : 0)}%` }}
        />
      </div>
      <p className="mt-3 text-sm text-muted">{footnote}</p>
    </div>
  );
}
