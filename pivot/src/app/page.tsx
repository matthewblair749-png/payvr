import { Hero } from "@/components/landing/hero";
import { LandingFooter } from "@/components/landing/footer";
import { LandingHeader } from "@/components/landing/header";
import { Faq, Features, FinalCta, FourQuestions, Pricing, Problem, ProofStrip, Solution, Testimonials, TrustBar } from "@/components/landing/sections";
import { getDemo } from "@/lib/demo";
import { currentUser } from "@/server/auth/session";

export default async function LandingPage() {
  const { analysis, facts } = getDemo();
  const user = await currentUser();
  return (
    <>
      <LandingHeader signedIn={Boolean(user)} />
      <main id="main">
        <Hero baseline={analysis.baseline!} company={analysis.company.name} currency={analysis.company.currency} />
        <TrustBar />
        <ProofStrip />
        <Problem analysis={analysis} />
        <Solution />
        <FourQuestions analysis={analysis} />
        <Features analysis={analysis} facts={facts} />
        <Testimonials />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <LandingFooter />
    </>
  );
}
