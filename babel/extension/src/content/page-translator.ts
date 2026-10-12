/**
 * Translates a page in place while keeping its layout.
 *
 * Only the text inside existing text nodes (plus a few readable attributes)
 * is swapped; no element is added, moved or restyled, so the page's own CSS
 * and scripts keep working. Every original is remembered, so "Show original"
 * puts the page back exactly as it was, instantly and without a request.
 *
 * New content the page adds later (infinite scroll, chat, single-page
 * navigation) is picked up by a MutationObserver and translated too.
 */

/** Never translate inside these: code, form fields, editors, and anything marked "don't translate". */
const SKIP_SELECTOR = [
  "script",
  "style",
  "noscript",
  "template",
  "code",
  "pre",
  "kbd",
  "samp",
  "var",
  "textarea",
  "input",
  "select",
  "option",
  "svg",
  "math",
  "iframe",
  "canvas",
  "[contenteditable='']",
  "[contenteditable='true']",
  "[contenteditable='plaintext-only']",
  "[translate='no']",
  ".notranslate",
  "[data-babel-ui]",
].join(",");

/** Attributes people read (tooltips, alt text, placeholders, screen reader labels). */
const ATTRIBUTES = ["title", "alt", "placeholder", "aria-label"] as const;
/** Attributes are still skipped inside these, but form fields keep their placeholders. */
const ATTRIBUTE_SKIP_SELECTOR = "script,style,noscript,template,code,pre,svg,math,[translate='no'],.notranslate,[data-babel-ui]";

const HAS_LETTER = /\p{L}/u;

export type TranslatorState =
  | { kind: "idle" }
  | { kind: "translating"; done: number; total: number }
  | { kind: "translated" }
  | { kind: "original" }
  | { kind: "error"; code: string; message: string };

export class TranslateError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "TranslateError";
  }
}

export interface PageTranslatorOptions {
  /** Translates a batch of text pieces; null for a piece that couldn't be translated. */
  translateBatch: (segments: string[]) => Promise<(string | null)[]>;
  onState?: (state: TranslatorState) => void;
  maxSegments?: number;
  maxChars?: number;
  maxSegmentChars?: number;
  /** Wait this long after the page changes before translating the new bits. */
  debounceMs?: number;
}

interface TextRecord {
  original: string;
  translated: string;
}

/** Splits " Hello  " into its leading space, the words, and its trailing space. */
export function splitWhitespace(value: string): { lead: string; core: string; trail: string } {
  const match = /^(\s*)([\s\S]*?)(\s*)$/.exec(value);
  return match ? { lead: match[1], core: match[2], trail: match[3] } : { lead: "", core: value, trail: "" };
}

export class PageTranslator {
  private readonly doc: Document;
  private readonly opts: Required<Omit<PageTranslatorOptions, "onState">> & Pick<PageTranslatorOptions, "onState">;
  /** core text → translation, for this target language. Makes toggling free. */
  private readonly memory = new Map<string, string | null>();
  private readonly texts = new Map<Text, TextRecord>();
  private readonly attrs = new Map<Element, Map<string, TextRecord>>();
  private readonly queuedTexts = new Set<Text>();
  private readonly queuedAttrs = new Set<Element>();
  private observer: MutationObserver | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running: Promise<void> | null = null;
  private originalLang: string | null = null;
  private _state: TranslatorState = { kind: "idle" };

  constructor(
    doc: Document,
    readonly targetLang: string,
    options: PageTranslatorOptions,
  ) {
    this.doc = doc;
    this.opts = { maxSegments: 100, maxChars: 20_000, maxSegmentChars: 5_000, debounceMs: 250, ...options };
  }

  get state(): TranslatorState {
    return this._state;
  }

  private setState(state: TranslatorState) {
    this._state = state;
    this.opts.onState?.(state);
  }

  /** Translates the whole page, then keeps translating whatever the page adds. */
  async translate(): Promise<void> {
    const root = this.doc.body;
    if (!root) return;
    // Leave "original" straight away, even when everything comes from memory.
    this.setState({ kind: "translating", done: 0, total: 0 });
    this.collect(root);
    this.observe();
    const html = this.doc.documentElement;
    this.originalLang = html.getAttribute("lang");
    // Lets screen readers pronounce the translated page correctly.
    html.setAttribute("lang", this.targetLang);
    await this.flush();
  }

