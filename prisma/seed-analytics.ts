/**
 * Deterministic demo history: ~90 days of checkout sessions, events, orders
 * and one-tap survey answers for the demo merchant, so the dashboard (and,
 * later, the Research Assistant) has something real-looking to work with.
 *
 * Stories baked into the data (on purpose, so insights have something to find):
 *  - Variant B ("social proof first") converts ~15% better than A.
 *  - German buyers prefer Klarna; cards fail more there.
 *  - Touching the coupon field is the most common last stop before leaving.
 *  - Last Tuesday afternoon (UTC), card declines spiked for mobile buyers (worst in Canada),
 *    so Tuesday's conversion visibly dips.
 *  - Mobile converts worse than desktop, mostly at the card step.
 */
import type { Prisma, PrismaClient } from "../src/generated/prisma/client";

// Small seeded PRNG (mulberry32) so every seed run produces the same data.
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Weighted<T> = [T, number][];
function pick<T>(r: () => number, items: Weighted<T>): T {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let x = r() * total;
  for (const [v, w] of items) {
    if ((x -= w) < 0) return v;
  }
  return items[items.length - 1][0];
}

function uuid(r: () => number) {
  const h = () => Math.floor(r() * 16).toString(16);
  const s = Array.from({ length: 32 }, h);
  s[12] = "4";
  s[16] = ((parseInt(s[16], 16) & 0x3) | 0x8).toString(16);
  const j = s.join("");
  return `${j.slice(0, 8)}-${j.slice(8, 12)}-${j.slice(12, 16)}-${j.slice(16, 20)}-${j.slice(20)}`;
}

const COUNTRIES: Weighted<string> = [
  ["US", 44], ["CA", 12], ["GB", 12], ["DE", 10], ["AU", 8], ["FR", 5], ["NL", 5], ["JP", 4],
];
const DEVICES: Weighted<"mobile" | "desktop" | "tablet"> = [["mobile", 62], ["desktop", 31], ["tablet", 7]];

function methodFor(r: () => number, country: string, device: string): string {
  if (country === "DE") return pick(r, [["klarna", 38], ["card", 40], ["link", 8], ["google_pay", 14]]);
  if (country === "NL") return pick(r, [["ideal", 45], ["card", 35], ["klarna", 10], ["apple_pay", 10]]);
  if (country === "JP") return pick(r, [["card", 88], ["apple_pay", 12]]);
  if (device === "mobile") return pick(r, [["apple_pay", 44], ["card", 30], ["google_pay", 16], ["link", 10]]);
  return pick(r, [["card", 58], ["link", 22], ["apple_pay", 12], ["google_pay", 8]]);
}

function failureRate(country: string, method: string, device: string, spike: boolean) {
  if (spike) return country === "CA" ? 0.85 : 0.72;
  if (method === "card") return country === "DE" ? 0.14 : country === "JP" ? 0.09 : device === "mobile" ? 0.08 : 0.05;
  if (method === "klarna" || method === "ideal") return 0.03;
  return 0.02; // wallets rarely fail
}

const DECLINES = ["Your card was declined.", "Your card has insufficient funds.", "Your card's security code is incorrect.", "Your card does not support this type of purchase."];

type Page = {
  id: string;
  productId: string;
  priceCents: number;
  upsellCents: number;
  /** Relative daily traffic. */
  traffic: number;
  variants: { id: string; key: string; lift: number }[] | null;
};

