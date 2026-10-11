import Link from "next/link";
import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "ink" | "outline" | "quiet";
type Size = "md" | "lg";

const base =
  "inline-flex select-none items-center justify-center gap-2 rounded-full border-2 font-display font-extrabold tracking-[-0.01em] " +
  "transition-[transform,box-shadow,background-color,color] duration-150 ease-spring " +
  "hover:-translate-y-0.5 active:translate-y-0.5 disabled:pointer-events-none disabled:opacity-50";

const variants: Record<Variant, string> = {
  // Ink text on coral: 4.8:1. White on coral would fail contrast.
  primary:
    "border-ink bg-coral text-ink shadow-[var(--lift)] hover:shadow-[var(--lift-hover)] active:bg-coral-press active:shadow-[var(--lift-press)]",
  ink: "border-ink bg-ink text-cream shadow-[0_3px_0_var(--ink-deep)] hover:shadow-[0_5px_0_var(--ink-deep)] active:shadow-[0_1px_0_var(--ink-deep)]",
  outline:
    "border-current bg-transparent text-text hover:bg-[color-mix(in_srgb,currentColor_8%,transparent)] active:bg-[color-mix(in_srgb,currentColor_14%,transparent)]",
  quiet:
    "border-transparent bg-transparent text-text hover:translate-y-0 hover:bg-[color-mix(in_srgb,currentColor_8%,transparent)] active:translate-y-0 active:scale-[0.97]",
};

const sizes: Record<Size, string> = {
  md: "min-h-12 px-5 text-base",
  lg: "min-h-14 px-7 text-lg",
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
