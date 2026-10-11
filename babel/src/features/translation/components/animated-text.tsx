"use client";

import { motion, useReducedMotion } from "framer-motion";

/** Scripts written without spaces between words animate per character. */
const NO_SPACES = new Set(["ja", "zh"]);

/**
 * Reveals text word by word (or character by character for CJK) with a soft
 * rise. The whole reveal stays under ~450ms however long the text is.
 */
export function AnimatedText({ text, lang }: { text: string; lang: string }) {
  const reduce = useReducedMotion();
  if (reduce) return <>{text}</>;

  const tokens = NO_SPACES.has(lang) ? Array.from(text) : text.split(/(\s+)/);
  const step = Math.min(0.035, 0.45 / Math.max(tokens.length, 1));

  return (
    <>
      {tokens.map((token, i) =>
        /^\s+$/.test(token) ? (
          token
        ) : (
          <motion.span
            key={i}
            className="inline-block"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * step, type: "spring", stiffness: 420, damping: 30 }}
          >
            {token}
          </motion.span>
        ),
      )}
    </>
  );
}
