/**
 * Turns a checkout Theme into concrete, contrast-safe CSS custom properties.
 * The renderer only ever reads these variables, so a theme change is a single
 * style update — which is what makes the live editor feel instant.
 */
import type { CSSProperties } from "react";
import { bestText, contrast, ensureContrast, mix } from "@/lib/color";
import { FONTS } from "./meta";
import type { Theme } from "./schema";

export type CheckoutVars = CSSProperties & Record<`--co-${string}`, string>;

export function themeToVars(theme: Theme): CheckoutVars {
  const dark = theme.mode === "dark";
  const card = dark ? "#17171A" : "#FFFFFF";
  const fg = dark ? "#F5F5F7" : "#0E0E10";
  const muted = ensureContrast(dark ? "#A1A1AA" : "#6B6B73", card, 4.5);
  const border = dark ? mix(card, "#FFFFFF", 0.12) : mix(card, "#0E0E10", 0.1);
  const field = dark ? mix(card, "#FFFFFF", 0.05) : "#FFFFFF";

  // Page background: in dark mode, darken whatever the merchant picked.
  const pageBg = dark ? mix(theme.background, "#0E0E10", 0.85) : theme.background;

  // Accent as a fill (buttons) gets an auto-picked label color;
  // accent as text (prices, links) is nudged until it passes AA on the card.
  const accentFg = bestText(theme.accent);
  const accentText = ensureContrast(theme.accent, card, 4.5);
  const accentSoft = mix(card, theme.accent, dark ? 0.2 : 0.1);
  // If the accent is nearly invisible against the card (e.g. white on white),
  // outline accent-filled controls so they stay perceivable.
  const accentRing = contrast(theme.accent, card) < 1.5 ? border : theme.accent;

  const r = theme.radius;
  return {
    "--co-font": FONTS[theme.font].stack,
    "--co-page": pageBg,
    "--co-page-fg": bestText(pageBg, [fg, dark ? "#FFFFFF" : "#0E0E10", "#FFFFFF", "#0E0E10"]),
    "--co-card": card,
    "--co-fg": fg,
    "--co-muted": muted,
    "--co-border": border,
    "--co-field": field,
    "--co-accent": theme.accent,
    "--co-accent-fg": accentFg,
    "--co-accent-text": accentText,
    "--co-accent-soft": accentSoft,
    "--co-accent-ring": accentRing,
    "--co-radius": `${r}px`,
    // Inner elements get a proportionally smaller radius so nesting looks right.
    "--co-radius-sm": `${Math.max(0, Math.round(r * 0.6))}px`,
    "--co-radius-card": `${Math.round(r * 1.4)}px`,
  };
}
