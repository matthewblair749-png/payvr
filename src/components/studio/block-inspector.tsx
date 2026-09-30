"use client";

/**
 * Property editor for the selected block. Each block type declares its fields
 * as data, so adding a block type means adding a line here — not a new form.
 */
import { useId, useState } from "react";
import { Plus, X } from "lucide-react";
import { BLOCK_META, BLOCK_TYPES, type BlockType } from "@/lib/checkout/meta";
import type { Block } from "@/lib/checkout/schema";
import { cn } from "@/lib/utils";

type Field =
  | { kind: "text"; key: string; label: string; max: number; multiline?: boolean }
  | { kind: "number"; key: string; label: string; min: number; max: number; suffix?: string }
  | { kind: "money"; key: string; label: string }
  | { kind: "toggle"; key: string; label: string }
  | { kind: "badges"; key: string; label: string }
  | { kind: "coupons"; key: string; label: string };

const FIELDS: Record<BlockType, Field[]> = {
  orderSummary: [{ kind: "toggle", key: "showImage", label: "Show product image" }],
  upsell: [
    { kind: "text", key: "title", label: "Title", max: 60 },
    { kind: "text", key: "description", label: "Description", max: 140, multiline: true },
    { kind: "money", key: "priceCents", label: "Add-on price" },
  ],
  testimonial: [
    { kind: "text", key: "quote", label: "Quote", max: 240, multiline: true },
    { kind: "text", key: "author", label: "Name", max: 60 },
    { kind: "text", key: "detail", label: "Detail", max: 60 },
    { kind: "number", key: "rating", label: "Stars", min: 0, max: 5 },
  ],
  countdown: [
    { kind: "text", key: "label", label: "Label", max: 60 },
    { kind: "number", key: "minutes", label: "Duration", min: 1, max: 1440, suffix: "min" },
  ],
  tipSlider: [
    { kind: "text", key: "label", label: "Label", max: 60 },
    { kind: "number", key: "maxPercent", label: "Max tip", min: 5, max: 50, suffix: "%" },
  ],
  payIn4: [{ kind: "text", key: "label", label: "Label", max: 60 }],
  coupon: [
    { kind: "text", key: "placeholder", label: "Placeholder", max: 40 },
    { kind: "coupons", key: "codes", label: "Codes" },
  ],
  trustBadges: [{ kind: "badges", key: "items", label: "Badges" }],
  payment: [
    { kind: "text", key: "buttonLabel", label: "Button label", max: 30 },
    { kind: "toggle", key: "haptics", label: "Haptic tap on success" },
    { kind: "toggle", key: "sound", label: "Chime on success" },
  ],
};

const BADGE_OPTIONS = [
  { value: "secure", label: "Secure checkout" },
  { value: "refund", label: "30-day refunds" },
  { value: "support", label: "Human support" },
  { value: "shipping", label: "Free shipping" },
] as const;

const inputCls =
  "w-full rounded-xl border border-black/12 bg-white px-3 py-2 text-sm focus:border-ink focus:outline-none";

export function BlockInspector({
  block,
  onChange,
  onClose,
}: {
  block: Block;
  onChange: (props: Partial<Block["props"]>) => void;
  onClose: () => void;
}) {
  const props = block.props as Record<string, unknown>;
  return (
    <section aria-labelledby="inspector-title" className="rounded-2xl bg-surface/70 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 id="inspector-title" className="text-sm font-bold">
          {BLOCK_META[block.type].label}
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close block settings"
          className="grid h-8 w-8 place-items-center rounded-lg text-muted-strong hover:bg-white"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      <div className="space-y-3">
        {FIELDS[block.type].map((f) => (
          <FieldInput key={`${block.id}-${f.key}`} field={f} value={props[f.key]} onChange={(v) => onChange({ [f.key]: v })} />
        ))}
      </div>
    </section>
  );
}

