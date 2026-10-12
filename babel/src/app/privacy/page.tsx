import type { Metadata } from "next";
import { ROOMS } from "@/config/rooms";
import { SiteFooter } from "@/features/landing/site-footer";
import { SiteHeader } from "@/features/landing/site-header";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What Babel keeps, what it doesn't, and why.",
};

const SECTIONS = [
  {
    title: "The short version",
    body: [
      "We only keep what we need to translate things for you and run your account. We don't sell your data, and we don't use what you write to train anything.",
    ],
  },
  {
    title: "Text you translate",
    body: [
      "When you translate something, we send the text to our translation provider and send the result back to you.",
      "So we never pay to translate the same words twice, we keep the finished translation, filed under a fingerprint of the original rather than your name. It isn't linked to you.",
    ],
  },
  {
    title: "Rooms",
    body: [
      `Messages in a room, and their translations, are kept while the room is open so everyone can scroll back. A room closes after ${ROOMS.lifetimeHours} hours, or sooner if the host closes it, and then everything in it is deleted. Room messages are never added to the translation store above.`,
      "Guests don't need an account: we keep the name and language they pick for as long as the room is open. If the host removes someone, we keep a scrambled fingerprint of their internet address for that room only, so they can't rejoin it. We never store the address itself.",
      `If someone reports a message, we keep that message and the report for up to ${ROOMS.reportRetentionDays} days so we can look into it, then delete them.`,
    ],
  },
  {
    title: "Voice input",
    body: [
      "Voice input in rooms uses your browser's built-in speech recognition. Babel never receives your audio, only the words that appear in the message box. Some browsers send the audio to their maker's servers to recognise it (Google for Chrome, Apple for Safari).",
    ],
  },
  {
    title: "The browser extension",
    body: [
      "The extension only reads a page when you click Translate or press its shortcut, and only the tab you're on. It sends that page's visible text to Babel to translate, and the results are stored the same way as other text you translate: filed under a fingerprint, not linked to you.",
      "It never reads form fields, things you're typing, or code on the page. The link between your browser and your account can be removed from your dashboard at any time.",
    ],
  },
  {
    title: "Your account",
    body: [
      "If you sign up, we keep your email address, your plan, and counts of how much of your allowance you've used. Those counts are numbers only, never what you translated.",
      "If you sign in with Google, Google shares your name, email address and profile picture with us. We use them to show who's signed in, nothing else.",
      "Payments go through Stripe. Your card details go straight to them and never touch our servers.",
    ],
  },
  {
    title: "Logs",
    body: [
      "Our servers log errors so we can fix them. Those logs never include what you wrote or any passwords or keys.",
    ],
  },
  {
    title: "Questions or deleting your data",
    body: ["Write to [YOUR CONTACT EMAIL] and we'll answer, or delete everything we hold about you."],
  },
];

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="wrap max-w-3xl py-12 sm:py-20">
        <h1 className="text-5xl sm:text-6xl">Privacy, in plain words.</h1>
        <p className="mt-4 text-muted">Last updated: [DATE]</p>
        <div className="mt-12 space-y-10">
          {SECTIONS.map((section) => (
            <section key={section.title}>
              <h2 className="text-2xl sm:text-3xl">{section.title}</h2>
              {section.body.map((paragraph) => (
                <p key={paragraph} className="mt-3 text-lg text-muted">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
