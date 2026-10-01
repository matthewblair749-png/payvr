import type { Metadata } from "next";
import Link from "next/link";
import { LogoMark } from "@/components/brand/logo";
import { formatMoney } from "@/lib/utils";
import { cookies } from "next/headers";
import { themeToVars } from "@/lib/checkout/theme";
import { resolveCheckout } from "@/server/dal/public-checkout";
import { paymentResult } from "@/server/payments/checkout";
import { CompleteCheck, CompleteSurvey } from "./complete-check";

export const metadata: Metadata = { title: "Payment", robots: { index: false } };

/**
 * Return page for payment methods that redirect (3-D Secure, bank redirects,
 * buy-now-pay-later). The source of truth is Stripe, not the query string:
 * we re-fetch the PaymentIntent server-side and check it belongs to this page.
 */
export default async function CompletePage({ params, searchParams }: PageProps<"/pay/[slug]/complete">) {
  const { slug } = await params;
  const sp = await searchParams;
  const piId = typeof sp.payment_intent === "string" ? sp.payment_intent : "";
  const result = piId ? await paymentResult(slug, piId).catch(() => null) : null;

  const ok = result?.status === "succeeded";
  const processing = result?.status === "processing";
  const checkout =
    (ok || processing) && result?.sessionId
      ? await resolveCheckout(slug, (await cookies()).get("lumen_vid")?.value ?? "anonymous")
      : null;

  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-surface px-6 text-center">
      {ok || processing ? <CompleteCheck /> : <LogoMark size={56} title="" />}
      <h1 className="font-display text-3xl font-bold tracking-[-0.04em]">
        {ok ? "Thank you!" : processing ? "Payment processing" : "That payment didn't go through"}
      </h1>
      <p className="max-w-sm text-muted-strong">
        {ok && result
          ? `Your payment of ${formatMoney(result.amountCents, result.currency.toUpperCase())} went through. A receipt is on its way.`
          : processing
            ? "Your bank is confirming the payment. You'll get a receipt by email once it clears."
            : "You haven't been charged. You can go back and try another payment method."}
      </p>
      {checkout?.config.survey.enabled && result?.sessionId && (
        <div className="w-full max-w-md" style={{ ...themeToVars(checkout.config.theme), fontFamily: "var(--co-font)" }}>
          <CompleteSurvey
            slug={slug}
            sessionId={result.sessionId}
            question={checkout.config.survey.question}
            brandName={checkout.config.brand.name}
          />
        </div>
      )}
      {!ok && !processing && (
        <Link href={`/pay/${slug}`} className="rounded-full bg-ink px-6 py-3 font-semibold text-white">
          Back to checkout
        </Link>
      )}
    </main>
  );
}
