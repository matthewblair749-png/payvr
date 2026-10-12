"use client";

import { Babi, type BabiMood } from "./babi";

export type MascotMood = "idle" | "thinking" | "happy";

/**
 * Compatibility wrapper for screens not yet moved to <Babi>. The tower
 * mascot has been redrawn as Babi; this keeps the old props working.
 */
export function Mascot({
  mood = "idle",
  waving = false,
  label,
  className,
}: {
  mood?: MascotMood;
  waving?: boolean;
  label?: string;
  className?: string;
}) {
  const babiMood: BabiMood = mood;
  return <Babi mood={babiMood} wave={waving} label={label?.replace("The Babel mascot", "Babi")} className={className} />;
}
