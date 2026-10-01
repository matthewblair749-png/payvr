"use client";

/**
 * The landing page's "touch it" moment: a real, editable checkout.
 * No signup wall — visitors tweak it, then "Make this mine" carries their
 * design into the Studio via localStorage.
 */
import { useReducer, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Monitor, RotateCcw, Smartphone } from "lucide-react";
import { CheckoutView } from "@/components/checkout/checkout-view";
import { ScaledFrame } from "@/components/checkout/scaled-frame";
import { BlockList } from "@/components/editor/block-list";
import { Segmented } from "@/components/editor/controls";
import { ThemeControls } from "@/components/editor/theme-controls";
import { DEMO_CONFIG, DEMO_PRODUCT } from "@/lib/checkout/defaults";
import { saveDraft } from "@/lib/checkout/draft";
import { editorReducer } from "@/lib/checkout/reducer";
import { slugify } from "@/lib/utils";

export function LiveEditor() {
  const [config, dispatch] = useReducer(editorReducer, DEMO_CONFIG);
  const [device, setDevice] = useState<"phone" | "desktop">("phone");
  const router = useRouter();

  function makeItMine() {
    saveDraft({ ...config, brand: { ...config.brand, name: config.brand.name.trim() || "Your brand" } });
    router.push("/studio/checkouts?from=landing");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(320px,380px)_1fr] lg:gap-10">
      {/* ---------------- Controls ---------------- */}
      <div className="order-2 space-y-6 rounded-[28px] bg-white p-5 shadow-soft ring-1 ring-black/5 sm:p-6 lg:order-1">
        <ThemeControls config={config} dispatch={dispatch} />

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
            Blocks <span className="font-normal normal-case tracking-normal">· drag to reorder</span>
          </p>
          <BlockList
            blocks={config.blocks}
            onReorder={(from, to) => dispatch({ type: "reorder", from, to })}
            onToggle={(id) => dispatch({ type: "toggle", id })}
          />
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={makeItMine}
            className="group inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-orange px-6 py-4 font-display text-[1.2rem] font-bold tracking-[-0.02em] text-white shadow-soft transition-transform duration-200 ease-[var(--ease-spring)] hover:-translate-y-0.5 hover:shadow-lift active:translate-y-0 active:scale-[0.98]"
          >
            Make this mine
            <ArrowRight
              size={20}
              aria-hidden="true"
              className="transition-transform duration-200 group-hover:translate-x-1"
            />
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: "replace", config: DEMO_CONFIG })}
            aria-label="Reset the demo"
            title="Reset"
            className="grid h-14 w-14 place-items-center rounded-full bg-surface text-ink transition-colors hover:bg-black/10"
          >
            <RotateCcw size={18} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* ---------------- Preview ---------------- */}
      <div className="order-1 min-w-0 lg:sticky lg:top-6 lg:order-2 lg:self-start">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-sm text-muted">
            Live preview. Try code <strong className="font-semibold text-ink">LUMEN10</strong>.
          </p>
          <Segmented
            label="Preview device"
            className="[&_legend]:sr-only"
            value={device}
            onChange={setDevice}
            options={[
              { value: "phone", label: <Smartphone size={16} className="mx-auto" />, srLabel: "Phone" },
              { value: "desktop", label: <Monitor size={16} className="mx-auto" />, srLabel: "Desktop" },
            ]}
          />
        </div>

        {device === "phone" ? (
          <div className="mx-auto max-w-[402px] rounded-[48px] bg-ink p-2.5 shadow-lift">
            <ScaledFrame width={382} height={720} label="Checkout preview, phone" className="rounded-[38px]">
              <div className="h-full overflow-y-auto overscroll-contain">
                <CheckoutView config={config} product={DEMO_PRODUCT} mode="demo" />
              </div>
            </ScaledFrame>
          </div>
        ) : (
          <div className="overflow-hidden rounded-[20px] bg-ink shadow-lift">
            <div className="flex items-center gap-1.5 px-4 py-3" aria-hidden="true">
              <span className="h-3 w-3 rounded-full bg-white/25" />
              <span className="h-3 w-3 rounded-full bg-white/25" />
              <span className="h-3 w-3 rounded-full bg-white/25" />
              <span className="ml-3 flex-1 truncate rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">
                lumen.app/pay/{slugify(config.brand.name)}
              </span>
            </div>
            <ScaledFrame width={1200} height={780} label="Checkout preview, desktop">
              <div className="h-full overflow-y-auto overscroll-contain">
                <CheckoutView config={config} product={DEMO_PRODUCT} mode="demo" />
              </div>
            </ScaledFrame>
          </div>
        )}
      </div>
    </div>
  );
}
