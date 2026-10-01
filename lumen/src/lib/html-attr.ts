'use client';

import { useSyncExternalStore } from 'react';

/**
 * Read a data-* attribute on <html> as React state. The pre-paint script sets these before
 * hydration, so the DOM is the source of truth; components re-render when it changes.
 */
function subscribe(onChange: () => void) {
  const obs = new MutationObserver(onChange);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-theme-pref', 'data-sidebar'] });
  return () => obs.disconnect();
}

export function useHtmlData(key: 'theme' | 'themePref' | 'sidebar'): string | undefined {
  return useSyncExternalStore(
    subscribe,
    () => document.documentElement.dataset[key],
    () => undefined,
  );
}

const noop = () => () => {};
/** False during SSR and hydration, true afterwards: for values that depend on the client clock. */
export function useMounted() {
  return useSyncExternalStore(noop, () => true, () => false);
}
