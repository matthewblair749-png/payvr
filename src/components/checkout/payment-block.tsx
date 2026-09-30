"use client";

import { Lock } from "lucide-react";
import type { ReactNode } from "react";
import type { BlockOf } from "@/lib/checkout/schema";
import { formatMoney } from "@/lib/utils";

/**
 * Payment block.
 *
 * In `live` mode the caller passes `slot` — the real Stripe Payment Element,
 * which renders card fields inside Stripe's own iframes. Lumen never sees,
 * stores or transmits raw card data.
 *
 * In `demo`/`preview` mode we draw a non-interactive look-alike so designers
 * can see the layout. Those "fields" are plain divs, not inputs, on purpose.
 */
export function PaymentBlock({
  block,
  total,
  currency,
  payIn4,
  slot,
  onPay,
  busy,
  disabledReason,
}: {
  block: BlockOf<"payment">;
  total: number;
  currency: string;
  payIn4: boolean;
  slot?: ReactNode;
  onPay: () => void;
  busy?: boolean;
  disabledReason?: string;
}) {
  const amount = payIn4 ? `${formatMoney(Math.ceil(total / 4), currency)} today` : formatMoney(total, currency);
  return (
    <div className="space-y-3">
      {slot ?? <MockFields />}
      <button
        type="button"
        onClick={onPay}
        disabled={busy || !!disabledReason}
        className="flex w-full items-center justify-center gap-2 rounded-(--co-radius) border-2 border-(--co-accent-ring) bg-(--co-accent) px-4 py-3.5 text-base font-semibold text-(--co-accent-fg) shadow-sm transition-transform duration-150 hover:brightness-105 active:scale-[0.98] disabled:opacity-70"
      >
        <Lock size={16} aria-hidden="true" />
        {busy ? "Processing…" : `${block.props.buttonLabel} ${amount}`}
      </button>
      {disabledReason && (
        <p className="text-center text-xs text-(--co-muted)" role="note">
          {disabledReason}
        </p>
      )}
    </div>
  );
}

function FakeField({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <div className="mb-1 text-xs font-medium text-(--co-muted)">{label}</div>
      <div className="rounded-(--co-radius-sm) border border-(--co-border) bg-(--co-field) px-3 py-2.5 text-sm text-(--co-muted)">
        {value}
      </div>
    </div>
  );
}

function MockFields() {
  return (
    <div className="space-y-3">
      <p className="sr-only">Preview only. On a live checkout these fields are provided securely by Stripe.</p>
      <div aria-hidden="true" className="space-y-3">
        <FakeField label="Email" value="you@example.com" />
        <FakeField label="Card number" value="1234 1234 1234 1234" />
        <div className="grid grid-cols-2 gap-3">
          <FakeField label="Expiry" value="MM / YY" />
          <FakeField label="CVC" value="CVC" />
        </div>
      </div>
    </div>
  );
}
