'use client';

import { createContext, useCallback, useContext, useEffect, useMemo } from 'react';

import { useHtmlData } from './html-attr';
import { PREF_KEYS, writePref, type ThemePref } from './prefs';

type ThemeState = { pref: ThemePref; resolved: 'light' | 'dark'; setPref: (p: ThemePref) => void };

const Ctx = createContext<ThemeState | null>(null);

const media = () => window.matchMedia('(prefers-color-scheme: dark)');
const resolve = (p: ThemePref): 'light' | 'dark' => (p === 'system' ? (media().matches ? 'dark' : 'light') : p);

/** System by default, with a manual override. <html data-theme> is the source of truth for CSS. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const pref = (useHtmlData('themePref') as ThemePref | undefined) ?? 'system';
  const resolved = useHtmlData('theme') === 'dark' ? 'dark' : 'light';

  // While on "system", follow OS changes live.
  useEffect(() => {
    if (pref !== 'system') return;
    const m = media();
    const onChange = () => {
      document.documentElement.dataset.theme = resolve('system');
    };
    m.addEventListener('change', onChange);
    return () => m.removeEventListener('change', onChange);
  }, [pref]);

  const setPref = useCallback((p: ThemePref) => {
    const d = document.documentElement;
    d.dataset.themePref = p;
    d.dataset.theme = resolve(p);
    writePref(PREF_KEYS.theme, p);
  }, []);

  const value = useMemo(() => ({ pref, resolved, setPref }) as ThemeState, [pref, resolved, setPref]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
