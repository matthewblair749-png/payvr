import type { TranslatorState } from "../content/page-translator";

/** Messages the background service worker handles. */
export type BackgroundRequest =
  | { type: "translateBatch"; pageId: string; to: string; segments: string[] }
  | { type: "connect"; token: string; email: string }
  | { type: "me" }
  | { type: "disconnect" }
  | { type: "translateTab"; tabId: number; to: string }
  | { type: "toggleTab"; tabId: number }
  | { type: "tabStatus"; tabId: number }
  | { type: "openConnect" };

export type Failure = { ok: false; code: string; message: string };

export type MeResponse = { ok: true; email: string; plan: string; translations: { used: number; limit: number } } | Failure;
export type BatchResponse = { ok: true; translations: (string | null)[] } | Failure;
export type TabStatus = { ok: true; injected: boolean; state: TranslatorState; to: string | null } | Failure;
export type Done = { ok: true } | Failure;

/** Messages the content script (in the page) handles. */
export type ContentCommand = { type: "babel:translate"; to: string } | { type: "babel:toggle"; fallbackTo: string } | { type: "babel:status" };
