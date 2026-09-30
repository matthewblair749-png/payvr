import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { LogoMark } from "@/components/brand/logo";
import { CheckoutView } from "@/components/checkout/checkout-view";
import { getPublishedCheckout, resolveCheckout } from "@/server/dal/public-checkout";

/**
 * Hosted checkout: lumen.app/pay/[slug].
 * One indexed query, server-rendered, A/B-aware. Payments go live in Phase 3.
 */
export async function generateMetadata({ params }: PageProps<"/pay/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPublishedCheckout(slug);
  if (!page) return { title: "Checkout not found", robots: { index: false } };
  const brand = (page.publishedVersion?.config as { brand?: { name?: string } } | null)?.brand?.name ?? "Checkout";
  return {
    title: { absolute: `${page.product?.name ?? "Checkout"} · ${brand}` },
    robots: { index: false, follow: false },
  };
}

export default async function PayPage({ params }: PageProps<"/pay/[slug]">) {
  const { slug } = await params;
  const visitorId = (await cookies()).get("lumen_vid")?.value ?? "anonymous";
  const checkout = await resolveCheckout(slug, visitorId);
  if (!checkout) notFound();

  return (
    <div className="flex min-h-dvh flex-col" data-variant={checkout.variantKey ?? undefined}>
      <main id="main" className="flex-1">
        <h1 className="sr-only">
          Checkout: {checkout.product.name} from {checkout.config.brand.name}
        </h1>
        <CheckoutView
          config={checkout.config}
          product={checkout.product}
          mode="preview"
          className="min-h-dvh"
          paymentsDisabledReason={checkout.acceptsPayments ? undefined : "This checkout isn't taking payments yet."}
        />
      </main>
      <footer className="flex items-center justify-center gap-1.5 bg-white py-3 text-xs text-muted-strong">
        <LogoMark size={14} title="" /> Powered by <span className="font-display font-bold tracking-[-0.04em] text-ink">lumen</span>
      </footer>
    </div>
  );
}
