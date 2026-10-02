"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useState } from "react";
import { setCookie, THEME_COOKIE, type ThemePref } from "./nav";

const ORDER: ThemePref[] = ["system", "light", "dark"];
const META = {
  system: { icon: Monitor, label: "System" },
  light: { icon: Sun, label: "Light" },
  dark: { icon: Moon, label: "Dark" },
} as const;

/**
 * Cycles System → Light → Dark. The choice is a cookie the root layout reads,
 * so the next page load renders in the right theme with no flash.
 */
export function ThemeToggle({ initial }: { initial: ThemePref }) {
  const [pref, setPref] = useState<ThemePref>(initial);
  const next = ORDER[(ORDER.indexOf(pref) + 1) % ORDER.length];
  const { icon: Icon, label } = META[pref];

  function choose(p: ThemePref) {
    setPref(p);
    setCookie(THEME_COOKIE, p);
    if (p === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = p;
  }

  return (
    <button
      type="button"
      onClick={() => choose(next)}
      aria-label={`Theme: ${label}. Switch to ${META[next].label}`}
      title={`Theme: ${label}`}
      className="grid size-9 place-items-center rounded-control text-app-muted hover:bg-app-sunken hover:text-app-fg"
    >
      <Icon size={18} aria-hidden="true" />
    </button>
  );
}
