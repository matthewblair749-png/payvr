import { ButtonLink } from "@/components/ui/button";
import { annualTotal, effectiveMonthlyPrice, type BillingInterval } from "@/config/plans";
import type { Entitlement } from "@/features/billing/entitlements";
import { formatPrice } from "@/features/pricing/format";
import { ExtensionPanel } from "@/features/extension/components/extension-panel";
import { RoomsPanel } from "@/features/rooms/components/rooms-panel";
import { DashboardTranslate } from "./dashboard-translate";
import type { UsageSummary } from "@/features/usage/server";
import { BillingButton } from "./billing-button";
import { formatDay, formatMinutes, untilPhrase } from "./format";
import { UsageMeter } from "./usage-meter";

export interface DashboardProps {
  name: string | null;
  email: string;
  rooms: { id: string; name: string; expiresAt: Date; people: number }[];
  browsers: { id: string; label: string; lastUsedAt: Date }[];
  usage: UsageSummary;
  subscription: { interval: string; seats: number } | null;
  hasBillingAccount: boolean;
  notice?: string;
}

function PaymentBanner({ entitlement }: { entitlement: Entitlement }) {
  const { access, subscribedPlan } = entitlement;
  if (access.kind !== "grace" && access.kind !== "lapsed") return null;
  return (
    <div role="alert" className="wrap mt-2">
      <div className="flex flex-col gap-4 rounded-[var(--radius-lg)] border-2 border-ink bg-sun p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <p className="font-display text-xl font-black">
            {access.kind === "grace" ? "Your last payment didn't go through." : `${subscribedPlan.name} is paused for now.`}
          </p>
          <p className="mt-1 max-w-2xl">
            {access.kind === "grace"
              ? `Update your card by ${formatDay(access.graceEndsAt)} to keep ${subscribedPlan.name}. Until then, everything works as normal.`
              : `We still couldn't take payment, so you're on Free limits. Update your card and ${subscribedPlan.name} comes straight back. Nothing has been deleted.`}
          </p>
        </div>
        <BillingButton>Update payment</BillingButton>
      </div>
    </div>
  );
}

const NOTICES: Record<string, string> = {
  "billing=unavailable": "Billing isn't available right now. Please try again later.",
  "billing=error": "We couldn't open billing just now. Please try again in a minute.",
};

function Notice({ notice, entitlement }: { notice?: string; entitlement: Entitlement }) {
  if (!notice) return null;
  let text = NOTICES[notice];
  if (notice === "checkout=success") {
    text =
      entitlement.access.kind === "active"
        ? `You're on ${entitlement.plan.name} now. Enjoy!`
        : "Thanks! Your new plan appears here as soon as Stripe confirms the payment, usually within a few seconds. Refresh in a moment if it hasn't yet.";
  }
  if (!text) return null;
  return (
    <p role="status" className="wrap mt-2">
      <span className="block rounded-[var(--radius)] bg-paper px-4 py-3 font-semibold">{text}</span>
    </p>
  );
}

