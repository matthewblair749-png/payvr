"use client";

import clsx from "clsx";
import { useEffect, useRef } from "react";
import { LANGUAGES, type LanguageCode } from "../languages";

/**
 * One swipeable row of language chips. It behaves as a radio group: Tab
 * lands on the selected language, arrow keys move between languages, and
 * the chosen chip always scrolls into view. Edges fade so the row reads as
 * scrollable on a phone.
 */
export function LanguagePicker({
  value,
  onChange,
  labelledBy,
}: {
  value: LanguageCode;
  onChange: (code: LanguageCode) => void;
  labelledBy: string;
}) {
  const rowRef = useRef<HTMLDivElement>(null);

  // Keep the selected chip visible after a change (keyboard or tap).
  useEffect(() => {
    const chip = rowRef.current?.querySelector<HTMLElement>(`[data-code="${value}"]`);
    chip?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [value]);

  function onKeyDown(event: React.KeyboardEvent) {
    const index = LANGUAGES.findIndex((l) => l.code === value);
    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const next = LANGUAGES[event.key === "Home" ? 0 : LANGUAGES.length - 1].code;
      onChange(next);
      rowRef.current?.querySelector<HTMLElement>(`[data-code="${next}"]`)?.focus();
      return;
    }
    if (!step) return;
    event.preventDefault();
    const next = LANGUAGES[(index + step + LANGUAGES.length) % LANGUAGES.length].code;
    onChange(next);
    rowRef.current?.querySelector<HTMLElement>(`[data-code="${next}"]`)?.focus();
  }

  return (
    <div
      ref={rowRef}
      role="radiogroup"
      aria-labelledby={labelledBy}
      onKeyDown={onKeyDown}
      className="flex snap-x gap-2 overflow-x-auto scroll-px-4 px-4 py-3 [mask-image:linear-gradient(to_right,transparent,black_16px,black_calc(100%-24px),transparent)] [scrollbar-width:none] sm:scroll-px-6 sm:px-6 [&::-webkit-scrollbar]:hidden"
    >
      {LANGUAGES.map((l) => {
        const selected = l.code === value;
        return (
          <button
            key={l.code}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            data-code={l.code}
            lang={l.code}
            aria-label={`${l.native} (${l.name})`}
            onClick={() => onChange(l.code)}
            className={clsx(
              "press min-h-11 shrink-0 snap-start rounded-full px-4 text-sm font-bold",
              selected
                ? "bg-surface-inverse text-fg-inverse shadow-soft"
                : "bg-surface-2 text-fg-2 hover:bg-[color-mix(in_srgb,var(--fg)_8%,var(--surface-2))] hover:text-fg",
            )}
          >
            {l.native}
          </button>
        );
      })}
    </div>
  );
}
