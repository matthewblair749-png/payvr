"use client";

/**
 * Client shell for /pay/[slug]: picks live (Stripe) or preview rendering and
 * owns the analytics tracker for this page view.
 */
import { useCallback, useEffect, useRef } from "react";
import { answerSurveyAction } from "@/app/pay/[slug]/actions";
import type { CheckoutConfig, CheckoutProduct } from "@/lib/checkout/schema";
import { createTracker, type Tracker } from "@/lib/tracking/tracker";
import { CheckoutView } from "./checkout-view";
import { LiveCheckout } from "./live-checkout";

type TrackEvent = { kind: "focus"; field: string } | { kind: "pay" } | { kind: "paid" };

export function HostedCheckout({
  config,
  product,
  slug,
  pageId,
  variantId,
  sessionId,
  live,
}: {
  config: CheckoutConfig;
  product: CheckoutProduct;
  slug: string;
  pageId: string;
  variantId: string | null;
  sessionId: string;
  /** Present when the merchant can take payments. */
  live: { publishableKey: string; stripeAccountId: string } | null;
}) {
  const tracker = useRef<Tracker | null>(null);

  useEffect(() => {
    const t = createTracker({ pageId, variantId, sessionId });
    tracker.current = t;
    t.view();
    return () => {
      t.dispose();
      tracker.current = null;
    };
  }, [pageId, variantId, sessionId]);

  const onTrack = useCallback((e: TrackEvent) => {
    const t = tracker.current;
    if (!t) return;
    if (e.kind === "focus") t.focus(e.field);
    else if (e.kind === "pay") t.payClick();
    else t.paid();
  }, []);

  // Answers are tied to this session's order on the server (live checkouts only).
  const onSurveyAnswer = useCallback(
    async (question: CheckoutConfig["survey"]["question"], answer: string) => {
      const res = await answerSurveyAction({ slug, sessionId, question, answer });
      return res.ok;
    },
    [slug, sessionId],
  );

  return live ? (
    <LiveCheckout
      config={config}
      product={product}
      slug={slug}
      sessionId={sessionId}
      publishableKey={live.publishableKey}
      stripeAccountId={live.stripeAccountId}
      onTrack={onTrack}
      onSurveyAnswer={onSurveyAnswer}
    />
  ) : (
    <CheckoutView
      config={config}
      product={product}
      mode="preview"
      className="min-h-dvh"
      onTrack={onTrack}
      paymentsDisabledReason="This checkout isn't taking payments yet."
    />
  );
}
