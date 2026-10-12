"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

const STATES = [
  { dot: "bg-[#8b84a3]", text: "No connection · 2 messages waiting" },
  { dot: "bg-sun", text: "Reconnecting…" },
  { dot: "bg-[#2f9e5b]", text: "Back online · 2 messages sent" },
] as const;

/**
 * A slow, quiet loop through what a room shows when the connection drops.
 * Under reduced motion it rests on the first state.
 */
export function OfflineStatus() {
  const reduce = useReducedMotion() ?? false;
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reduce) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % STATES.length), 2800);
    return () => clearInterval(timer);
  }, [reduce]);

  const state = STATES[index];
  return (
    <div className="inline-flex min-h-12 items-center rounded-full border-2 border-line-strong bg-white px-5" aria-hidden>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={state.text}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="inline-flex items-center gap-2.5 font-semibold"
        >
          <span className={`size-2.5 rounded-full ${state.dot}`} />
          {state.text}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}
