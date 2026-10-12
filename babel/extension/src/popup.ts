/** The toolbar popup: connect, pick a language, translate or switch back. */
import { defaultLanguage, isLanguageCode, LANGUAGES } from "./shared/languages";
import type { BackgroundRequest, Done, MeResponse, TabStatus } from "./shared/messages";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const send = <T>(request: BackgroundRequest) => chrome.runtime.sendMessage(request) as Promise<T>;

const ui = {
  loading: $("loading"),
  connect: $("connect"),
  ready: $("ready"),
  language: $<HTMLSelectElement>("language"),
  button: $<HTMLButtonElement>("translate-button"),
  status: $("status"),
  usage: $("usage"),
  email: $("email"),
};

let tabId: number | null = null;
let poll: ReturnType<typeof setInterval> | null = null;

function show(section: "loading" | "connect" | "ready") {
  ui.loading.hidden = section !== "loading";
  ui.connect.hidden = section !== "connect";
  ui.ready.hidden = section !== "ready";
}

function setStatus(text: string, error = false) {
  ui.status.textContent = text;
  ui.status.classList.toggle("error", error);
}

/** Matches the button and status line to what the tab is doing. */
async function refresh() {
  if (tabId === null) return;
  const status = await send<TabStatus>({ type: "tabStatus", tabId });
  if (!status.ok) return;
  const state = status.state;
  const sameLanguage = status.to === ui.language.value;
  ui.button.disabled = false;
  if (state.kind === "translating") {
    ui.button.textContent = "Show original";
    setStatus(state.total ? `Translating… ${Math.round((state.done / state.total) * 100)}%` : "Translating…");
  } else if (state.kind === "translated" && sameLanguage) {
    ui.button.textContent = "Show original";
    setStatus("This page is translated.");
  } else if (state.kind === "original" && sameLanguage) {
    ui.button.textContent = "Show translation";
    setStatus("Showing the original.");
  } else if (state.kind === "error") {
    ui.button.textContent = "Try again";
    setStatus(state.message, true);
  } else {
    ui.button.textContent = "Translate this page";
    setStatus("");
  }
}

async function main() {
  for (const l of LANGUAGES) ui.language.add(new Option(l.native === l.name ? l.native : `${l.native} · ${l.name}`, l.code));
  const saved = (await chrome.storage.local.get("language")).language as string | undefined;
  ui.language.value = saved && isLanguageCode(saved) ? saved : defaultLanguage();

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  tabId = tab?.id ?? null;

  const me = await send<MeResponse>({ type: "me" });
  if (!me.ok) {
    show("connect");
    return;
  }
  ui.email.textContent = me.email;
  ui.usage.textContent = `${me.plan} plan · ${me.translations.used} of ${me.translations.limit} translations today. A page counts as one.`;
  show("ready");
  await refresh();
  poll = setInterval(() => void refresh(), 600);
}

$("connect-button").addEventListener("click", () => {
  void send({ type: "openConnect" });
  window.close();
});

ui.language.addEventListener("change", () => {
  void chrome.storage.local.set({ language: ui.language.value });
  void refresh();
});

ui.button.addEventListener("click", async () => {
  if (tabId === null) return;
  ui.button.disabled = true;
  const status = await send<TabStatus>({ type: "tabStatus", tabId });
  const showing = status.ok && status.to === ui.language.value && (status.state.kind === "translated" || status.state.kind === "translating" || status.state.kind === "original");
  const result = await send<Done>(showing ? { type: "toggleTab", tabId } : { type: "translateTab", tabId, to: ui.language.value });
  if (!result.ok) setStatus(result.message, true);
  ui.button.disabled = false;
  await refresh();
});

$("disconnect").addEventListener("click", async () => {
  await send({ type: "disconnect" });
  show("connect");
});

window.addEventListener("unload", () => {
  if (poll) clearInterval(poll);
});

void main();
