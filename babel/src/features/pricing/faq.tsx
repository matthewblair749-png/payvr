import { getPlan, PAYMENT_GRACE_PERIOD_DAYS } from "@/config/plans";
import { LANGUAGES } from "@/features/translation/languages";

const free = getPlan("free");

/** Honest answers. Anything we haven't decided yet is a visible placeholder. */
const FAQ: { q: string; a: string }[] = [
  {
    q: "Is the free plan actually free?",
    a: `Yes. No card, no trial clock. You get ${free.limits.translationsPerDay} translations a day and ${free.limits.liveMinutesPerMonth} minutes of live rooms a month. If that's all you need, stay as long as you like.`,
  },
  {
    q: "How good are the translations?",
    a: "Very good for everyday things: chatting, menus, emails, articles. They're not certified, though. For contracts, medical notes or anything official, please have a professional translator check it.",
  },
  {
    q: "Which languages can I use?",
    a: `Right now: ${LANGUAGES.map((l) => l.name).join(", ")}. More are on the way.`,
  },
  {
    q: "What happens to the things I write?",
    a: "We send your text to our translation provider so it can be translated, and that's all it's used for. Room messages are deleted when the room closes. We never sell what you write, and we don't use it to train anything.",
  },
  {
    q: "Can I cancel whenever I want?",
    a: "Yes, from your account page, no emails or phone calls needed. You keep your plan until the end of the period you've paid for, then you move to Free. We won't charge you again.",
  },
  {
    q: "Do you give refunds?",
    a: "[YOUR REFUND POLICY]",
  },
  {
    q: "What if a payment fails?",
    a: `You'll see a note in the app and we'll try the card again. Everything keeps working for ${PAYMENT_GRACE_PERIOD_DAYS} days while you sort it out. After that your account moves to Free. Nothing gets deleted.`,
  },
  {
    q: "How does Teams billing work?",
    a: "You pay per person, per month. Add or remove people whenever you like, and the bill adjusts for the rest of the billing period.",
  },
  {
    q: "Does Babel work offline?",
    a: "Partly. If your connection drops in a chat, your messages wait and send when you're back, and what's already translated stays on screen. Translating new text needs a connection.",
  },
];

export function PricingFaq() {
  return (
    <section aria-labelledby="faq-title" className="wrap grid gap-8 py-16 sm:py-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-16">
      <div>
        <h2 id="faq-title" className="text-4xl sm:text-5xl">
          Fair questions.
        </h2>
        <p className="mt-4 text-lg text-muted">Straight answers, no small print.</p>
      </div>
      <div className="border-t-2 border-ink">
        {FAQ.map((item) => (
          <details key={item.q} className="group border-b-2 border-ink">
            <summary className="press flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 py-4 font-display text-xl font-extrabold hover:text-coral-text [&::-webkit-details-marker]:hidden">
              {item.q}
              <span
                aria-hidden
                className="flex size-9 shrink-0 items-center justify-center rounded-full border-2 border-ink transition-transform duration-200 ease-spring group-open:rotate-45"
              >
                <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M8 3v10M3 8h10" />
                </svg>
              </span>
            </summary>
            <p className="max-w-2xl pb-6 text-lg text-muted">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
