import Link from "next/link";
import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "inverse" | "ink" | "outline" | "quiet";
type Size = "sm" | "md" | "lg";

/*
 * Buttons feel physical: an inner top highlight, a soft layered shadow,
 * a 1px lift on hover, a pressed-in state on press, and the shared spring
 * so they settle rather than snap.
 */
const base =
  "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-display font-extrabold " +
  "transition-[transform,box-shadow,background-color,border-color,color] duration-[var(--dur-base)] ease-spring " +
  "active:duration-75 disabled:pointer-events-none disabled:opacity-45";

const variants: Record<Variant, string> = {
  // Ink on coral: 5.3:1 (4.75:1 when pressed)
  primary:
    "bg-accent text-accent-fg shadow-[var(--inset-highlight),var(--shadow-soft)] " +
    "hover:-translate-y-px hover:bg-accent-hover hover:shadow-[var(--inset-highlight),var(--shadow-raised)] " +
    "active:translate-y-0 active:scale-[0.98] active:bg-accent-press active:shadow-[var(--inset-pressed)]",
  secondary:
    "border border-border-strong bg-surface text-fg shadow-[var(--inset-highlight),var(--shadow-soft)] " +
    "hover:-translate-y-px hover:shadow-[var(--inset-highlight),var(--shadow-raised)] " +
    "active:translate-y-0 active:scale-[0.98] active:bg-surface-2 active:shadow-[var(--inset-pressed)]",
  ghost: "text-fg hover:bg-[color-mix(in_srgb,currentColor_8%,transparent)] active:scale-[0.97] active:bg-[color-mix(in_srgb,currentColor_12%,transparent)]",
  // Brand ink in every theme
  inverse:
    "bg-surface-inverse text-fg-inverse shadow-[var(--shadow-soft)] hover:-translate-y-px hover:shadow-[var(--shadow-raised)] " +
    "active:translate-y-0 active:scale-[0.98] active:shadow-[var(--inset-pressed)]",
  // Legacy names, mapped onto the new set
  ink:
    "bg-[var(--brand-ink)] text-[var(--brand-cream)] shadow-[var(--shadow-soft)] hover:-translate-y-px hover:shadow-[var(--shadow-raised)] " +
    "active:translate-y-0 active:scale-[0.98] active:shadow-[var(--inset-pressed)]",
  outline:
    "border border-current bg-transparent text-fg hover:bg-[color-mix(in_srgb,currentColor_8%,transparent)] active:scale-[0.98]",
  quiet: "text-fg hover:bg-[color-mix(in_srgb,currentColor_8%,transparent)] active:scale-[0.97]",
};

// All sizes keep a 44px touch target; sm only tightens the padding.
const sizes: Record<Size, string> = {
  sm: "min-h-11 px-4 text-sm",
  md: "min-h-11 px-6 text-base",
  lg: "min-h-12 px-8 text-lg",
};

interface CommonProps {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}

export function buttonClasses({ variant = "primary", size = "md", className }: Omit<CommonProps, "children">) {
  return clsx(base, variants[variant], sizes[size], className);
}

export function Button({ variant, size, className, ...props }: CommonProps & ComponentProps<"button">) {
  return <button type="button" className={buttonClasses({ variant, size, className })} {...props} />;
}

export function ButtonLink({ variant, size, className, ...props }: CommonProps & ComponentProps<typeof Link>) {
  return <Link className={buttonClasses({ variant, size, className })} {...props} />;
}

/** Keyboard hint shown inside or beside a control. */
export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={clsx(
        "inline-flex min-w-6 items-center justify-center rounded-xs border border-border-strong bg-surface px-1 font-sans text-xs font-semibold text-fg-2 shadow-[0_1px_0_var(--border-strong)]",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
