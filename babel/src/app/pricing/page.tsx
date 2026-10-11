import type { Metadata } from "next";
import { SiteFooter } from "@/features/landing/site-footer";
import { SiteHeader } from "@/features/landing/site-header";
import { PricingFaq } from "@/features/pricing/faq";
import { PricingPlans } from "@/features/pricing/pricing-plans";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Start free. Upgrade when you need more. Cancel anytime.",
};

export default function PricingPage() {
  return (
    <>
      <SiteHeader />
      <main id="main">
        <PricingPlans />
        <PricingFaq />
      </main>
      <SiteFooter />
    </>
  );
}
