/**
 * Pure reducer for editing a CheckoutConfig. Shared by the landing-page demo
 * and the Studio so both behave identically (and can be unit-tested).
 */
import { defaultBlock } from "./defaults";
import { BLOCK_META, type BlockType } from "./meta";
import type { Block, CheckoutConfig, Theme } from "./schema";

export type EditorAction =
  | { type: "theme"; patch: Partial<Theme> }
  | { type: "brand"; patch: Partial<CheckoutConfig["brand"]> }
  | { type: "survey"; patch: Partial<CheckoutConfig["survey"]> }
  | { type: "reorder"; from: number; to: number }
  | { type: "toggle"; id: string }
  | { type: "add"; blockType: BlockType; index?: number }
  | { type: "remove"; id: string }
  | { type: "updateBlock"; id: string; props: Partial<Block["props"]> }
  | { type: "replace"; config: CheckoutConfig };

export function editorReducer(state: CheckoutConfig, action: EditorAction): CheckoutConfig {
  switch (action.type) {
    case "theme":
      return { ...state, theme: { ...state.theme, ...action.patch } };
    case "brand":
      return { ...state, brand: { ...state.brand, ...action.patch } };
    case "survey":
      return { ...state, survey: { ...state.survey, ...action.patch } };
    case "reorder": {
      const { from, to } = action;
      if (from === to || from < 0 || to < 0 || from >= state.blocks.length || to >= state.blocks.length) return state;
      const blocks = state.blocks.slice();
      const [moved] = blocks.splice(from, 1);
      blocks.splice(to, 0, moved);
      return { ...state, blocks };
    }
    case "toggle":
      return {
        ...state,
        // The payment block can never be hidden — a checkout must be able to take money.
        blocks: state.blocks.map((b) => (b.id === action.id && b.type !== "payment" ? { ...b, hidden: !b.hidden } : b)),
      };
    case "add": {
      const blocks = state.blocks.slice();
      const at = action.index ?? blocks.findIndex((b) => b.type === "payment");
      blocks.splice(at < 0 ? blocks.length : at, 0, defaultBlock(action.blockType));
      return { ...state, blocks };
    }
    case "remove":
      return {
        ...state,
        blocks: state.blocks.filter((b) => b.id !== action.id || !BLOCK_META[b.type].removable),
      };
    case "updateBlock":
      return {
        ...state,
        blocks: state.blocks.map((b) =>
          b.id === action.id ? ({ ...b, props: { ...b.props, ...action.props } } as Block) : b,
        ),
      };
    case "replace":
      return action.config;
  }
}
