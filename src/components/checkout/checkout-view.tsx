"use client";

/**
 * <CheckoutView> renders a CheckoutConfig into a real, interactive checkout.
 *
 * It is used by the landing-page demo, the Studio preview and the hosted
 * /pay/[slug] page, so what merchants design is exactly what buyers get.
 * Layout is driven by container queries (not viewport media queries) so the
 * same component renders correctly inside a phone or desktop preview frame.
 */
import { AnimatePresence, m } from "framer-motion";
import { X } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import type { Block, CheckoutConfig, CheckoutProduct } from "@/lib/checkout/schema";
import { themeToVars } from "@/lib/checkout/theme";
import { cn, formatMoney } from "@/lib/utils";
import {
  CountdownBlock,
  CouponBlock,
  OrderSummaryBlock,
  PayIn4Block,
  ProductArt,
  TestimonialBlock,
  TipSliderBlock,
  TrustBadgesBlock,
  UpsellBlock,
} from "./blocks";
import { PaymentBlock } from "./payment-block";
import { SuccessCheck } from "./success-check";

export type CheckoutMode = "demo" | "preview" | "live";

/** Demo-only coupon so visitors can try the coupon block. */
const DEMO_COUPONS: Record<string, number> = { LUMEN10: 10, HELLO: 15 };

