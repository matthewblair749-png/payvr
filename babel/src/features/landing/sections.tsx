import { ButtonLink } from "@/components/ui/button";
import { SIGNUP_HREF } from "@/config/site";
import { Mascot } from "@/features/brand/mascot";
import { TranslateBox } from "@/features/translation/components/translate-box";
import { ChatDemo } from "./chat-demo";
import { IdiomCards } from "./idiom-cards";
import { OfflineStatus } from "./offline-status";
import { ReadSlider } from "./read-slider";

export function Hero() {
  return (
    <section
      aria-labelledby="hero-title"
      className="wrap grid grid-cols-[minmax(0,1fr)] gap-6 pb-16 pt-6 sm:pt-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start lg:gap-16 lg:pb-24 lg:pt-16"
    >
      <div className="lg:pt-24">
        <h1 id="hero-title" className="text-4xl sm:text-6xl">
          Everyone speaks <span className="text-accent-text">your</span> language.
        </h1>
        <p className="mt-4 max-w-md text-lg text-fg-2 sm:mt-6 sm:text-xl">
          Paste anything and read it in your language. Or open a room and chat with someone who speaks another one.
        </p>
        <HeroCta className="mt-8 hidden lg:flex" />
      </div>
      <TranslateBox />
      <HeroCta className="flex lg:hidden" />
    </section>
  );
}

function HeroCta({ className }: { className?: string }) {
  return (
    <div className={`flex-wrap items-center gap-4 ${className ?? ""}`}>
      <ButtonLink href={SIGNUP_HREF} size="lg">
        Try it free
      </ButtonLink>
      <p className="text-sm font-semibold text-fg-2">Free plan. No card needed.</p>
    </div>
  );
}

export function TalkSection() {
  return (
    <section aria-labelledby="talk-title" className="px-2 sm:px-4">
      <div className="on-dark rounded-[40px] bg-ink py-16 sm:py-24">
        <div className="wrap grid items-center gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
          <div>
            <h2 id="talk-title" className="text-4xl sm:text-5xl">
              Talk to anyone.
            </h2>
            <p className="mt-6 max-w-md text-lg text-muted">
              Open a room and send the link. You write in your language, they read in theirs, and it works the other way
              round too. Nobody has to pick a language to meet in the middle.
            </p>
            <p className="mt-4 max-w-md text-lg text-muted">
              Not sure what they really said? Tap a message to see their exact words.
            </p>
          </div>
          <div className="flex justify-center lg:justify-end">
            <ChatDemo />
          </div>
        </div>
      </div>
    </section>
  );
}

export function ReadSection() {
  return (
    <section aria-labelledby="read-title" className="bg-paper py-16 sm:py-24">
      <div className="wrap">
        <div className="grid gap-6 md:grid-cols-2 md:items-end md:gap-12">
          <h2 id="read-title" className="text-4xl sm:text-5xl">
            Read anything.
          </h2>
          <p className="max-w-md text-lg text-muted">
            Recipes, menus, letters from the landlord. Babel swaps the words and leaves everything else where it was, so a
            recipe still reads like a recipe.
          </p>
        </div>
        <div className="mt-10 sm:mt-12">
          <ReadSlider />
        </div>
      </div>
    </section>
  );
}

export function JokeSection() {
  return (
    <section aria-labelledby="joke-title" className="wrap py-16 sm:py-24">
      <div className="max-w-2xl">
        <h2 id="joke-title" className="text-4xl sm:text-5xl">
          It gets the joke.
        </h2>
        <p className="mt-6 text-lg text-muted">
          Word-for-word translation turns sayings into nonsense. Babel goes for what people mean. Tap a card to see
          the difference.
        </p>
      </div>
      <div className="mt-10 sm:mt-12">
        <IdiomCards />
      </div>
      <p className="mt-6 text-sm text-muted">These examples are hand-checked previews.</p>
    </section>
  );
}

export function OfflineSection() {
  return (
    <section aria-labelledby="offline-title" className="border-y border-line bg-paper py-20 sm:py-32">
      <div className="wrap max-w-2xl text-center">
        <OfflineStatus />
        <h2 id="offline-title" className="mt-10 text-3xl sm:text-4xl">
          Bad signal? No drama.
        </h2>
        <p className="mt-6 text-lg text-muted">
          If your connection drops in the middle of a chat, nothing gets lost. What you write waits on your device and
          goes out as soon as you&rsquo;re back. Everything already translated stays on screen, so you can keep reading.
        </p>
        <p className="mt-4 text-muted">Translating something new does need a connection.</p>
      </div>
    </section>
  );
}

export function ClosingSection() {
  return (
    <section aria-labelledby="closing-title" className="px-2 py-16 sm:px-4 sm:py-24">
      <div className="mx-auto grid max-w-[1200px] items-center gap-8 overflow-hidden rounded-[40px] border-2 border-ink bg-coral px-6 py-12 text-ink sm:px-12 md:grid-cols-[minmax(0,1fr)_auto] md:py-16">
        <div>
          <h2 id="closing-title" className="text-4xl sm:text-6xl">
            Say hello in their language.
          </h2>
          <p className="mt-4 max-w-lg text-lg font-semibold">
            Start free. Upgrade if you need more. Cancel whenever you like.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <ButtonLink href={SIGNUP_HREF} variant="ink" size="lg">
              Try it free
            </ButtonLink>
            <ButtonLink href="/pricing" variant="outline" size="lg" className="text-ink">
              See pricing
            </ButtonLink>
          </div>
        </div>
        <div className="mx-auto flex size-[200px] items-center justify-center rounded-full border-2 border-ink bg-cream md:size-[240px]">
          <div className="w-[120px] translate-y-2 md:w-[150px]">
            <Mascot mood="happy" label="The Babel mascot, waving goodbye" />
          </div>
        </div>
      </div>
    </section>
  );
}
