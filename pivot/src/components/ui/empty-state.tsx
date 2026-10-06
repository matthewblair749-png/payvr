import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Every major page has one of these when there's nothing to show yet. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center rounded-2xl border border-dashed border-line-strong bg-surface px-6 py-14 text-center sm:py-20", className)}>
      <span className="grid size-14 place-items-center rounded-2xl bg-sunken text-ink">
        <Icon size={24} strokeWidth={2} aria-hidden="true" />
      </span>
      <h2 className="mt-5 text-xl font-heavy tracking-tight text-ink">{title}</h2>
      <p className="mt-2 max-w-sm text-[15px] text-muted">{description}</p>
      {children && <div className="mt-7 flex flex-wrap items-center justify-center gap-3">{children}</div>}
    </div>
  );
}
