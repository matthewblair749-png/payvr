/**
 * Injected into a tab when the person asks Babel to translate it. Safe to
 * inject twice: the second run finds the first and does nothing.
 */
import { getLanguage, isLanguageCode } from "../shared/languages";
import type { BatchResponse, ContentCommand, TabStatus } from "../shared/messages";
import { EXTENSION_LIMITS } from "@babel-app/features/extension/limits";
import { PageTranslator, TranslateError, type TranslatorState } from "./page-translator";
import { Pill } from "./pill";

declare global {
  interface Window {
    __babelLoaded?: boolean;
  }
}

if (!window.__babelLoaded) {
  window.__babelLoaded = true;

  let translator: PageTranslator | null = null;
  let pill: Pill | null = null;

  function pageId(): string {
    return typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function start(to: string): void {
    if (!isLanguageCode(to)) return;
    if (translator?.targetLang === to && translator.state.kind !== "original" && translator.state.kind !== "error") return;

    // Switching language: put the page back first, then start fresh.
    if (translator) {
      translator.showOriginal();
      translator.destroy();
    }
    pill?.remove();

    const id = pageId();
    pill = new Pill(document, getLanguage(to).native, {
      toggle: () => void translator?.toggle(),
      connect: () => void chrome.runtime.sendMessage({ type: "openConnect" }),
    });
    translator = new PageTranslator(document, to, {
      maxSegments: EXTENSION_LIMITS.maxSegments,
      maxChars: EXTENSION_LIMITS.maxRequestChars,
      maxSegmentChars: EXTENSION_LIMITS.maxSegmentChars,
      onState: (state: TranslatorState) => pill?.update(state),
      translateBatch: async (segments) => {
        const result = (await chrome.runtime.sendMessage({ type: "translateBatch", pageId: id, to, segments })) as BatchResponse | undefined;
        if (!result) throw new TranslateError("network", "Couldn't reach Babel. Check your connection.");
        if (!result.ok) throw new TranslateError(result.code, result.message);
        return result.translations;
      },
    });
    pill.update({ kind: "translating", done: 0, total: 0 });
    void translator.translate();
  }

  chrome.runtime.onMessage.addListener((command: ContentCommand, _sender, sendResponse) => {
    switch (command.type) {
      case "babel:translate":
        start(command.to);
        sendResponse({ ok: true });
        break;
      case "babel:toggle":
        if (translator && translator.state.kind !== "error") void translator.toggle();
        else start(translator?.targetLang ?? command.fallbackTo);
        sendResponse({ ok: true });
        break;
      case "babel:status":
        sendResponse({
          ok: true,
          injected: true,
          state: translator?.state ?? { kind: "idle" },
          to: translator?.targetLang ?? null,
        } satisfies TabStatus);
        break;
    }
    return false;
  });
}