  /** Puts every original back and stops watching the page. */
  showOriginal(): void {
    this.stopObserving();
    this.queuedTexts.clear();
    this.queuedAttrs.clear();
    for (const [node, record] of this.texts) {
      if (node.isConnected && node.nodeValue === record.translated) node.nodeValue = record.original;
    }
    for (const [el, map] of this.attrs) {
      for (const [name, record] of map) {
        if (el.getAttribute(name) === record.translated) el.setAttribute(name, record.original);
      }
    }
    this.texts.clear();
    this.attrs.clear();
    const html = this.doc.documentElement;
    if (this.originalLang === null) html.removeAttribute("lang");
    else html.setAttribute("lang", this.originalLang);
    this.setState({ kind: "original" });
  }

  async toggle(): Promise<void> {
    if (this._state.kind === "translated" || this._state.kind === "translating") this.showOriginal();
    else await this.translate();
  }

  destroy(): void {
    this.stopObserving();
  }

  // ----- Collecting ---------------------------------------------------------

  private skipped(el: Element | null, selector = SKIP_SELECTOR): boolean {
    return !el || el.closest(selector) !== null;
  }

  private worthTranslating(text: string): boolean {
    const { core } = splitWhitespace(text);
    return core.length > 0 && core.length <= this.opts.maxSegmentChars && HAS_LETTER.test(core);
  }

  private collect(root: Node): void {
    const view = this.doc.defaultView;
    if (!view) return;

    if (root.nodeType === view.Node.TEXT_NODE) {
      this.queueText(root as Text);
    } else if (root.nodeType === view.Node.ELEMENT_NODE || root.nodeType === view.Node.DOCUMENT_FRAGMENT_NODE) {
      const walker = this.doc.createTreeWalker(root, view.NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) this.queueText(node as Text);

      const elements: Element[] = [];
      if (root.nodeType === view.Node.ELEMENT_NODE) elements.push(root as Element);
      elements.push(...(root as Element).querySelectorAll(ATTRIBUTES.map((a) => `[${a}]`).join(",")));
      for (const el of elements) this.queueAttributes(el);
    }
  }

  private queueText(node: Text): void {
    if (this.texts.has(node) || this.skipped(node.parentElement)) return;
    if (this.worthTranslating(node.nodeValue ?? "")) this.queuedTexts.add(node);
  }

  private queueAttributes(el: Element): void {
    if (this.skipped(el, ATTRIBUTE_SKIP_SELECTOR)) return;
    if (ATTRIBUTES.some((a) => el.hasAttribute(a) && !this.attrs.get(el)?.has(a) && this.worthTranslating(el.getAttribute(a) ?? ""))) {
      this.queuedAttrs.add(el);
    }
  }

  // ----- Translating --------------------------------------------------------

