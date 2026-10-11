import clsx from "clsx";

/** Marks demo content as a hand-checked sample, not a live translation. */
export function PreviewBadge({ children = "Preview", className }: { children?: string; className?: string }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border border-line-strong px-2.5 py-0.5 text-xs font-bold uppercase tracking-[0.08em] text-muted",
        className,
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}
