import { ClosingCta, Footer } from "@/components/landing/footer";
import { Hero } from "@/components/landing/hero";
import { LearnsSection } from "@/components/landing/learns-section";
import { LazyLiveEditor } from "@/components/landing/lazy-live-editor";

export default function Home() {
  return (
    <>
      <main id="main">
        <Hero />
        <section id="try" aria-labelledby="try-title" className="scroll-mt-4 bg-surface py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-8">
            <div className="mb-10 max-w-2xl sm:mb-14">
              <p className="font-semibold text-orange-deep">The Checkout Studio</p>
              <h2
                id="try-title"
                className="mt-2 font-display text-[clamp(2.5rem,6vw,4.5rem)] font-bold leading-[0.95] tracking-[-0.05em]"
              >
                Go on. Touch it.
              </h2>
              <p className="mt-5 text-lg leading-relaxed text-muted-strong">
                This is a real checkout, not a screenshot. Change the colors, the font, the corners. Drag blocks around.
                Pay for the mugs. It all updates as you go.
              </p>
            </div>
            <LazyLiveEditor />
          </div>
        </section>
        <LearnsSection />
        <ClosingCta />
      </main>
      <Footer />
    </>
  );
}
