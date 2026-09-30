"use client";

import { SuccessCheck } from "@/components/checkout/success-check";

/** Brand-colored success mark (the hosted theme isn't known on this page). */
export function CompleteCheck() {
  return (
    <div style={{ ["--co-accent" as string]: "#F04A1A", ["--co-accent-fg" as string]: "#FFFFFF" }}>
      <SuccessCheck size={72} />
    </div>
  );
}