  /** Translates everything queued, in batches, viewport first. */
  private flush(): Promise<void> {
    // One run at a time; anything queued meanwhile is picked up by the loop.
    this.running ??= this.runQueue().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async runQueue(): Promise<void> {
    while (this.queuedTexts.size > 0 || this.queuedAttrs.size > 0) {
      const texts = this.orderByVisibility([...this.queuedTexts]);
      const attrs = [...this.queuedAttrs];
      this.queuedTexts.clear();
      this.queuedAttrs.clear();

      const needed = new Set<string>();
      for (const node of texts) needed.add(splitWhitespace(node.nodeValue ?? "").core);
      for (const el of attrs) for (const a of ATTRIBUTES) if (el.hasAttribute(a)) needed.add(splitWhitespace(el.getAttribute(a) ?? "").core);
      const missing = [...needed].filter((core) => core && !this.memory.has(core) && HAS_LETTER.test(core));

      const total = missing.length;
      let done = 0;
      if (total > 0) this.setState({ kind: "translating", done, total });

      // Apply what memory already knows straight away.
      this.apply(texts, attrs);

      for (const batch of this.batches(missing)) {
        let results: (string | null)[];
        try {
          results = await this.opts.translateBatch(batch);
        } catch (error) {
          const e = error instanceof TranslateError ? error : new TranslateError("network", "Couldn't reach Babel. Check your connection.");
          this.setState({ kind: "error", code: e.code, message: e.message });
          return;
        }
        if (this._state.kind === "original") return; // switched back mid-way
        batch.forEach((core, i) => this.memory.set(core, results[i] ?? null));
        done += batch.length;
        this.setState({ kind: "translating", done, total });
        this.apply(texts, attrs);
      }
    }
    if (this._state.kind !== "original" && this._state.kind !== "error") this.setState({ kind: "translated" });
  }

  private *batches(cores: string[]): Generator<string[]> {
    let batch: string[] = [];
    let chars = 0;
    for (const core of cores) {
      if (batch.length > 0 && (batch.length >= this.opts.maxSegments || chars + core.length > this.opts.maxChars)) {
        yield batch;
        batch = [];
        chars = 0;
      }
      batch.push(core);
      chars += core.length;
    }
    if (batch.length > 0) yield batch;
  }

  /** What the reader can see now goes first; the rest follows. */
  private orderByVisibility(nodes: Text[]): Text[] {
    const view = this.doc.defaultView;
    if (!view || typeof view.innerHeight !== "number" || view.innerHeight === 0) return nodes;
    const visible: Text[] = [];
    const rest: Text[] = [];
    for (const node of nodes) {
      const rect = node.parentElement?.getBoundingClientRect();
      if (rect && rect.bottom >= 0 && rect.top <= view.innerHeight) visible.push(node);
      else rest.push(node);
    }
    return [...visible, ...rest];
  }

  private apply(texts: Text[], attrs: Element[]): void {
    for (const node of texts) {
      if (!node.isConnected || this.texts.has(node)) continue;
      const current = node.nodeValue ?? "";
      const { lead, core, trail } = splitWhitespace(current);
      const translation = this.memory.get(core);
      if (!translation || translation === core) continue;
      const translated = `${lead}${translation}${trail}`;
      this.texts.set(node, { original: current, translated });
      node.nodeValue = translated;
    }
    for (const el of attrs) {
      for (const name of ATTRIBUTES) {
        const current = el.getAttribute(name);
        if (current === null || this.attrs.get(el)?.has(name)) continue;
        const { lead, core, trail } = splitWhitespace(current);
        const translation = this.memory.get(core);
        if (!translation || translation === core) continue;
        const translated = `${lead}${translation}${trail}`;
        const map = this.attrs.get(el) ?? new Map<string, TextRecord>();
        map.set(name, { original: current, translated });
        this.attrs.set(el, map);
        el.setAttribute(name, translated);
      }
    }
  }

  // ----- Watching for new content -----------------------------------------

  private observe(): void {
    const view = this.doc.defaultView;
    if (this.observer || !view || !this.doc.body) return;
    this.observer = new view.MutationObserver((records) => this.onMutations(records));
    this.observer.observe(this.doc.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...ATTRIBUTES],
    });
  }

  private stopObserving(): void {
    this.observer?.disconnect();
    this.observer = null;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private onMutations(records: MutationRecord[]): void {
    let queued = false;
    for (const record of records) {
      if (record.type === "childList") {
        for (const node of record.addedNodes) {
          this.collect(node);
          queued = true;
        }
      } else if (record.type === "characterData") {
        const node = record.target as Text;
        const known = this.texts.get(node);
        if (known && node.nodeValue === known.translated) continue; // our own write
        // The page changed this text itself: translate the new version.
        this.texts.delete(node);
        this.queueText(node);
        queued = true;
      } else if (record.type === "attributes" && record.attributeName) {
        const el = record.target as Element;
        const known = this.attrs.get(el)?.get(record.attributeName);
        if (known && el.getAttribute(record.attributeName) === known.translated) continue;
        this.attrs.get(el)?.delete(record.attributeName);
        this.queueAttributes(el);
        queued = true;
      }
    }
    if (!queued || (this.queuedTexts.size === 0 && this.queuedAttrs.size === 0)) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, this.opts.debounceMs);
  }
}
