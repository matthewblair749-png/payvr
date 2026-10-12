"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** True on Apple platforms, where shortcuts use ⌘ instead of Ctrl. False on the server. */
export function useIsMac(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent),
    () => false,
  );
}
