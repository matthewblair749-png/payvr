import type { ReactNode } from "react";

/** Page title row for app screens: one h1, an optional line of context and actions. */
export function PageHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-display text-figure font-bold tracking-[-0.03em]">{title}</h1>
        {description && <p className="mt-1 text-body text-app-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

/** The standard white card: 16px radius, hairline border, very soft shadow. */
export function Card({ children, className = "", ...rest }: React.ComponentProps<"section">) {
  return (
    <section {...rest} className={`rounded-card border border-app-hairline bg-app-card shadow-card ${className}`}>
      {children}
    </section>
  );
}
