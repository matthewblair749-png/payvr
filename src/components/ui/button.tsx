import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** shadcn/ui-style button with lumen variants. */
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-[transform,background-color,opacity] duration-200 ease-[var(--ease-spring)] disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97]",
  {
    variants: {
      variant: {
        // Ink on brand orange is 5.2:1 (AA at any size); white would be 3.7:1. Pinned to
        // literal ink so the label stays ink in dark mode too.
        primary: "bg-orange text-[#0e0e10] font-bold hover:-translate-y-px shadow-soft",
        ink: "bg-ink text-white hover:-translate-y-px",
        soft: "bg-surface text-ink hover:bg-black/10",
        ghost: "text-ink hover:bg-surface",
        outline: "border border-black/15 bg-white text-ink hover:border-ink",
      },
      size: {
        sm: "h-9 px-3.5 text-sm",
        md: "h-11 px-5 text-[0.95rem]",
        lg: "h-14 px-7 text-lg",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "ink", size: "md" },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, type = "button", ...props },
  ref,
) {
  return <button ref={ref} type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
});
