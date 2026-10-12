/**
 * Background service worker. Owns the account token (chrome.storage.local),
 * talks to the Babel API, and injects the page translator into a tab only
 * when the person asks (activeTab), so it never reads pages on its own.
 */
import { EXTENSION_LIMITS } from "@babel-app/features/extension/limits";
import { defaultLanguage, isLanguageCode } from "./shared/languages";
import type { BackgroundRequest, BatchResponse, ContentCommand, Done, Failure, MeResponse, TabStatus } from "./shared/messages";

const APP_URL = __APP_URL__;
const CONNECT_URL = `${APP_URL}/extension/connect`;

const fail = (code: string, message: string): Failure => ({ ok: false, code, message });

async function stored(): Promise<{ token?: string; email?: string; language?: string }> {
  return (await chrome.storage.local.get(["token", "email", "language"])) as { token?: string; email?: string; language?: string };
}

async function language(): Promise<string> {
  const { language: saved } = await stored();
  return saved && isLanguageCode(saved) ? saved : defaultLanguage();
}

/** Calls the Babel API with the stored token. Never throws. */
async function api<T>(path: string, init: RequestInit = {}): Promise<T | Failure> {
  const { token } = await stored();
  if (!token) return fail("unauthorized", "Connect the extension to your Babel account first.");
  let res: Response;
  try {
    res = await fetch(`${APP_URL}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
  } catch {
    return fail("network", "Couldn't reach Babel. Check your connection.");
  }
  if (res.status === 401) {
    // Disconnected from the dashboard, or the token was revoked.
    await chrome.storage.local.remove(["token", "email"]);
    return fail("unauthorized", "This browser isn't connected to Babel any more. Connect it again to keep translating.");
  }
  try {
    return (await res.json()) as T | Failure;
  } catch {
    return fail("server", "Babel sent back something unexpected. Try again in a moment.");
  }
}

async function sendToTab<T>(tabId: number, command: ContentCommand): Promise<T | null> {
  try {
    return (await chrome.tabs.sendMessage(tabId, command)) as T;
  } catch {
    return null; // no translator in this tab yet
  }
}

/** Injects the page translator into a tab if it isn't there yet. */
async function ensureInjected(tabId: number): Promise<Done & { fresh?: boolean }> {
  if (await sendToTab<TabStatus>(tabId, { type: "babel:status" })) return { ok: true };
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
    return { ok: true, fresh: true };
  } catch {
    return fail("restricted", "Babel can't translate this page. Browser pages and extension stores are off-limits.");
  }
}

async function translateTab(tabId: number, to: string): Promise<Done> {
  if (!isLanguageCode(to)) return fail("invalid_input", "Pick a language.");
  await chrome.storage.local.set({ language: to });
  const injected = await ensureInjected(tabId);
  if (!injected.ok) return injected;
  await sendToTab(tabId, { type: "babel:translate", to });
  return { ok: true };
}

async function toggleTab(tabId: number): Promise<Done> {
  const injected = await ensureInjected(tabId);
  if (!injected.ok) return injected;
  await sendToTab(tabId, { type: "babel:toggle", fallbackTo: await language() });
  return { ok: true };
}

async function handle(request: BackgroundRequest, sender: chrome.runtime.MessageSender): Promise<unknown> {
  // Our own popup page (as a popup, or opened in a tab). Content scripts report the web page's URL instead.
  const fromOurPopup = sender.id === chrome.runtime.id && (sender.url?.startsWith(chrome.runtime.getURL("popup.html")) ?? false);
  switch (request.type) {
    case "translateBatch": {
      if (!sender.tab) return fail("invalid_input", "Bad request.");
      const segments = request.segments.slice(0, EXTENSION_LIMITS.maxSegments);
      return api<BatchResponse>("/api/extension/translate", {
        method: "POST",
        body: JSON.stringify({ pageId: request.pageId, to: request.to, segments }),
      });
    }
    case "connect": {
      // Only the bridge script on Babel's own connect page may hand over a token.
      if (sender.id !== chrome.runtime.id || !sender.url?.startsWith(CONNECT_URL) || !/^bx_[\w-]{20,100}$/.test(request.token)) {
        return fail("invalid_input", "Refused.");
      }
      await chrome.storage.local.set({ token: request.token, email: request.email });
      return { ok: true };
    }
    case "me":
      return fromOurPopup ? api<MeResponse>("/api/extension/me") : fail("invalid_input", "Refused.");
    case "disconnect":
      if (!fromOurPopup) return fail("invalid_input", "Refused.");
      await chrome.storage.local.remove(["token", "email"]);
      return { ok: true };
    case "translateTab":
      return fromOurPopup ? translateTab(request.tabId, request.to) : fail("invalid_input", "Refused.");
    case "toggleTab":
      return fromOurPopup ? toggleTab(request.tabId) : fail("invalid_input", "Refused.");
    case "tabStatus":
      if (!fromOurPopup) return fail("invalid_input", "Refused.");
      return (await sendToTab<TabStatus>(request.tabId, { type: "babel:status" })) ?? { ok: true, injected: false, state: { kind: "idle" }, to: null };
    case "openConnect":
      await chrome.tabs.create({ url: CONNECT_URL });
      return { ok: true };
  }
}

chrome.runtime.onMessage.addListener((request: BackgroundRequest, sender, sendResponse) => {
  handle(request, sender)
    .then(sendResponse)
    .catch(() => sendResponse(fail("unknown", "Something went wrong. Try again.")));
  return true; // answer asynchronously
});

// Keyboard shortcut (Alt+Shift+T by default): translate, or switch back.
chrome.commands.onCommand.addListener((command, tab) => {
  if (command === "toggle-translation" && tab?.id !== undefined) void toggleTab(tab.id);
});
