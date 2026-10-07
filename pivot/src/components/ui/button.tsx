import { cva, type VariantProps } from "class-variance-authority";
import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Buttons. `accent` is THE call to action: the one blue used nowhere else, so
 * use it at most once per screen.
 */
export const buttonVariants = cva(
  "inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-full transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out active:translate-y-px disabled:pointer-events-none disabled:opacity-45 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        accent:
          "bg-accent font-heavy text-white shadow-[0_1px_2px_rgb(26_75_255/0.25),0_8px_24px_-8px_rgb(26_75_255/0.55)] hover:bg-accent-hover focus-visible:outline-accent",
        primary: "bg-ink font-heavy text-white hover:bg-ink-2",
        secondary: "border border-line-strong bg-surface font-heavy text-ink hover:border-ink/35 hover:bg-sunken",
        ghost: "font-normal text-ink-2 hover:bg-sunken hover:text-ink",
        danger: "border border-line-strong bg-surface font-heavy text-negative-text hover:border-negative/40 hover:bg-negative-soft",
      },
      size: {
        sm: "h-9 px-3.5 text-[13px]",
        md: "h-11 px-5 text-[15px]",
        lg: "h-13 px-6 text-base",
        xl: "h-[3.75rem] px-8 text-[1.0625rem]",
        icon: "size-10",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonVariantProps = VariantProps<typeof buttonVariants>;

export function Button({
  className,
  variant,
  size,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & ButtonVariantProps) {
  return <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export function ButtonLink({ className, variant, size, ...props }: ComponentProps<typeof Link> & ButtonVariantProps) {
  return <Link className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
