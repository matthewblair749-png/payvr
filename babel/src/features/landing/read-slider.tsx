"use client";

import { useId, useState } from "react";
import { PreviewBadge } from "@/components/ui/preview-badge";

interface Recipe {
  lang: "de" | "en";
  title: string;
  intro: string;
  meta: string;
  ingredientsHeading: string;
  ingredients: string[];
  methodHeading: string;
  steps: string[];
}

/** A German recipe and its hand-checked English translation. */
const ORIGINAL: Recipe = {
  lang: "de",
  title: "Omas Apfelkuchen",
  intro: "Einfach und saftig, wie früher bei Oma.",
  meta: "Vorbereitung: 20 Min. · Backen: 45 Min.",
  ingredientsHeading: "Zutaten für eine Springform (26 cm)",
  ingredients: ["200 g Mehl", "125 g kalte Butter", "100 g Zucker", "1 Ei", "4 säuerliche Äpfel", "1 Prise Zimt"],
  methodHeading: "So geht’s",
  steps: [
    "Mehl, Butter, Zucker und Ei rasch zu einem glatten Teig verkneten und eine halbe Stunde kalt stellen.",
    "Den Teig in die Form drücken und dabei einen kleinen Rand formen.",
    "Die Äpfel schälen, in dünne Spalten schneiden und dicht auf dem Teig verteilen. Mit Zimt bestreuen.",
    "Bei 180 °C etwa 45 Minuten backen, bis der Rand goldbraun ist.",
  ],
};

const TRANSLATED: Recipe = {
  lang: "en",
  title: "Grandma’s Apple Cake",
  intro: "Simple and moist, just like Grandma used to make.",
  meta: "Prep: 20 min · Bake: 45 min",
  ingredientsHeading: "Ingredients for a 26 cm springform pan",
  ingredients: ["200 g flour", "125 g cold butter", "100 g sugar", "1 egg", "4 tart apples", "1 pinch of cinnamon"],
  methodHeading: "Here’s how",
  steps: [
    "Quickly knead the flour, butter, sugar and egg into a smooth dough, then chill it for half an hour.",
    "Press the dough into the pan, forming a small rim.",
    "Peel the apples, cut them into thin wedges and arrange them closely on the dough. Sprinkle with cinnamon.",
    "Bake at 180 °C for about 45 minutes, until the edge is golden brown.",
  ],
};

function RecipePage({ recipe, hidden }: { recipe: Recipe; hidden?: boolean }) {
  return (
    <article lang={recipe.lang} aria-hidden={hidden} className="h-full bg-white p-5 pt-14 sm:p-8 sm:pt-16">
      <h3 className="text-3xl sm:text-4xl">{recipe.title}</h3>
      <p className="mt-2 text-lg text-muted">{recipe.intro}</p>
      <p className="mt-3 inline-block rounded-full bg-sun-tint px-3 py-1 text-sm font-bold">{recipe.meta}</p>
      <div className="mt-6 grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-8">
        <section>
          <h4 className="font-display text-lg font-extrabold">{recipe.ingredientsHeading}</h4>
          <ul className="mt-2 space-y-1">
            {recipe.ingredients.map((item) => (
              <li key={item} className="flex gap-2">
                <span aria-hidden className="mt-[0.6em] size-1.5 shrink-0 rounded-full bg-coral" />
                {item}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h4 className="font-display text-lg font-extrabold">{recipe.methodHeading}</h4>
          <ol className="mt-2 space-y-2">
            {recipe.steps.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span aria-hidden className="font-display font-black text-coral-text">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </article>
  );
}

/**
 * Before/after comparison. The original sits on top, clipped to the left of
 * the divider; the translation shows through on the right. A native range
 * input drives it, so it works with keyboard, touch and screen readers.
 */
export function ReadSlider() {
  const [position, setPosition] = useState(50);
  const sliderId = useId();

  return (
    <figure className="m-0">
      <div className="relative overflow-hidden rounded-[var(--radius-lg)] border-2 border-ink shadow-[0_6px_0_var(--ink)]">
        {/* Both versions share one grid cell, so the frame fits the longer one */}
        <div className="grid">
          <div className="[grid-area:1/1]">
            <RecipePage recipe={TRANSLATED} />
          </div>
          <div className="[grid-area:1/1]" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}>
            <RecipePage recipe={ORIGINAL} hidden />
          </div>
        </div>

        {/* Corner labels */}
        <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-ink px-3 py-1 text-xs font-bold text-cream">
          Original · Deutsch
        </span>
        <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-coral px-3 py-1 text-xs font-bold text-ink">
          babel · English
        </span>

        <input
          id={sliderId}
          type="range"
          min={0}
          max={100}
          value={position}
          onChange={(e) => setPosition(Number(e.target.value))}
          aria-label="Drag to compare the German original with the English translation"
          aria-valuetext={`${position}% original, ${100 - position}% translation`}
          className="peer absolute inset-0 z-10 h-full w-full cursor-ew-resize opacity-0"
        />

        {/* Divider and handle (visual only; the input above does the work) */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 w-[3px] -translate-x-1/2 bg-ink"
          style={{ left: `${position}%` }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute top-1/2 flex size-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-ink bg-sun shadow-[0_3px_0_var(--ink)] transition-transform duration-150 ease-spring peer-hover:scale-110 peer-active:scale-95 peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-[3px] peer-focus-visible:outline-ink"
          style={{ left: `${position}%` }}
        >
          <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 6 3 12l6 6M15 6l6 6-6 6" />
          </svg>
        </div>
      </div>
      <figcaption className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">
        <PreviewBadge />
        A German recipe, translated by hand to show what Babel does. Drag the handle to compare.
      </figcaption>
    </figure>
  );
}
