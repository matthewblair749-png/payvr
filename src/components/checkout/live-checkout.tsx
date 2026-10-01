"use client";

/**
 * Hosted checkout with real payments.
 *
 * Uses Stripe's "deferred intent" flow: the Payment Element renders
 * immediately with the displayed amount; when the buyer presses Pay we
 *   1. validate the form (elements.submit),
 *   2. ask OUR server to price the order and create the PaymentIntent,
 *   3. confirm with Stripe.js.
 * Card numbers live only inside Stripe's iframes. lumen never sees them.
 */
import { Elements, LinkAuthenticationElement, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type Appearance, type Stripe as StripeJs, type StripeElementsOptions } from "@stripe/stripe-js";
import { useCallback, useMemo, useRef, useState } from "react";
import { preparePaymentAction } from "@/app/pay/[slug]/actions";
import { FONTS, type FontKey } from "@/lib/checkout/meta";
import { computeTotals, EMPTY_SELECTIONS, type BuyerSelections, type Totals } from "@/lib/checkout/pricing";
import type { CheckoutConfig, CheckoutProduct } from "@/lib/checkout/schema";
import { themeToVars } from "@/lib/checkout/theme";
import { CheckoutView } from "./checkout-view";

type TrackFn = NonNullable<Parameters<typeof CheckoutView>[0]["onTrack"]>;

/** Google Fonts stylesheets for each checkout font, loaded *inside* Stripe's iframe. */
const FONT_CSS: Record<FontKey, string> = {
  dmSans: "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap",
  sora: "https://fonts.googleapis.com/css2?family=Sora:wght@400;600&display=swap",
  spaceGrotesk: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600&display=swap",
  fraunces: "https://fonts.googleapis.com/css2?family=Fraunces:wght@400;600&display=swap",
  plexMono: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&display=swap",
};

let stripePromise: Promise<StripeJs | null> | null = null;
const getStripeJs = (pk: string) => (stripePromise ??= loadStripe(pk));

function appearanceFor(config: CheckoutConfig): Appearance {
  const v = themeToVars(config.theme);
  return {
    theme: config.theme.mode === "dark" ? "night" : "stripe",
    variables: {
      colorPrimary: config.theme.accent,
      colorBackground: v["--co-field"],
      colorText: v["--co-fg"],
      colorTextSecondary: v["--co-muted"],
      colorDanger: config.theme.mode === "dark" ? "#FF8A80" : "#B42318",
      fontFamily: `"${FONTS[config.theme.font].family}", system-ui, sans-serif`,
      borderRadius: v["--co-radius-sm"],
      spacingUnit: "4px",
    },
    rules: {
      ".Input": { borderColor: v["--co-border"], boxShadow: "none" },
      ".Input:focus": { borderColor: v["--co-accent-ring"], boxShadow: `0 0 0 1px ${v["--co-accent-ring"]}` },
      ".Label": { fontWeight: "500" },
    },
  };
}

function deviceType(): "mobile" | "tablet" | "desktop" {
  const w = window.innerWidth;
  return w < 640 ? "mobile" : w < 1024 ? "tablet" : "desktop";
}

export function LiveCheckout({
  config,
  product,
  slug,
  sessionId,
  publishableKey,
  stripeAccountId,
  onTrack,
}: {
  config: CheckoutConfig;
  product: CheckoutProduct;
  slug: string;
  sessionId: string;
  publishableKey: string;
  stripeAccountId: string;
  onTrack?: TrackFn;
}) {
  const initial = useMemo(() => computeTotals(config, product, EMPTY_SELECTIONS), [config, product]);
  const options: StripeElementsOptions = useMemo(
    () => ({
      mode: "payment",
      amount: initial.totalCents,
      currency: product.currency.toLowerCase(),
      // Must match the PaymentIntent's on_behalf_of so the right payment methods show.
      onBehalfOf: stripeAccountId,
      appearance: appearanceFor(config),
      fonts: [{ cssSrc: FONT_CSS[config.theme.font] }],
      loader: "auto",
    }),
    // Recreating Elements resets the buyer's input, so only on real theme changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config.theme, product.currency, stripeAccountId],
  );

  return (
    <Elements stripe={getStripeJs(publishableKey)} options={options}>
      <LiveCheckoutInner config={config} product={product} slug={slug} sessionId={sessionId} onTrack={onTrack} />
    </Elements>
  );
}

