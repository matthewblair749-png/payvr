import { OneTapDemo } from "./one-tap-demo";

/** "The checkout that learns" — the research engine, told in three beats. */
export function LearnsSection() {
  return (
    <section id="learns" aria-labelledby="learns-title" className="scroll-mt-4 bg-ink py-24 text-white sm:py-32">
      <div className="mx-auto grid max-w-7xl gap-14 px-5 sm:px-8 lg:grid-cols-2 lg:items-center lg:gap-20">
        <div>
          <p className="font-semibold text-spark">Design is the hook. Research is the moat.</p>
          <h2
            id="learns-title"
            className="mt-3 font-display text-[clamp(2.5rem,6vw,4.5rem)] font-bold leading-[0.95] tracking-[-0.05em]"
          >
            Every sale tells you something.
          </h2>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-white/80">
            lumen asks one optional question after checkout, watches where people hesitate, and turns it into plain
            answers. Then ask it anything.
          </p>

          <div className="mt-10 space-y-3" aria-label="Example research assistant conversation" role="group">
            <div className="ml-auto w-fit max-w-[85%] rounded-3xl rounded-br-lg bg-orange px-5 py-3 font-semibold text-ink">
              Why did conversions drop on Tuesday?
            </div>
            <div className="w-fit max-w-[92%] rounded-3xl rounded-bl-lg bg-white/10 px-5 py-4 leading-relaxed text-white/90">
              Mobile buyers in Canada dropped off at the payment step after 2pm — card declines doubled. Offering
              Apple&nbsp;Pay first on mobile could win back about 30 sales a week.
              <span className="mt-3 flex w-fit items-center gap-2 rounded-full bg-spark px-4 py-2 text-sm font-semibold text-ink">
                Start this experiment
              </span>
            </div>
          </div>
        </div>
        <OneTapDemo />
      </div>
    </section>
  );
}