function PlanPanel({ usage, subscription, hasBillingAccount }: Pick<DashboardProps, "usage" | "subscription" | "hasBillingAccount">) {
  const { entitlement } = usage;
  const { access, subscribedPlan } = entitlement;
  const interval: BillingInterval = subscription?.interval === "annual" ? "annual" : "monthly";
  const plan = subscribedPlan;
  const seats = subscription?.seats ?? 1;

  let headline: string;
  let detail: string;
  switch (access.kind) {
    case "free":
      headline = "You're on Free.";
      detail = `${plan.limits.translationsPerDay} translations a day and ${formatMinutes(plan.limits.liveMinutesPerMonth)} of live rooms a month, free for as long as you like.`;
      break;
    case "active":
      headline = `You're on ${plan.name}.`;
      detail = `${formatPrice(interval === "annual" ? annualTotal(plan) * seats : effectiveMonthlyPrice(plan, interval) * seats)} ${interval === "annual" ? "a year" : "a month"}${plan.perSeat ? ` for ${seats} ${seats === 1 ? "person" : "people"}` : ""}.${access.renewsAt ? ` Renews on ${formatDay(access.renewsAt)}.` : ""}`;
      break;
    case "ending":
      headline = `${plan.name} ends ${access.endsAt ? `on ${formatDay(access.endsAt)}` : "at the end of this period"}.`;
      detail = "After that you'll be on Free. Changed your mind? You can keep your plan from billing.";
      break;
    case "grace":
      headline = `You're on ${plan.name}.`;
      detail = `There's a payment problem to fix by ${formatDay(access.graceEndsAt)}.`;
      break;
    case "lapsed":
      headline = "You're on Free limits for now.";
      detail = `${plan.name} comes back as soon as your payment goes through.`;
      break;
  }

  return (
    <div className="on-dark flex flex-col justify-between gap-6 rounded-[var(--radius-lg)] bg-ink p-6 sm:p-8">
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.08em] text-muted">Your plan</p>
        <h2 className="mt-2 text-3xl sm:text-4xl">{headline}</h2>
        <p className="mt-3 max-w-md text-muted">{detail}</p>
      </div>
      <div className="flex flex-wrap gap-3">
        {access.kind === "free" ? (
          <ButtonLink href="/pricing">See plans</ButtonLink>
        ) : (
          hasBillingAccount && <BillingButton variant="primary">Manage billing</BillingButton>
        )}
      </div>
    </div>
  );
}

export function Dashboard({ name, email, rooms, browsers, usage, subscription, hasBillingAccount, notice }: DashboardProps) {
  const { translations, liveMinutes, entitlement } = usage;
  const firstName = name?.split(" ")[0];
  return (
    <main id="main" className="pb-16">
      <PaymentBanner entitlement={entitlement} />
      <Notice notice={notice} entitlement={entitlement} />

      <section className="wrap mt-8">
        <h1 className="text-4xl sm:text-5xl">{firstName ? `Hi, ${firstName}.` : "Hi there."}</h1>
      </section>

      <section aria-label="Plan and usage" className="wrap mt-8 grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-6">
        <PlanPanel usage={usage} subscription={subscription} hasBillingAccount={hasBillingAccount} />
        <div className="grid gap-4 sm:grid-cols-2 lg:gap-6">
          <UsageMeter
            label="Translations today"
            used={translations.used}
            limit={translations.limit}
            usedText={`${translations.used.toLocaleString("en-US")} of ${translations.limit.toLocaleString("en-US")} used`}
            footnote={
              translations.used >= translations.limit
                ? `All used up. More arrive at midnight UTC, ${untilPhrase(translations.resetsAt)}.`
                : `${(translations.limit - translations.used).toLocaleString("en-US")} left. Resets at midnight UTC, ${untilPhrase(translations.resetsAt)}.`
            }
          />
          <UsageMeter
            label="Live rooms this month"
            used={liveMinutes.used}
            limit={liveMinutes.limit}
            usedText={`${formatMinutes(liveMinutes.used)} of ${formatMinutes(liveMinutes.limit)}`}
            footnote={`Rooms for up to ${entitlement.plan.limits.roomSize} people. Resets on ${formatDay(liveMinutes.resetsAt)}.`}
          />
        </div>
      </section>

      <RoomsPanel
        rooms={rooms}
        defaultName={firstName ?? email.split("@")[0]}
        roomSize={entitlement.plan.limits.roomSize}
        minutesLeft={Math.max(0, liveMinutes.limit - liveMinutes.used)}
        notice={notice?.startsWith("rooms=") ? notice.slice("rooms=".length) : undefined}
      />

      <ExtensionPanel browsers={browsers} />

      <section aria-labelledby="translate-title" className="wrap mt-12 max-w-3xl">
        <h2 id="translate-title" className="text-3xl">
          Translate something
        </h2>
        <p className="mt-2 text-muted">Every translation here counts toward today&rsquo;s allowance.</p>
        <div className="-mt-6">
          <DashboardTranslate />
        </div>
      </section>
    </main>
  );
}
