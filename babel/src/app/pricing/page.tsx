import type { Metadata } from "next";
import { SiteFooter } from "@/features/landing/site-footer";
import { SiteHeader } from "@/features/landing/site-header";
import { PricingFaq } from "@/features/pricing/faq";
import { PricingPlans } from "@/features/pricing/pricing-plans";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Start free. Upgrade when you need more. Cancel anytime.",
};

export default async function PricingPage(props: PageProps<"/pricing">) {
  const { checkout } = await props.searchParams;
  return (
    <>
      <SiteHeader />
      <main id="main">
        <PricingPlans notice={typeof checkout === "string" ? checkout : undefined} />
        <PricingFaq />
      </main>
      <SiteFooter />
    </>
  );
}