function LiveCheckoutInner({
  config,
  product,
  slug,
  sessionId,
  onTrack,
}: {
  config: CheckoutConfig;
  product: CheckoutProduct;
  slug: string;
  sessionId: string;
  onTrack?: TrackFn;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const orderId = useRef<string | null>(null);
  const lastAmount = useRef<number | null>(null);
  const lastPayIn4 = useRef(false);

  // Keep Stripe's amount (and pay-later ordering) in sync with the buyer's choices.
  const onTotalsChange = useCallback(
    (totals: Totals) => {
      if (!elements) return;
      if (lastAmount.current !== totals.totalCents) {
        lastAmount.current = totals.totalCents;
        elements.update({ amount: totals.totalCents });
      }
      if (lastPayIn4.current !== totals.payIn4) {
        lastPayIn4.current = totals.payIn4;
        // "Pay in 4" puts buy-now-pay-later methods first when the merchant has them enabled.
        elements.update({
          paymentMethodOrder: totals.payIn4 ? ["klarna", "afterpay_clearpay", "affirm", "card"] : ["card", "link"],
        } as Parameters<typeof elements.update>[0]);
      }
    },
    [elements],
  );

  const onPay = useCallback(
    async (selections: BuyerSelections, totals: Totals) => {
      if (!stripe || !elements) return false;
      setError(null);

      const { error: submitError } = await elements.submit();
      if (submitError) {
        setError(submitError.message ?? "Please check your payment details.");
        return false;
      }

      const prepared = await preparePaymentAction({
        slug,
        sessionId,
        selections,
        orderId: orderId.current,
        device: deviceType(),
      });
      if (!prepared.ok) {
        setError(prepared.error);
        return false;
      }
      orderId.current = prepared.data.orderId;
      if (prepared.data.amountCents !== totals.totalCents) {
        // The page changed under the buyer (e.g. the merchant republished). Never charge a surprise amount.
        elements.update({ amount: prepared.data.amountCents });
        setError("The total was updated. Please review it and press Pay again.");
        return false;
      }

      const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
        elements,
        clientSecret: prepared.data.clientSecret,
        confirmParams: {
          return_url: `${window.location.origin}/pay/${slug}/complete`,
          ...(email ? { receipt_email: email } : {}),
        },
        redirect: "if_required",
      });
      if (confirmError) {
        setError(
          confirmError.type === "card_error" || confirmError.type === "validation_error"
            ? (confirmError.message ?? "Your payment was declined.")
            : "Something went wrong with the payment. You haven't been charged.",
        );
        return false;
      }
      return paymentIntent?.status === "succeeded" || paymentIntent?.status === "processing";
    },
    [stripe, elements, slug, sessionId, email],
  );

  const slot = (
    <div className="space-y-3">
      {/* Stripe's fields are iframes: focus doesn't bubble to our DOM, so report it explicitly. */}
      <LinkAuthenticationElement onChange={(e) => setEmail(e.value.email)} onFocus={() => onTrack?.({ kind: "focus", field: "email" })} />
      <PaymentElement
        options={{ layout: { type: "tabs", defaultCollapsed: false } }}
        onFocus={() => onTrack?.({ kind: "focus", field: "card" })}
      />
      <div aria-live="assertive">
        {error && (
          <p role="alert" className="rounded-(--co-radius-sm) bg-(--co-accent-soft) px-3 py-2 text-sm font-medium">
            {error}
          </p>
        )}
      </div>
    </div>
  );

  return (
    <CheckoutView
      config={config}
      product={product}
      mode="live"
      className="min-h-dvh"
      paymentSlot={slot}
      onPay={onPay}
      onTotalsChange={onTotalsChange}
      onTrack={onTrack}
      successMessage={email ? `A receipt is on its way to ${email}.` : undefined}
    />
  );
}