export async function seedAnalytics(db: PrismaClient, merchantId: string, pages: Page[], opts: { days?: number } = {}) {
  const r = rng(20260930);
  const days = opts.days ?? 90;
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  // Most recent Tuesday strictly before today (UTC).
  const dow = new Date(today).getUTCDay();
  const tuesday = today - (((dow + 5) % 7) || 7) * 86_400_000;

  const events: Prisma.CheckoutEventCreateManyInput[] = [];
  const orders: Prisma.OrderCreateManyInput[] = [];
  const surveys: Prisma.SurveyResponseCreateManyInput[] = [];
  let firstSale: Date | null = null;

  for (let d = days; d >= 0; d--) {
    const dayStart = today - d * 86_400_000;
    const weekday = new Date(dayStart).getUTCDay();
    const growth = 0.55 + 0.45 * ((days - d) / days); // the shop is growing
    const weekly = weekday === 0 || weekday === 6 ? 1.25 : weekday === 1 ? 0.85 : 1;

    for (const page of pages) {
      const expected = 70 * page.traffic * growth * weekly * (0.85 + r() * 0.3);
      const count = d === 0 ? Math.floor(expected * (now.getUTCHours() / 24)) : Math.round(expected);

      for (let i = 0; i < count; i++) {
        const sessionId = uuid(r);
        // Evening-heavy arrival times.
        const hour = pick(r, [[8, 3], [10, 5], [12, 7], [14, 7], [16, 7], [18, 10], [20, 12], [22, 7], [1, 2], [5, 1]]);
        const start = dayStart + (hour + r()) * 3_600_000;
        if (start > now.getTime() - 5 * 60_000) continue;
        const device = pick(r, DEVICES);
        const country = pick(r, COUNTRIES);
        const variant = page.variants ? (r() < 0.5 ? page.variants[0] : page.variants[1]) : null;
        const lift = variant?.lift ?? 1;
        const spike = dayStart === tuesday && device === "mobile" && hour >= 12;

        let t = start;
        const ev = (type: string, extra: { step?: string; field?: string; paymentMethod?: string } = {}) => {
          t += (4 + r() * 40) * 1000;
          events.push({
            merchantId,
            checkoutPageId: page.id,
            variantId: variant?.id ?? null,
            sessionId,
            type: type as Prisma.CheckoutEventCreateManyInput["type"],
            step: extra.step ?? null,
            field: extra.field ?? null,
            paymentMethod: extra.paymentMethod ?? null,
            device,
            country,
            createdAt: new Date(t),
          });
        };

        ev("VIEW", { step: "view" });
        let lastField: string | undefined;
        const touch = (field: string) => {
          lastField = field;
          ev("FIELD_FOCUS", { field });
        };

        // view → engaged
        if (r() > 0.74 * Math.min(1, lift)) {
          ev("ABANDON", { step: "view" });
          continue;
        }
        ev("STEP", { step: "engaged" });
        const upsellAdded = r() < 0.24;
        if (upsellAdded || r() < 0.2) touch("upsell");
        const usesTip = r() < 0.3;
        if (usesTip || r() < 0.12) touch("tipSlider");
        const triesCoupon = r() < 0.22;
        let couponWorked = false;
        if (triesCoupon) {
          touch("coupon");
          couponWorked = r() < 0.45;
          // Coupon hunters who find no code often leave to go look for one.
          if (!couponWorked && r() < 0.5) {
            ev("ABANDON", { step: "engaged", field: "coupon" });
            continue;
          }
        }
        if (r() < 0.1 * (device === "mobile" ? 1.2 : 1)) {
          ev("ABANDON", { step: "engaged", field: lastField });
          continue;
        }

        // engaged → payment
        ev("STEP", { step: "payment" });
        touch("email");
        if (r() < 0.12) {
          ev("ABANDON", { step: "payment", field: "email" });
          continue;
        }
        touch("card");
        const cardDrop = ((device === "mobile" ? 0.2 : 0.11) / lift) * (spike ? 1.8 : 1);
        if (r() < cardDrop) {
          ev("ABANDON", { step: "payment", field: "card" });
          continue;
        }

        // payment → submitted → paid/failed
        ev("PAY_CLICK", { step: "submitted" });
        const method = methodFor(r, country, device);
        const failed = r() < failureRate(country, method, device, spike && (method === "card" || method === "google_pay"));

        const subtotal = page.priceCents + (upsellAdded ? page.upsellCents : 0);
        const discount = couponWorked ? Math.round(subtotal * 0.1) : 0;
        const tipPct = usesTip ? pick(r, [[5, 2], [10, 5], [15, 3], [20, 2]]) : 0;
        const tip = Math.round(((subtotal - discount) * tipPct) / 100);
        const amount = subtotal - discount + tip;

        const orderBase = {
          merchantId,
          checkoutPageId: page.id,
          productId: page.productId,
          variantId: variant?.id ?? null,
          amountCents: amount,
          subtotalCents: subtotal,
          tipCents: tip,
          discountCents: discount,
          currency: "usd",
          country,
          paymentMethod: method,
          device,
          sessionId,
          customerEmail: `buyer${Math.floor(r() * 1e6)}@example.com`,
        };

        if (failed) {
          ev("PAYMENT_FAILED", { step: "payment", paymentMethod: method });
          orders.push({ ...orderBase, status: "FAILED", failureMessage: DECLINES[Math.floor(r() * DECLINES.length)], createdAt: new Date(t) });
          // Some retry with a wallet and succeed; the rest leave.
          if (r() < (spike ? 0.1 : 0.35)) {
            ev("PAYMENT_SUCCEEDED", { step: "paid", paymentMethod: "apple_pay" });
            orders.push({ ...orderBase, paymentMethod: "apple_pay", status: "SUCCEEDED", paidAt: new Date(t), createdAt: new Date(t) });
          } else {
            ev("ABANDON", { step: "submitted", field: "card" });
          }
          continue;
        }

        ev("PAYMENT_SUCCEEDED", { step: "paid", paymentMethod: method });
        const roll = r();
        const status = roll < 0.018 ? "REFUNDED" : roll < 0.022 ? "DISPUTED" : "SUCCEEDED";
        orders.push({
          ...orderBase,
          status,
          refundedCents: status === "REFUNDED" ? amount : 0,
          paidAt: new Date(t),
          createdAt: new Date(t),
        });
        if (!firstSale || t < firstSale.getTime()) firstSale = new Date(t);

        // One-tap question (optional; ~42% answer).
        if (r() < 0.42) {
          const question = r() < 0.6 ? "nearly_stopped" : "heard_about";
          const answer =
            question === "nearly_stopped"
              ? pick(r, [["shipping", 34], ["price", 22], ["trust", 13], ["payment_options", 6], ["nothing", 25]])
              : pick(r, [["instagram", 41], ["friend", 22], ["tiktok", 17], ["google", 11], ["newsletter", 9]]);
          surveys.push({ merchantId, checkoutPageId: page.id, sessionId, variantId: variant?.id ?? null, question, answer, createdAt: new Date(t + 20_000) });
        }
      }
    }
  }

  // Bulk insert in chunks (fast, and keeps statement size sane).
  const chunk = async <T>(rows: T[], insert: (c: T[]) => Promise<unknown>) => {
    for (let i = 0; i < rows.length; i += 5_000) await insert(rows.slice(i, i + 5_000));
  };
  await chunk(events, (c) => db.checkoutEvent.createMany({ data: c }));
  await chunk(orders, (c) => db.order.createMany({ data: c }));
  await chunk(surveys, (c) => db.surveyResponse.createMany({ data: c }));

  // The merchant already celebrated their first sale long ago.
  await db.merchant.update({ where: { id: merchantId }, data: { firstSaleAt: firstSale, firstSaleCelebratedAt: firstSale } });

  return { events: events.length, orders: orders.length, surveys: surveys.length, spikeDay: new Date(tuesday).toISOString().slice(0, 10) };
}
