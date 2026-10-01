/**
 * Per-viewer UI preferences kept in localStorage. Applied by an inline script before first
 * paint (see app/layout.tsx), so the theme and the sidebar width never flash or shift.
 */
export type ThemePref = 'system' | 'light' | 'dark';

export const PREF_KEYS = { theme: 'lumen.theme', sidebar: 'lumen.sidebar' } as const;

/** Runs in <head> before paint. Kept tiny and dependency-free on purpose. */
export const prefsScript = `(function(){try{var d=document.documentElement;var t=localStorage.getItem('${PREF_KEYS.theme}')||'system';var m=window.matchMedia('(prefers-color-scheme: dark)');d.dataset.themePref=t;d.dataset.theme=t==='system'?(m.matches?'dark':'light'):t;if(localStorage.getItem('${PREF_KEYS.sidebar}')==='collapsed')d.dataset.sidebar='collapsed';}catch(e){}})();`;

export function readPref(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writePref(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private mode or blocked storage: the preference just won't persist.
  }
}