export function CheckoutView({
  config,
  product,
  mode = "demo",
  paymentSlot,
  onPay,
  className,
}: {
  config: CheckoutConfig;
  product: CheckoutProduct;
  mode?: CheckoutMode;
  /** Live mode: the Stripe Payment Element. */
  paymentSlot?: ReactNode;
  /** Live mode: confirm the payment. Resolve true on success. */
  onPay?: (totalCents: number) => Promise<boolean>;
  className?: string;
}) {
  const vars = useMemo(() => themeToVars(config.theme), [config.theme]);
  const visible = config.blocks.filter((b) => !b.hidden);

  // Buyer-side state
  const [upsellAdded, setUpsellAdded] = useState(false);
  const [tipPercent, setTipPercent] = useState(0);
  const [coupon, setCoupon] = useState<string | null>(null);
  const [payIn4, setPayIn4] = useState(false);
  const [status, setStatus] = useState<"idle" | "busy" | "paid">("idle");

  const has = (t: Block["type"]) => visible.some((b) => b.type === t);
  const upsell = visible.find((b) => b.type === "upsell");

  // Totals — the server recomputes all of this in live mode; never trust the client.
  const upsellCents = upsell && upsellAdded && upsell.type === "upsell" ? upsell.props.priceCents : 0;
  const subtotal = product.priceCents + upsellCents;
  const discount = coupon && has("coupon") ? Math.round((subtotal * (DEMO_COUPONS[coupon] ?? 0)) / 100) : 0;
  const tip = has("tipSlider") ? Math.round(((subtotal - discount) * tipPercent) / 100) : 0;
  const total = subtotal - discount + tip;
  const usePayIn4 = payIn4 && has("payIn4");

  const lines = [
    ...(upsellCents && upsell?.type === "upsell" ? [{ label: upsell.props.title, cents: upsellCents }] : []),
    ...(discount ? [{ label: `Code ${coupon}`, cents: -discount }] : []),
    ...(tip ? [{ label: "Tip", cents: tip }] : []),
  ];

  async function handlePay() {
    if (status !== "idle") return;
    setStatus("busy");
    if (mode === "live" && onPay) {
      setStatus((await onPay(total)) ? "paid" : "idle");
    } else {
      await new Promise((r) => setTimeout(r, 650));
      setStatus("paid");
    }
  }

  function renderBlock(b: Block): ReactNode {
    switch (b.type) {
      case "orderSummary":
        return <OrderSummaryBlock block={b} product={product} lines={lines} total={total} />;
      case "upsell":
        return (
          <UpsellBlock block={b} currency={product.currency} added={upsellAdded} onToggle={() => setUpsellAdded((v) => !v)} />
        );
      case "testimonial":
        return <TestimonialBlock block={b} />;
      case "countdown":
        return <CountdownBlock block={b} />;
      case "tipSlider":
        return (
          <TipSliderBlock block={b} percent={tipPercent} onChange={setTipPercent} tipCents={tip} currency={product.currency} />
        );
      case "payIn4":
        return <PayIn4Block block={b} total={total} currency={product.currency} enabled={payIn4} onChange={setPayIn4} />;
      case "coupon":
        return (
          <CouponBlock
            block={b}
            applied={coupon}
            onApply={(code) => {
              const c = code.trim().toUpperCase();
              if (!(c in DEMO_COUPONS)) return false;
              setCoupon(c);
              return true;
            }}
          />
        );
      case "trustBadges":
        return <TrustBadgesBlock block={b} />;
      case "payment":
        return (
          <PaymentBlock
            block={b}
            total={total}
            currency={product.currency}
            payIn4={usePayIn4}
            slot={mode === "live" ? paymentSlot : undefined}
            onPay={handlePay}
            busy={status === "busy"}
          />
        );
    }
  }

  const card = (
    <div
      className="w-full rounded-(--co-radius-card) bg-(--co-card) p-4 text-(--co-fg) shadow-[0_1px_2px_rgb(0_0_0/0.05),0_16px_40px_-12px_rgb(0_0_0/0.18)] @md:p-5"
    >
      <AnimatePresence mode="wait" initial={false}>
        {status === "paid" ? (
          <m.div
            key="paid"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-3 py-10 text-center"
            role="status"
          >
            <SuccessCheck />
            <p className="text-xl font-semibold">Thank you!</p>
            <p className="max-w-[28ch] text-sm text-(--co-muted)">
              {mode === "live"
                ? `Your payment of ${formatMoney(total, product.currency)} went through. A receipt is on its way.`
                : "This is a demo, so nothing was charged. On a real lumen checkout, Stripe takes it from here."}
            </p>
            {mode !== "live" && (
              <button
                type="button"
                onClick={() => setStatus("idle")}
                className="mt-2 text-sm font-semibold text-(--co-accent-text) underline underline-offset-4"
              >
                Run it again
              </button>
            )}
          </m.div>
        ) : (
          <m.ul key="form" className="flex flex-col gap-3" exit={{ opacity: 0 }}>
            <AnimatePresence initial={false}>
              {visible.map((b) => (
                <m.li
                  key={b.id}
                  layout="position"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
                  transition={{ type: "spring", stiffness: 520, damping: 38, mass: 0.8 }}
                >
                  {renderBlock(b)}
                </m.li>
              ))}
            </AnimatePresence>
          </m.ul>
        )}
      </AnimatePresence>
    </div>
  );

  const brandBadge = (
    <div className="flex items-center gap-2.5">
      {config.brand.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- merchant logos come from arbitrary hosts
        <img src={config.brand.logoUrl} alt="" className="h-8 w-8 rounded-(--co-radius-sm) object-cover" />
      ) : (
        <span
          aria-hidden="true"
          className="grid h-8 w-8 place-items-center rounded-(--co-radius-sm) bg-(--co-accent) text-sm font-bold text-(--co-accent-fg)"
        >
          {(config.brand.name.trim() || "Y").charAt(0)}
        </span>
      )}
      <span className="font-semibold">{config.brand.name.trim() || "Your brand"}</span>
    </div>
  );

  return (
    <div
      style={{ ...vars, fontFamily: "var(--co-font)" }}
      className={cn("@container relative min-h-full bg-(--co-page) transition-colors duration-300", className)}
    >
      {config.theme.layout === "page" ? (
        <div className="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-6 @3xl:flex-row @3xl:items-start @3xl:gap-14 @3xl:px-12 @3xl:py-14">
          <header className="text-(--co-page-fg) @3xl:sticky @3xl:top-14 @3xl:flex-1 @3xl:pt-2">
            {brandBadge}
            <div className="mt-5 hidden @3xl:block">
              <ProductArt size={120} />
              <h2 className="mt-6 text-4xl font-semibold leading-tight tracking-tight">{product.name}</h2>
              <p className="mt-2 max-w-sm opacity-80">{product.description}</p>
              <p className="mt-4 text-3xl font-semibold tabular-nums">{formatMoney(product.priceCents, product.currency)}</p>
            </div>
          </header>
          <div className="w-full @3xl:max-w-[420px]">{card}</div>
        </div>
      ) : (
        <ModalChrome brandBadge={brandBadge}>{card}</ModalChrome>
      )}
    </div>
  );
}

/** Modal layout: a faux merchant site, dimmed, with the checkout floating above. */
function ModalChrome({ children, brandBadge }: { children: ReactNode; brandBadge: ReactNode }) {
  return (
    <div className="relative min-h-full overflow-hidden">
      <div aria-hidden="true" className="absolute inset-0 p-6 text-(--co-page-fg) opacity-60">
        {brandBadge}
        <div className="mt-8 grid grid-cols-2 gap-4 @3xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="aspect-square rounded-(--co-radius) bg-(--co-accent-soft)" />
          ))}
        </div>
      </div>
      <div aria-hidden="true" className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" />
      <div className="relative mx-auto w-full max-w-[420px] px-3 py-8 @3xl:py-14">
        <div className="mb-2 flex justify-end">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-white/90 text-black" aria-hidden="true">
            <X size={16} />
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}
