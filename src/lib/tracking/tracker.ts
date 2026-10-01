/**
 * Tiny browser tracker for hosted checkouts (no dependencies, ~1KB).
 *
 * - Batches events and flushes every few seconds, and with sendBeacon when
 *   the page is hidden, so nothing is lost when the buyer closes the tab.
 * - Each field/step is recorded once per session (we want "did they touch it",
 *   not a keystroke log). Never records values.
 * - Honors Global Privacy Control and Do Not Track by not tracking at all.
 */
import type { ClientEvent } from "./events";

export type Tracker = {
  view(): void;
  focus(field: string): void;
  step(step: "engaged" | "details" | "payment" | "submitted"): void;
  payClick(): void;
  paid(): void;
  dispose(): void;
};

const NOOP: Tracker = { view() {}, focus() {}, step() {}, payClick() {}, paid() {}, dispose() {} };

export function createTracker(opts: { pageId: string; variantId: string | null; sessionId: string; endpoint?: string }): Tracker {
  if (typeof window === "undefined") return NOOP;
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  if (nav.globalPrivacyControl || nav.doNotTrack === "1") return NOOP;

  const endpoint = opts.endpoint ?? "/api/events";
  const queue: ClientEvent[] = [];
  const seen = new Set<string>();
  let lastStep: ClientEvent["step"] = "view";
  let lastField: string | undefined;
  let paid = false;
  let viewed = false;

  const once = (key: string) => (seen.has(key) ? false : (seen.add(key), true));
  const push = (e: ClientEvent) => {
    queue.push(e);
    if (queue.length >= 20) flush();
  };

  function flush(useBeacon = false) {
    if (!queue.length) return;
    const body = JSON.stringify({ pageId: opts.pageId, variantId: opts.variantId, sessionId: opts.sessionId, events: queue.splice(0, 30) });
    // text/plain keeps sendBeacon a "simple" request.
    const blob = new Blob([body], { type: "text/plain" });
    if (useBeacon && navigator.sendBeacon?.(endpoint, blob)) return;
    void fetch(endpoint, { method: "POST", body: blob, keepalive: true }).catch(() => {});
  }

  const ORDER = ["view", "engaged", "details", "payment", "submitted"] as const;
  function advance(step: (typeof ORDER)[number]) {
    if (ORDER.indexOf(step) > ORDER.indexOf(lastStep ?? "view")) lastStep = step;
    if (step !== "view" && once(`step:${step}`)) push({ type: "STEP", step });
  }

  const interval = setInterval(() => flush(), 4_000);
  const onHide = () => {
    if (document.visibilityState !== "hidden") return;
    flush(true);
  };
  const onPageHide = () => {
    // Leaving without paying → one ABANDON event with where they got to.
    if (viewed && !paid && once("abandon")) push({ type: "ABANDON", step: lastStep, field: lastField });
    flush(true);
  };
  document.addEventListener("visibilitychange", onHide);
  window.addEventListener("pagehide", onPageHide);

  return {
    view() {
      if (!once("view")) return;
      viewed = true;
      // Where the visit came from: the referrer's host only, plus utm_source.
      let ref: string | undefined;
      try {
        ref = document.referrer ? new URL(document.referrer).hostname.slice(0, 100) : undefined;
      } catch {}
      const utm = new URLSearchParams(location.search).get("utm_source")?.replace(/[^\w.-]/g, "").slice(0, 40) || undefined;
      push({ type: "VIEW", step: "view", ref, utm });
      flush();
    },
    focus(field) {
      lastField = field;
      // Email and shipping are "details"; card entry is "payment".
      const paymentField = field === "card" || field === "payment";
      advance(paymentField ? "payment" : "engaged");
      if (once(`focus:${field}`)) push({ type: "FIELD_FOCUS", field });
    },
    step(step) {
      advance(step);
    },
    payClick() {
      advance("submitted");
      push({ type: "PAY_CLICK", step: "submitted" });
      flush();
    },
    paid() {
      // PAYMENT_SUCCEEDED itself is recorded by the Stripe webhook (trusted);
      // this only stops us from logging an abandon.
      paid = true;
    },
    dispose() {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
      flush(true);
    },
  };
}
