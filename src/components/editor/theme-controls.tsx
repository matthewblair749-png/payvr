"use client";

/** Theme controls shared by the landing demo and the Studio. */
import type { EditorAction } from "@/lib/checkout/reducer";
import { FONT_KEYS, FONTS, type FontKey } from "@/lib/checkout/meta";
import type { CheckoutConfig } from "@/lib/checkout/schema";
import { ControlGroup, RangeControl, Segmented, SwatchPicker } from "./controls";

export const ACCENTS = [
  { value: "#F04A1A", name: "Lumen orange" },
  { value: "#0E0E10", name: "Ink" },
  { value: "#1F7A4D", name: "Fern" },
  { value: "#3355E0", name: "Cobalt" },
  { value: "#8A3FFC", name: "Violet" },
  { value: "#E0457B", name: "Rose" },
];

export const BACKGROUNDS = [
  { value: "#EDEDF0", name: "Mist" },
  { value: "#F6EEE3", name: "Oat" },
  { value: "#FFF3C4", name: "Butter" },
  { value: "#E3EFE6", name: "Sage" },
  { value: "#FFFFFF", name: "White" },
  { value: "#0E0E10", name: "Ink" },
];

export function ThemeControls({
  config,
  dispatch,
  showBrandName = true,
}: {
  config: CheckoutConfig;
  dispatch: (a: EditorAction) => void;
  showBrandName?: boolean;
}) {
  return (
    <div className="space-y-6">
      {showBrandName && (
        <ControlGroup label="Brand name" htmlFor="brand-name">
          <input
            id="brand-name"
            value={config.brand.name}
            maxLength={48}
            onChange={(e) => dispatch({ type: "brand", patch: { name: e.target.value } })}
            className="w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 font-medium focus:border-ink focus:outline-none"
          />
        </ControlGroup>
      )}
      <SwatchPicker
        label="Accent"
        value={config.theme.accent}
        options={ACCENTS}
        onChange={(accent) => dispatch({ type: "theme", patch: { accent } })}
      />
      <SwatchPicker
        label="Background"
        value={config.theme.background}
        options={BACKGROUNDS}
        onChange={(background) => dispatch({ type: "theme", patch: { background } })}
      />
      <Segmented<FontKey>
        label="Font"
        value={config.theme.font}
        onChange={(font) => dispatch({ type: "theme", patch: { font } })}
        options={FONT_KEYS.map((k) => ({
          value: k,
          label: "Aa",
          srLabel: FONTS[k].label,
          style: { fontFamily: FONTS[k].stack, fontSize: "1rem" },
        }))}
      />
      <RangeControl
        label="Corner radius"
        value={config.theme.radius}
        min={0}
        max={28}
        unit="px"
        onChange={(radius) => dispatch({ type: "theme", patch: { radius } })}
      />
      <div className="grid grid-cols-2 gap-3">
        <Segmented
          label="Mode"
          value={config.theme.mode}
          onChange={(mode) => dispatch({ type: "theme", patch: { mode } })}
          options={[
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
          ]}
        />
        <Segmented
          label="Layout"
          value={config.theme.layout}
          onChange={(layout) => dispatch({ type: "theme", patch: { layout } })}
          options={[
            { value: "page", label: "Page" },
            { value: "modal", label: "Modal" },
          ]}
        />
      </div>
    </div>
  );
}
