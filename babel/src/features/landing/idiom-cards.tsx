"use client";

import clsx from "clsx";
import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";

interface Idiom {
  lang: string;
  language: string;
  phrase: string;
  romanized?: string;
  literal: string;
  meaning: string;
  babel: string;
  /** Tailwind classes for the card face and its grid span. */
  tone: string;
  span: string;
}

/** Real idioms, hand-checked. "Literal" is the word-for-word reading. */
const IDIOMS: Idiom[] = [
  {
    lang: "ja",
    language: "日本語 · Japanese",
    phrase: "猫の手も借りたい",
    romanized: "Neko no te mo karitai",
    literal: "I’d even borrow a cat’s paws.",
    meaning: "You’re so busy you’d take help from anyone.",
    babel: "I’m swamped. I need all the help I can get.",
    tone: "bg-sun-tint",
    span: "md:col-span-4",
  },
  {
    lang: "fr",
    language: "Français · French",
    phrase: "Avoir le cafard",
    literal: "To have the cockroach.",
    meaning: "To feel low, gloomy or homesick.",
    babel: "To have the blues.",
    tone: "bg-violet-tint",
    span: "md:col-span-2",
  },
  {
    lang: "de",
    language: "Deutsch · German",
    phrase: "Tomaten auf den Augen haben",
    literal: "To have tomatoes on your eyes.",
    meaning: "To miss something that’s right in front of you.",
    babel: "Can’t see what’s right under your nose.",
    tone: "bg-coral-tint",
    span: "md:col-span-2",
  },
  {
    lang: "it",
    language: "Italiano · Italian",
    phrase: "In bocca al lupo!",
    literal: "Into the wolf’s mouth!",
    meaning: "Good luck! The usual reply is “Crepi!”, which means “may it die!”",
    babel: "Break a leg!",
    tone: "bg-white",
    span: "md:col-span-4",
  },
  {
    lang: "es",
    language: "Español · Spanish",
    phrase: "Estar en las nubes",
    literal: "To be in the clouds.",
    meaning: "To be daydreaming and not paying attention.",
    babel: "To have your head in the clouds.",
    tone: "bg-white",
    span: "md:col-span-3",
  },
  {
    lang: "pt",
    language: "Português · Portuguese",
    phrase: "Pagar o pato",
    literal: "To pay for the duck.",
    meaning: "To take the blame for something you didn’t do.",
    babel: "To take the fall.",
    tone: "bg-sun-tint",
    span: "md:col-span-3",
  },
];

function FlipCard({ idiom }: { idiom: Idiom }) {
  const [flipped, setFlipped] = useState(false);
  const reduce = useReducedMotion() ?? false;

  const face = clsx(
    "[grid-area:1/1] flex flex-col rounded-[var(--radius-lg)] border-2 border-ink p-5 text-left [backface-visibility:hidden] sm:p-6",
    idiom.tone,
  );

  return (
    <button
      type="button"
      onClick={() => setFlipped((f) => !f)}
      aria-pressed={flipped}
      className={clsx(
        "group block w-full rounded-[var(--radius-lg)] text-ink [perspective:1200px] transition-transform duration-200 ease-spring hover:-translate-y-1 active:translate-y-0 active:scale-[0.99]",
        idiom.span,
      )}
    >
      <motion.span
        className="grid min-h-[248px] shadow-[0_4px_0_var(--ink)] rounded-[var(--radius-lg)] transition-shadow duration-200 group-hover:shadow-[0_7px_0_var(--ink)] [transform-style:preserve-3d]"
        animate={reduce ? undefined : { rotateY: flipped ? 180 : 0 }}
        transition={{ type: "spring", stiffness: 220, damping: 24 }}
      >
        {/* Front: the idiom and its word-for-word reading */}
        <span className={clsx(face, reduce && flipped && "invisible")} aria-hidden={flipped}>
          <span className="text-sm font-bold text-muted">{idiom.language}</span>
          <span lang={idiom.lang} className="mt-3 font-display text-3xl font-black leading-tight sm:text-4xl">
            {idiom.phrase}
          </span>
          {idiom.romanized && <span className="mt-1 text-sm italic text-muted">{idiom.romanized}</span>}
          <span className="mt-auto pt-6">
            <span className="block text-sm font-bold text-muted">Word for word</span>
            <span className="block text-lg">“{idiom.literal.replace(/\.$/, "")}”</span>
          </span>
          <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-coral-text">
            See what it means
            <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </span>

        {/* Back: what it means and how Babel says it */}
        <span
          className={clsx(face, !reduce && "[transform:rotateY(180deg)]", reduce && !flipped && "invisible")}
          aria-hidden={!flipped}
        >
          <span className="text-sm font-bold text-muted">What it means</span>
          <span className="mt-1 text-lg">{idiom.meaning}</span>
          <span className="mt-auto pt-6 text-sm font-bold text-muted">Babel says</span>
          <span lang="en" className="font-display text-2xl font-black leading-tight sm:text-3xl">
            {idiom.babel}
          </span>
          <span className="mt-3 text-sm font-bold text-coral-text">Flip back</span>
        </span>
      </motion.span>
    </button>
  );
}

export function IdiomCards() {
  return (
    <div className="grid gap-4 md:grid-cols-6 md:gap-6">
      {IDIOMS.map((idiom) => (
        <FlipCard key={idiom.phrase} idiom={idiom} />
      ))}
    </div>
  );
}
