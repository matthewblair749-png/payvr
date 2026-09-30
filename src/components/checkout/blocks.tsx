"use client";

/**
 * Individual checkout blocks. Every block reads ONLY the --co-* CSS variables
 * produced by `themeToVars`, so theme edits never re-render block internals.
 */
import { useEffect, useId, useState, type ReactNode } from "react";
import { Clock, Headphones, Lock, RotateCcw, Star, Truck } from "lucide-react";
import type { BlockOf, CheckoutProduct } from "@/lib/checkout/schema";
import { formatMoney } from "@/lib/utils";

/** Shared card chrome for blocks that sit in their own panel. */
function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-(--co-radius) border border-(--co-border) bg-(--co-card) p-4 ${className}`}
    >
      {children}
    </div>
  );
}

/** Built-in product illustration (no external image needed for the demo). */
export function ProductArt({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="shrink-0">
      <rect width="64" height="64" rx="14" fill="var(--co-accent-soft)" />
      <path d="M17 22h24v20a8 8 0 0 1-8 8h-8a8 8 0 0 1-8-8V22Z" fill="var(--co-card)" stroke="var(--co-fg)" strokeWidth="2.5" />
      <path d="M41 27h3a5 5 0 0 1 0 10h-3" fill="none" stroke="var(--co-fg)" strokeWidth="2.5" />
      <circle cx="24" cy="31" r="1.4" fill="var(--co-accent)" />
      <circle cx="31" cy="37" r="1.4" fill="var(--co-accent)" />
      <circle cx="27" cy="43" r="1.4" fill="var(--co-accent)" />
      <circle cx="34" cy="28" r="1.4" fill="var(--co-accent)" />
      <path d="M24 13c0 3 3 3 3 6M31 11c0 3 3 3 3 6" fill="none" stroke="var(--co-muted)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// ---------------------------------------------------------------------------

export function OrderSummaryBlock({
  block,
  product,
  lines,
  total,
}: {
  block: BlockOf<"orderSummary">;
  product: CheckoutProduct;
  lines: { label: string; cents: number }[];
  total: number;
}) {
  return (
    <Panel>
      <div className="flex items-center gap-3">
        {block.props.showImage && <ProductArt size={56} />}
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{product.name}</p>
          <p className="text-sm text-(--co-muted) line-clamp-2">{product.description}</p>
        </div>
        <p className="font-semibold tabular-nums">{formatMoney(product.priceCents, product.currency)}</p>
      </div>
      {lines.length > 0 && (
        <dl className="mt-3 space-y-1 border-t border-(--co-border) pt-3 text-sm">
          {lines.map((l) => (
            <div key={l.label} className="flex justify-between">
              <dt className="text-(--co-muted)">{l.label}</dt>
              <dd className="tabular-nums">
                {l.cents < 0 ? "−" : ""}
                {formatMoney(Math.abs(l.cents), product.currency)}
              </dd>
            </div>
          ))}
        </dl>
      )}
      <div className="mt-3 flex justify-between border-t border-(--co-border) pt-3 font-semibold">
        <span>Total</span>
        <span className="tabular-nums">{formatMoney(total, product.currency)}</span>
      </div>
    </Panel>
  );
}

export function UpsellBlock({
  block,
  currency,
  added,
  onToggle,
}: {
  block: BlockOf<"upsell">;
  currency: string;
  added: boolean;
  onToggle: () => void;
}) {
  return (
    <Panel className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{block.props.title}</p>
        <p className="text-sm text-(--co-muted)">{block.props.description}</p>
      </div>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={added}
        className="shrink-0 rounded-(--co-radius-sm) border-2 border-(--co-accent-ring) px-3 py-1.5 text-sm font-semibold transition-colors aria-pressed:bg-(--co-accent) aria-pressed:text-(--co-accent-fg) text-(--co-accent-text)"
      >
        {added ? "Added ✓" : `+ ${formatMoney(block.props.priceCents, currency)}`}
      </button>
    </Panel>
  );
}

export function TestimonialBlock({ block }: { block: BlockOf<"testimonial"> }) {
  const { quote, author, detail, rating } = block.props;
  return (
    <figure className="rounded-(--co-radius) bg-(--co-accent-soft) p-4">
      {rating > 0 && (
        <div className="mb-2 flex gap-0.5" role="img" aria-label={`${rating} out of 5 stars`}>
          {Array.from({ length: 5 }, (_, i) => (
            <Star
              key={i}
              size={14}
              aria-hidden="true"
              className={i < rating ? "fill-(--co-accent-text) text-(--co-accent-text)" : "text-(--co-muted)"}
            />
          ))}
        </div>
      )}
      <blockquote className="text-[0.95rem] leading-snug">“{quote}”</blockquote>
      <figcaption className="mt-2 text-sm text-(--co-muted)">
        <span className="font-semibold text-(--co-fg)">{author}</span> · {detail}
      </figcaption>
    </figure>
  );
}

export function CountdownBlock({ block }: { block: BlockOf<"countdown"> }) {
  // Keyed on duration so the timer restarts when the merchant edits it.
  return <Countdown key={block.props.minutes} label={block.props.label} total={block.props.minutes * 60} />;
}

function Countdown({ label, total }: { label: string; total: number }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, total - elapsed);
  const h = Math.floor(left / 3600);
  const m = Math.floor((left % 3600) / 60);
  const s = left % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return (
    <div className="flex items-center justify-between rounded-(--co-radius) border border-dashed border-(--co-accent-ring) px-4 py-3">
      <span className="flex items-center gap-2 text-sm font-medium">
        <Clock size={16} aria-hidden="true" className="text-(--co-accent-text)" />
        {label}
      </span>
      {/* aria-live off: announcing every second would be hostile to screen readers. */}
      <span className="font-semibold tabular-nums text-(--co-accent-text)" aria-live="off">
        {h > 0 && `${h}:`}
        {pad(m)}:{pad(s)}
      </span>
    </div>
  );
}

export function TipSliderBlock({
  block,
  percent,
  onChange,
  tipCents,
  currency,
}: {
  block: BlockOf<"tipSlider">;
  percent: number;
  onChange: (p: number) => void;
  tipCents: number;
  currency: string;
}) {
  const id = useId();
  return (
    <Panel>
      <div className="mb-3 flex items-baseline justify-between">
        <label htmlFor={id} className="text-sm font-medium">
          {block.props.label}
        </label>
        <span className="text-sm font-semibold tabular-nums text-(--co-accent-text)">
          {percent}% · {formatMoney(tipCents, currency)}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={block.props.maxPercent}
        step={5}
        value={percent}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-valuetext={`${percent} percent, ${formatMoney(tipCents, currency)}`}
        className="w-full accent-(--co-accent)"
      />
    </Panel>
  );
}

export function PayIn4Block({
  block,
  total,
  currency,
  enabled,
  onChange,
}: {
  block: BlockOf<"payIn4">;
  total: number;
  currency: string;
  enabled: boolean;
  onChange: (v: boolean) => void;
}) {
  const name = useId();
  const opts = [
    { v: false, title: "Pay in full", sub: formatMoney(total, currency) },
    { v: true, title: block.props.label, sub: `4 × ${formatMoney(Math.ceil(total / 4), currency)}` },
  ];
  return (
    <fieldset className="grid grid-cols-2 gap-2">
      <legend className="sr-only">Payment schedule</legend>
      {opts.map((o) => (
        <label
          key={String(o.v)}
          className="relative cursor-pointer rounded-(--co-radius) border-2 border-(--co-border) bg-(--co-card) p-3 text-sm transition-colors has-checked:border-(--co-accent-ring) has-checked:bg-(--co-accent-soft) has-focus-visible:outline-2 has-focus-visible:outline-(--co-fg)"
        >
          <input
            type="radio"
            name={name}
            className="sr-only"
            checked={enabled === o.v}
            onChange={() => onChange(o.v)}
          />
          <span className="block font-semibold leading-tight">{o.title}</span>
          <span className="block text-(--co-muted) tabular-nums">{o.sub}</span>
        </label>
      ))}
    </fieldset>
  );
}

export function CouponBlock({
  block,
  applied,
  onApply,
}: {
  block: BlockOf<"coupon">;
  applied: string | null;
  onApply: (code: string) => boolean;
}) {
  const id = useId();
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        setError(!onApply(code));
      }}
    >
      <label htmlFor={id} className="sr-only">
        {block.props.placeholder}
      </label>
      <input
        id={id}
        value={applied ?? code}
        disabled={!!applied}
        onChange={(e) => {
          setCode(e.target.value.slice(0, 32));
          setError(false);
        }}
        placeholder={block.props.placeholder}
        aria-invalid={error || undefined}
        aria-describedby={error ? `${id}-err` : undefined}
        autoComplete="off"
        className="min-w-0 flex-1 rounded-(--co-radius-sm) border border-(--co-border) bg-(--co-field) px-3 py-2.5 text-sm uppercase placeholder:normal-case placeholder:text-(--co-muted) focus:outline-2 focus:outline-(--co-accent-ring) aria-invalid:border-red-600"
      />
      <button
        type="submit"
        disabled={!!applied}
        className="rounded-(--co-radius-sm) border border-(--co-border) px-4 text-sm font-semibold disabled:opacity-60"
      >
        {applied ? "Applied" : "Apply"}
      </button>
      {error && (
        <p id={`${id}-err`} role="alert" className="sr-only">
          That code didn&apos;t work.
        </p>
      )}
    </form>
  );
}

const BADGES = {
  secure: { icon: Lock, label: "Secure checkout" },
  refund: { icon: RotateCcw, label: "30-day refunds" },
  support: { icon: Headphones, label: "Real human support" },
  shipping: { icon: Truck, label: "Free shipping" },
} as const;

export function TrustBadgesBlock({ block }: { block: BlockOf<"trustBadges"> }) {
  return (
    <ul className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-(--co-muted)">
      {block.props.items.map((k) => {
        const { icon: Icon, label } = BADGES[k];
        return (
          <li key={k} className="flex items-center gap-1.5">
            <Icon size={14} aria-hidden="true" />
            {label}
          </li>
        );
      })}
    </ul>
  );
}
