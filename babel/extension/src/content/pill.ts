import type { TranslatorState } from "./page-translator";

/**
 * The small floating control on a translated page. Lives in a shadow root so
 * the page's CSS can't touch it and its CSS can't leak into the page.
 * It keeps "Show original" one click away.
 */
const STYLE = `
:host { all: initial; }
.pill {
  position: fixed; right: 16px; bottom: 16px; z-index: 2147483647;
  display: flex; align-items: center; gap: 8px; max-width: calc(100vw - 32px);
  padding: 6px 6px 6px 12px; border: 2px solid #2A1F4D; border-radius: 999px;
  background: #FFF6EC; color: #2A1F4D; box-shadow: 0 3px 0 #2A1F4D;
  font: 600 14px/1.3 ui-rounded, system-ui, -apple-system, "Segoe UI", sans-serif;
  transition: transform 200ms cubic-bezier(0.34, 1.45, 0.64, 1), opacity 200ms ease;
}
.pill[hidden] { display: none; }
.mark { width: 14px; height: 18px; flex: none; }
.text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
button {
  font: inherit; font-weight: 800; color: #2A1F4D; cursor: pointer;
  min-height: 36px; padding: 0 14px; border-radius: 999px; border: 2px solid #2A1F4D;
  background: #FF5A3C; transition: transform 150ms cubic-bezier(0.34, 1.45, 0.64, 1);
}
button:hover { transform: translateY(-1px); }
button:active { transform: translateY(1px) scale(0.97); }
button:focus-visible { outline: 3px solid #2A1F4D; outline-offset: 2px; }
button.quiet { background: transparent; border-color: transparent; padding: 0; width: 36px; }
button.quiet:hover { background: #F3EFE6; }
.error { color: #8A2410; }
@media (prefers-reduced-motion: reduce) { .pill, button { transition: none; } }
`;

const MARK = `<svg class="mark" viewBox="0 0 26 32" aria-hidden="true"><rect width="7" height="32" fill="#0C1021"/><path d="M7 0H12.5A6.5 6.5 0 0 1 12.5 13H7Z" fill="#FF5A3C"/><path d="M7 15H17A8.5 8.5 0 0 1 17 32H7Z" fill="#0C1021"/></svg>`;

export interface PillActions {
  toggle: () => void;
  connect: () => void;
}

export class Pill {
  private readonly host: HTMLElement;
  private readonly root: ShadowRoot;
  private readonly box: HTMLElement;
  private readonly text: HTMLElement;
  private readonly action: HTMLButtonElement;
  private dismissed = false;
  private onAction: () => void = () => {};

  constructor(
    doc: Document,
    private readonly languageName: string,
    private readonly actions: PillActions,
  ) {
    this.host = doc.createElement("babel-pill");
    // Marks it so the translator never translates Babel's own controls.
    this.host.setAttribute("data-babel-ui", "");
    this.host.setAttribute("translate", "no");
    this.root = this.host.attachShadow({ mode: "open" });
    this.root.innerHTML = `<style>${STYLE}</style>
      <div class="pill" role="region" aria-label="babel translation">
        ${MARK}<span class="text" role="status" aria-live="polite"></span>
        <button type="button" class="action"></button>
        <button type="button" class="quiet close" aria-label="Hide this">✕</button>
      </div>`;
    this.box = this.root.querySelector(".pill") as HTMLElement;
    this.text = this.root.querySelector(".text") as HTMLElement;
    this.action = this.root.querySelector(".action") as HTMLButtonElement;
    this.action.addEventListener("click", () => this.onAction());
    (this.root.querySelector(".close") as HTMLButtonElement).addEventListener("click", () => {
      this.dismissed = true;
      this.box.hidden = true;
    });
    doc.documentElement.append(this.host);
  }

  update(state: TranslatorState): void {
    if (this.dismissed && state.kind !== "error") return;
    this.box.hidden = false;
    this.text.classList.toggle("error", state.kind === "error");
    this.action.hidden = false;
    switch (state.kind) {
      case "idle":
      case "translating": {
        const pct = state.kind === "translating" && state.total > 0 ? ` ${Math.round((state.done / state.total) * 100)}%` : "";
        this.text.textContent = `Translating into ${this.languageName}…${pct}`;
        this.setAction("Show original", this.actions.toggle);
        break;
      }
      case "translated":
        this.text.textContent = `Translated into ${this.languageName}`;
        this.setAction("Show original", this.actions.toggle);
        break;
      case "original":
        this.text.textContent = "Showing the original";
        this.setAction(`Show ${this.languageName}`, this.actions.toggle);
        break;
      case "error":
        this.text.textContent = state.message;
        if (state.code === "unauthorized") this.setAction("Connect babel", this.actions.connect);
        else this.setAction("Try again", this.actions.toggle);
        break;
    }
  }

  private setAction(label: string, run: () => void) {
    this.action.textContent = label;
    this.onAction = run;
  }

  remove(): void {
    this.host.remove();
  }
}
