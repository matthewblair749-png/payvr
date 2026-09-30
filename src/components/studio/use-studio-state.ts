"use client";

/**
 * Studio editor state: one CheckoutConfig per variant ("A" = the page itself,
 * "B" = the experiment variant), which one is being edited, and undo/redo
 * history across both.
 */
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { editorReducer, type EditorAction } from "@/lib/checkout/reducer";
import type { CheckoutConfig } from "@/lib/checkout/schema";

export type Target = "A" | "B";
type Configs = { A: CheckoutConfig; B?: CheckoutConfig };

type State = {
  configs: Configs;
  target: Target;
  past: Configs[];
  future: Configs[];
  /** Used to coalesce rapid edits of the same kind (e.g. slider drags) into one undo step. */
  lastKey: string | null;
  lastAt: number;
};

type Action =
  | { type: "edit"; action: EditorAction }
  | { type: "setTarget"; target: Target }
  | { type: "setB"; config: CheckoutConfig | undefined }
  | { type: "replace"; target: Target; config: CheckoutConfig }
  | { type: "undo" }
  | { type: "redo" };

const HISTORY_LIMIT = 100;
const COALESCE_MS = 600;

function editKey(a: EditorAction) {
  if (a.type === "theme") return `theme:${Object.keys(a.patch).join(",")}`;
  if (a.type === "brand") return `brand:${Object.keys(a.patch).join(",")}`;
  if (a.type === "updateBlock") return `block:${a.id}:${Object.keys(a.props).join(",")}`;
  return null; // structural edits always get their own undo step
}

function commit(state: State, configs: Configs, key: string | null): State {
  const now = Date.now();
  const coalesce = key !== null && key === state.lastKey && now - state.lastAt < COALESCE_MS;
  return {
    ...state,
    configs,
    past: coalesce ? state.past : [...state.past.slice(-HISTORY_LIMIT + 1), state.configs],
    future: [],
    lastKey: key,
    lastAt: now,
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "edit": {
      const current = state.configs[state.target];
      if (!current) return state;
      const next = editorReducer(current, action.action);
      if (next === current) return state;
      return commit(state, { ...state.configs, [state.target]: next }, editKey(action.action));
    }
    case "replace":
      return commit(state, { ...state.configs, [action.target]: action.config }, null);
    case "setB":
      // Adding/removing a variant is a server-side operation, so it resets
      // history rather than being undoable (undo could desync from the server).
      return {
        ...state,
        configs: { ...state.configs, B: action.config },
        target: action.config ? "B" : "A",
        past: [],
        future: [],
        lastKey: null,
      };
    case "setTarget":
      return action.target === "B" && !state.configs.B ? state : { ...state, target: action.target, lastKey: null };
    case "undo": {
      const prev = state.past[state.past.length - 1];
      if (!prev) return state;
      return {
        ...state,
        configs: prev,
        past: state.past.slice(0, -1),
        future: [state.configs, ...state.future],
        target: prev[state.target] ? state.target : "A",
        lastKey: null,
      };
    }
    case "redo": {
      const next = state.future[0];
      if (!next) return state;
      return {
        ...state,
        configs: next,
        past: [...state.past, state.configs],
        future: state.future.slice(1),
        target: next[state.target] ? state.target : "A",
        lastKey: null,
      };
    }
  }
}

export type SaveStatus = "saved" | "saving" | "unsaved" | "error";

/**
 * Editor state + debounced autosave. `save` persists one target's config;
 * it's called at most once per target per debounce window.
 */
export function useStudioState(
  initial: Configs,
  save: (target: Target, config: CheckoutConfig) => Promise<{ ok: boolean; error?: string }>,
) {
  const [state, dispatch] = useReducer(reducer, {
    configs: initial,
    target: "A",
    past: [],
    future: [],
    lastKey: null,
    lastAt: 0,
  });
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [saveError, setSaveError] = useState<string | null>(null);

  // Autosave: diff against what the server last acknowledged.
  const persisted = useRef<Configs>(initial);
  const latest = useRef<Configs>(initial);
  const saveRef = useRef(save);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    saveRef.current = save;
    latest.current = state.configs;
  });

  /** Persist every dirty target now. Resolves true when everything is saved. */
  const saveNow = useCallback(async (): Promise<boolean> => {
    if (timer.current) clearTimeout(timer.current);
    const snapshot = latest.current;
    const dirty = (["A", "B"] as const).filter((t) => snapshot[t] && snapshot[t] !== persisted.current[t]);
    if (!dirty.length) return true;
    setStatus("saving");
    const results = await Promise.all(dirty.map((t) => saveRef.current(t, snapshot[t]!)));
    const failed = results.find((r) => !r.ok);
    if (failed) {
      setStatus("error");
      setSaveError(failed.error ?? "Couldn't save");
      return false;
    }
    persisted.current = { ...persisted.current, ...Object.fromEntries(dirty.map((t) => [t, snapshot[t]])) };
    setSaveError(null);
    // Newer edits may have landed while we were saving.
    setStatus(latest.current === snapshot ? "saved" : "unsaved");
    return true;
  }, []);

  useEffect(() => {
    const dirty = (["A", "B"] as const).some((t) => state.configs[t] && state.configs[t] !== persisted.current[t]);
    if (!dirty) return;
    setStatus("unsaved");
    timer.current = setTimeout(() => void saveNow(), 700);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [state.configs, saveNow]);

  // Don't let people close the tab with unsaved work.
  useEffect(() => {
    if (status === "saved") return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [status]);

  /** Tell the autosaver a target was persisted by some other path (e.g. restore). */
  const markPersisted = useCallback((target: Target, config: CheckoutConfig | undefined) => {
    persisted.current = { ...persisted.current, [target]: config };
  }, []);

  return {
    configs: state.configs,
    target: state.target,
    config: state.configs[state.target] ?? state.configs.A,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    dispatch,
    edit: useCallback((action: EditorAction) => dispatch({ type: "edit", action }), []),
    status,
    saveError,
    markPersisted,
    flush: saveNow,
  };
}
