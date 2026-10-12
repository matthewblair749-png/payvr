import { SiteFooter } from "@/features/landing/site-footer";
import { SiteHeader } from "@/features/landing/site-header";
import { ClosingSection, Hero, JokeSection, OfflineSection, ReadSection, TalkSection } from "@/features/landing/sections";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main id="main">
        <Hero />
        <TalkSection />
        <ReadSection />
        <JokeSection />
        <OfflineSection />
        <ClosingSection />
      </main>
      <SiteFooter />
    </>
  );
}
