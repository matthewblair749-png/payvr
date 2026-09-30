"use client";

/**
 * Full-screen "your first sale" moment for the merchant.
 *
 * Shown once: when the first payment_intent.succeeded webhook lands, the
 * merchant's firstSaleAt is set; the Studio either renders this on load or
 * picks it up by polling. Dismissing records firstSaleCelebratedAt.
 */
import { AnimatePresence, m, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { dismissFirstSaleAction } from "@/app/studio/payments-actions";
import { LogoMark } from "@/components/brand/logo";
import { formatMoney } from "@/lib/utils";

type Sale = { amountCents: number; currency: string; productName: string; country: string | null };

const CONFETTI_COLORS = ["#FFD84D", "#FFB100", "#FFFFFF", "#0E0E10"];

export function FirstSaleCelebration({ initial, watch }: { initial: Sale | null; watch: boolean }) {
  const [sale, setSale] = useState<Sale | null>(initial);
  const [open, setOpen] = useState(Boolean(initial));
  const button = useRef<HTMLButtonElement>(null);
  const reduce = useReducedMotion();

  // Poll gently while we're waiting for the first sale (only when the tab is visible).
  useEffect(() => {
    if (!watch || sale) return;
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/studio/first-sale", { cache: "no-store" });
        const json = (await res.json()) as { sale: Sale | null };
        if (json.sale) {
          setSale(json.sale);
          setOpen(true);
        }
      } catch {
        /* offline: try again next tick */
      }
    };
    const t = setInterval(tick, 15_000);
    return () => clearInterval(t);
  }, [watch, sale]);

  useEffect(() => {
    if (!open) return;
    button.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function close() {
    setOpen(false);
    void dismissFirstSaleAction();
  }

  const pieces = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => ({
        left: (i * 37) % 100,
        size: 8 + ((i * 7) % 18),
        delay: (i % 12) * 0.12,
        duration: 2.6 + ((i * 13) % 20) / 10,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        round: i % 3 !== 0,
        rotate: (i * 47) % 360,
      })),
    [],
  );

  return (
    <AnimatePresence>
      {open && sale && (
        <m.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="first-sale-title"
          aria-describedby="first-sale-desc"
          className="on-orange fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-orange px-6 text-center"
          initial={{ clipPath: "circle(0% at 50% 50%)" }}
          animate={{ clipPath: "circle(150% at 50% 50%)" }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          {!reduce && (
            <div aria-hidden="true" className="pointer-events-none absolute inset-0">
              {pieces.map((p, i) => (
                <m.span
                  key={i}
                  className="absolute top-0"
                  style={{
                    left: `${p.left}%`,
                    width: p.size,
                    height: p.round ? p.size : p.size * 0.45,
                    background: p.color,
                    borderRadius: p.round ? 999 : 4,
                  }}
                  initial={{ y: -60, rotate: p.rotate, opacity: 1 }}
                  animate={{ y: "110vh", rotate: p.rotate + 540 }}
                  transition={{ duration: p.duration, delay: 0.4 + p.delay, ease: "easeIn", repeat: 1, repeatDelay: 0.2 }}
                />
              ))}
            </div>
          )}

          <div className="relative flex max-w-2xl flex-col items-center">
            <m.div
              initial={reduce ? false : { scale: 0.3, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.25 }}
            >
              <LogoMark variant="inverted" size={112} title="" />
            </m.div>
            <m.h2
              id="first-sale-title"
              className="mt-8 font-display text-[clamp(3.5rem,12vw,8rem)] font-bold leading-[0.9] tracking-[-0.06em] text-white"
              initial={reduce ? false : { y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.4 }}
            >
              Your first sale.
            </m.h2>
            <m.p
              id="first-sale-desc"
              className="mt-6 text-xl text-ink sm:text-2xl"
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
            >
              Someone{sale.country ? ` in ${regionName(sale.country)}` : ""} just paid{" "}
              <strong className="font-bold">{formatMoney(sale.amountCents, sale.currency)}</strong> for {sale.productName}.
              <br />
              This is how it starts.
            </m.p>
            <m.button
              ref={button}
              type="button"
              onClick={close}
              className="mt-10 rounded-full bg-ink px-8 py-4 text-lg font-semibold text-white shadow-lift"
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 }}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.97 }}
            >
              Keep going
            </m.button>
          </div>
        </m.div>
      )}
    </AnimatePresence>
  );
}

function regionName(code: string) {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}
