import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("anim-pulse rounded-xl bg-sunken", className)} aria-hidden="true" />;
}
