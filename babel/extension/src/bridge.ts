/**
 * Runs only on Babel's /extension/connect page. Passes the account token the
 * page hands over to the background worker, and tells the page it worked.
 */
import { BRIDGE, type ExtensionToWeb, type WebToExtension } from "@babel-app/features/extension/bridge";

function reply(message: ExtensionToWeb) {
  window.postMessage(message, window.location.origin);
}

window.addEventListener("message", (event: MessageEvent) => {
  if (event.source !== window || event.origin !== window.location.origin) return;
  const data = event.data as Partial<WebToExtension> | null;
  if (data?.source !== BRIDGE.web) return;

  if (data.type === "ping") reply({ source: BRIDGE.extension, type: "pong", version: __VERSION__ });

  if (data.type === "connect" && typeof data.token === "string" && typeof data.email === "string") {
    chrome.runtime.sendMessage({ type: "connect", token: data.token, email: data.email }, (result: { ok: boolean } | undefined) => {
      if (result?.ok) reply({ source: BRIDGE.extension, type: "connected" });
    });
  }
});