function FieldInput({ field, value, onChange }: { field: Field; value: unknown; onChange: (v: unknown) => void }) {
  const id = useId();
  const label = (
    <label htmlFor={id} className="mb-1 block text-xs font-semibold text-muted-strong">
      {field.label}
    </label>
  );
  switch (field.kind) {
    case "text":
      return (
        <div>
          {label}
          {field.multiline ? (
            <textarea
              id={id}
              rows={3}
              maxLength={field.max}
              value={String(value ?? "")}
              onChange={(e) => onChange(e.target.value)}
              className={cn(inputCls, "resize-y")}
            />
          ) : (
            <input id={id} maxLength={field.max} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} className={inputCls} />
          )}
        </div>
      );
    case "number":
      return (
        <div>
          {label}
          <div className="flex items-center gap-2">
            <input
              id={id}
              type="number"
              inputMode="numeric"
              min={field.min}
              max={field.max}
              value={Number(value ?? field.min)}
              onChange={(e) => {
                const n = Math.round(Number(e.target.value));
                if (Number.isFinite(n)) onChange(Math.max(field.min, Math.min(field.max, n)));
              }}
              className={cn(inputCls, "w-28")}
            />
            {field.suffix && <span className="text-sm text-muted-strong">{field.suffix}</span>}
          </div>
        </div>
      );
    case "money":
      return (
        <div>
          {label}
          <input
            id={id}
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            defaultValue={(Number(value ?? 0) / 100).toFixed(2)}
            onChange={(e) => {
              const cents = Math.round(Number(e.target.value) * 100);
              if (Number.isFinite(cents) && cents >= 0 && cents <= 1_000_000) onChange(cents);
            }}
            className={cn(inputCls, "w-32")}
          />
        </div>
      );
    case "toggle":
      return (
        <label className="flex cursor-pointer items-center justify-between gap-3 text-sm font-medium">
          {field.label}
          <input
            type="checkbox"
            role="switch"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
            className="h-5 w-9 cursor-pointer appearance-none rounded-full bg-black/20 transition-colors before:block before:h-4 before:w-4 before:translate-x-0.5 before:rounded-full before:bg-white before:shadow before:transition-transform checked:bg-ink checked:before:translate-x-[18px]"
          />
        </label>
      );
    case "coupons":
      return <CouponCodes value={(value as { code: string; percentOff: number }[]) ?? []} onChange={onChange} />;
    case "badges": {
      const items = (value as string[]) ?? [];
      return (
        <fieldset>
          <legend className="mb-1 text-xs font-semibold text-muted-strong">{field.label}</legend>
          <div className="flex flex-wrap gap-2">
            {BADGE_OPTIONS.map((o) => {
              const on = items.includes(o.value);
              return (
                <button
                  key={o.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onChange(on ? items.filter((i) => i !== o.value) : [...items, o.value])}
                  className="rounded-full border border-black/12 bg-white px-3 py-1.5 text-xs font-semibold aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-white"
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </fieldset>
      );
    }
  }
}

/** Palette of blocks that can be added (everything except the payment block). */
export function AddBlockPalette({ onAdd }: { onAdd: (type: BlockType) => void }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Add a block</p>
      <div className="grid grid-cols-2 gap-1.5">
        {BLOCK_TYPES.filter((t) => t !== "payment").map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onAdd(t)}
            className="flex items-center gap-1.5 rounded-xl border border-dashed border-black/15 px-2.5 py-2 text-left text-xs font-semibold hover:border-ink hover:bg-white"
          >
            <Plus size={14} aria-hidden="true" className="shrink-0" />
            {BLOCK_META[t].label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Edit a checkout's coupon codes. Validated again on the server at payment time. */
function CouponCodes({
  value,
  onChange,
}: {
  value: { code: string; percentOff: number }[];
  onChange: (v: { code: string; percentOff: number }[]) => void;
}) {
  const [code, setCode] = useState("");
  const [pct, setPct] = useState(10);
  const valid = /^[A-Z0-9_-]{2,24}$/.test(code) && !value.some((c) => c.code === code);
  return (
    <fieldset>
      <legend className="mb-1 text-xs font-semibold text-muted-strong">Codes</legend>
      <ul className="mb-2 space-y-1">
        {value.map((c) => (
          <li key={c.code} className="flex items-center justify-between rounded-lg bg-white px-2.5 py-1.5 text-sm">
            <span className="font-mono font-semibold">{c.code}</span>
            <span className="flex items-center gap-2 text-muted-strong">
              {c.percentOff}% off
              <button
                type="button"
                aria-label={`Remove code ${c.code}`}
                onClick={() => onChange(value.filter((x) => x.code !== c.code))}
                className="grid h-6 w-6 place-items-center rounded hover:bg-surface"
              >
                <X size={13} aria-hidden="true" />
              </button>
            </span>
          </li>
        ))}
        {value.length === 0 && <li className="text-xs text-muted-strong">No codes yet.</li>}
      </ul>
      <div className="flex gap-1.5">
        <label className="sr-only" htmlFor="new-code">New code</label>
        <input
          id="new-code"
          value={code}
          maxLength={24}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))}
          placeholder="SPRING20"
          className={cn(inputCls, "min-w-0 flex-1 font-mono uppercase")}
        />
        <label className="sr-only" htmlFor="new-pct">Percent off</label>
        <input
          id="new-pct"
          type="number"
          min={1}
          max={100}
          value={pct}
          onChange={(e) => setPct(Math.max(1, Math.min(100, Math.round(Number(e.target.value) || 1))))}
          className={cn(inputCls, "w-16")}
        />
        <button
          type="button"
          disabled={!valid || value.length >= 20}
          onClick={() => {
            onChange([...value, { code, percentOff: pct }]);
            setCode("");
          }}
          className="rounded-xl bg-ink px-3 text-sm font-semibold text-white disabled:opacity-40"
        >
          Add
        </button>
      </div>
    </fieldset>
  );
}
