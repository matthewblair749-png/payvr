"use client";

import { useState, useTransition } from "react";
import { updateProductAction } from "@/app/studio/actions";
import { Button } from "@/components/ui/button";
import type { CheckoutProduct } from "@/lib/checkout/schema";

const CURRENCIES = ["usd", "eur", "gbp", "cad", "aud"] as const;
type Currency = (typeof CURRENCIES)[number];

const inputCls = "w-full rounded-xl border border-black/12 bg-white px-3 py-2.5 focus:border-ink focus:outline-none";

/** Edits the product this checkout sells. The preview updates as you type; Save persists. */
export function ProductPanel({
  pageId,
  product,
  onChange,
}: {
  pageId: string;
  product: CheckoutProduct;
  onChange: (p: CheckoutProduct) => void;
}) {
  const [price, setPrice] = useState((product.priceCents / 100).toFixed(2));
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function save(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await updateProductAction({
        pageId,
        name: product.name,
        description: product.description,
        priceCents: product.priceCents,
        currency: product.currency.toLowerCase() as Currency,
        requiresShipping: !!product.requiresShipping,
      });
      setMessage(res.ok ? { ok: true, text: "Product saved" } : { ok: false, text: res.error });
    });
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div>
        <label htmlFor="p-name" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">
          Product name
        </label>
        <input
          id="p-name"
          required
          maxLength={80}
          value={product.name}
          onChange={(e) => onChange({ ...product, name: e.target.value })}
          className={inputCls}
        />
      </div>
      <div>
        <label htmlFor="p-desc" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">
          Description
        </label>
        <textarea
          id="p-desc"
          rows={3}
          maxLength={280}
          value={product.description}
          onChange={(e) => onChange({ ...product, description: e.target.value })}
          className={inputCls}
        />
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <div>
          <label htmlFor="p-price" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">
            Price
          </label>
          <input
            id="p-price"
            type="number"
            inputMode="decimal"
            min="0.50"
            step="0.01"
            required
            value={price}
            onChange={(e) => {
              setPrice(e.target.value);
              const cents = Math.round(Number(e.target.value) * 100);
              if (Number.isFinite(cents) && cents >= 0) onChange({ ...product, priceCents: cents });
            }}
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor="p-cur" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">
            Currency
          </label>
          <select
            id="p-cur"
            value={product.currency.toLowerCase()}
            onChange={(e) => onChange({ ...product, currency: e.target.value.toUpperCase() })}
            className={`${inputCls} uppercase`}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c.toUpperCase()}
              </option>
            ))}
          </select>
        </div>
      </div>
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-black/12 bg-white p-3">
        <input
          type="checkbox"
          checked={!!product.requiresShipping}
          onChange={(e) => onChange({ ...product, requiresShipping: e.target.checked })}
          className="mt-0.5 size-4 accent-ink"
        />
        <span>
          <span className="block text-sm font-semibold">Ships to the buyer</span>
          <span className="block text-xs leading-relaxed text-muted-strong">
            Asks for a shipping address before payment. Leave off for classes, downloads and gift cards.
          </span>
        </span>
      </label>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save product"}
        </Button>
        <p role="status" className={message?.ok ? "text-sm text-muted-strong" : "text-sm font-medium text-orange-deep"}>
          {message?.text}
        </p>
      </div>
      <p className="text-xs leading-relaxed text-muted-strong">
        Prices sync to Stripe when you connect payments. Buyers always pay the price saved here, never a price sent from
        their browser.
      </p>
    </form>
  );
}
