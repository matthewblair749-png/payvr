import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PageTranslator as RealPageTranslator, splitWhitespace, TranslateError, type TranslatorState } from "../src/content/page-translator";

// Every translator watches document.body, so each test must stop its own.
const live: RealPageTranslator[] = [];
class PageTranslator extends RealPageTranslator {
  constructor(...args: ConstructorParameters<typeof RealPageTranslator>) {
    super(...args);
    live.push(this);
  }
}
afterEach(() => live.splice(0).forEach((t) => t.destroy()));

/** Fake engine: "Hello" → "[es] Hello". Records every batch it was asked for. */
function engine() {
  const batches: string[][] = [];
  const translateBatch = vi.fn(async (segments: string[]) => {
    batches.push(segments);
    return segments.map((s) => (s === "UNTRANSLATABLE" ? null : `[es] ${s}`));
  });
  return { batches, translateBatch };
}

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

beforeEach(() => {
  document.documentElement.setAttribute("lang", "en");
  document.body.innerHTML = "";
});

describe("splitWhitespace", () => {
  it("keeps the spacing around words so inline layout doesn't shift", () => {
    expect(splitWhitespace("  Hello there \n")).toEqual({ lead: "  ", core: "Hello there", trail: " \n" });
    expect(splitWhitespace("Hi")).toEqual({ lead: "", core: "Hi", trail: "" });
  });
});

describe("PageTranslator", () => {
  it("swaps text in place without touching the elements", async () => {
    document.body.innerHTML = `<main class="hero"><h1 id="t">Welcome</h1><p>Read <a href="/x" class="link">the guide</a> today.</p></main>`;
    const before = document.body.innerHTML.replace(/>[^<]*</g, "><");
    const { translateBatch } = engine();
    await new PageTranslator(document, "es", { translateBatch }).translate();

    expect(document.getElementById("t")?.textContent).toBe("[es] Welcome");
    expect(document.querySelector("a")?.textContent).toBe("[es] the guide");
    expect(document.querySelector("p")?.textContent).toBe("[es] Read [es] the guide [es] today.");
    // Same elements, same attributes: only text changed.
    expect(document.body.innerHTML.replace(/>[^<]*</g, "><")).toBe(before);
    expect(document.documentElement.getAttribute("lang")).toBe("es");
  });

  it("puts every original back with one call, and translates again from memory", async () => {
    document.body.innerHTML = `<p> Hello </p><img alt="A red bicycle" src="x.png">`;
    const original = document.body.innerHTML;
    const { translateBatch } = engine();
    const t = new PageTranslator(document, "es", { translateBatch });
    await t.translate();
    expect(document.querySelector("p")?.textContent).toBe(" [es] Hello ");
    expect(document.querySelector("img")?.getAttribute("alt")).toBe("[es] A red bicycle");

    t.showOriginal();
    expect(document.body.innerHTML).toBe(original);
    expect(document.documentElement.getAttribute("lang")).toBe("en");
    expect(t.state.kind).toBe("original");

    await t.toggle();
    expect(document.querySelector("p")?.textContent).toBe(" [es] Hello ");
    expect(translateBatch).toHaveBeenCalledTimes(1); // second time came from memory
    expect(t.state.kind).toBe("translated");
  });

  it("skips code, form fields, editors and anything marked translate=no", async () => {
    document.body.innerHTML = `
      <p>Translate me</p>
      <code>const x = 1</code><pre>keep this</pre>
      <textarea>my draft</textarea>
      <div contenteditable="true">editing</div>
      <span translate="no">BrandName</span><span class="notranslate">Nope</span>
      <script>var a = "text"</script><style>p { color: red }</style>
      <p>12:30 · 42%</p>
      <input placeholder="Search the site">`;
    const { batches, translateBatch } = engine();
    await new PageTranslator(document, "es", { translateBatch }).translate();
    expect(batches.flat().sort()).toEqual(["Search the site", "Translate me"]);
    expect(document.querySelector("textarea")?.value).toBe("my draft");
    expect(document.querySelector("input")?.getAttribute("placeholder")).toBe("[es] Search the site");
  });

  it("sends each distinct piece of text once, however often it appears", async () => {
    document.body.innerHTML = `<li>Reply</li><li>Reply</li><li>Reply</li><li>Share</li>`;
    const { batches, translateBatch } = engine();
    await new PageTranslator(document, "es", { translateBatch }).translate();
    expect(batches.flat().sort()).toEqual(["Reply", "Share"]);
    expect([...document.querySelectorAll("li")].map((li) => li.textContent)).toEqual(["[es] Reply", "[es] Reply", "[es] Reply", "[es] Share"]);
  });

  it("splits big pages into batches within the limits", async () => {
    document.body.innerHTML = Array.from({ length: 25 }, (_, i) => `<p>Line number ${i}</p>`).join("");
    const { batches, translateBatch } = engine();
    await new PageTranslator(document, "es", { translateBatch, maxSegments: 10 }).translate();
    expect(batches.map((b) => b.length)).toEqual([10, 10, 5]);
  });

  it("leaves text it couldn't translate as it was", async () => {
    document.body.innerHTML = `<p>UNTRANSLATABLE</p><p>Fine</p>`;
    const { translateBatch } = engine();
    await new PageTranslator(document, "es", { translateBatch }).translate();
    expect([...document.querySelectorAll("p")].map((p) => p.textContent)).toEqual(["UNTRANSLATABLE", "[es] Fine"]);
  });

  it("translates content the page adds later", async () => {
    document.body.innerHTML = `<ul id="feed"><li>First post</li></ul>`;
    const { translateBatch } = engine();
    const t = new PageTranslator(document, "es", { translateBatch, debounceMs: 10 });
    await t.translate();

    const li = document.createElement("li");
    li.textContent = "New post";
    document.getElementById("feed")?.append(li);
    await tick(50);
    expect(li.textContent).toBe("[es] New post");
  });

  it("re-translates text the page changes, but ignores its own changes", async () => {
    document.body.innerHTML = `<span id="s">Loading</span>`;
    const { translateBatch } = engine();
    const t = new PageTranslator(document, "es", { translateBatch, debounceMs: 10 });
    await t.translate();
    const text = document.getElementById("s")?.firstChild as Text;
    expect(text.nodeValue).toBe("[es] Loading");

    text.nodeValue = "Ready";
    await tick(50);
    expect(text.nodeValue).toBe("[es] Ready");
    expect(translateBatch).toHaveBeenCalledTimes(2); // no loop from its own writes

    t.showOriginal();
    expect(text.nodeValue).toBe("Ready");
  });

  it("stops watching the page once the original is showing", async () => {
    document.body.innerHTML = `<div id="d"><p>One</p></div>`;
    const { translateBatch } = engine();
    const t = new PageTranslator(document, "es", { translateBatch, debounceMs: 10 });
    await t.translate();
    t.showOriginal();
    const p = document.createElement("p");
    p.textContent = "Two";
    document.getElementById("d")?.append(p);
    await tick(50);
    expect(p.textContent).toBe("Two");
  });

  it("ignores Babel's own on-page controls", async () => {
    document.body.innerHTML = `<p>Page text</p><div data-babel-ui><button>Show original</button></div>`;
    const { batches, translateBatch } = engine();
    await new PageTranslator(document, "es", { translateBatch }).translate();
    expect(batches.flat()).toEqual(["Page text"]);
  });

  it("reports progress and friendly errors", async () => {
    document.body.innerHTML = `<p>Hello</p>`;
    const states: TranslatorState[] = [];
    const t = new PageTranslator(document, "es", {
      translateBatch: async () => {
        throw new TranslateError("limit_reached", "That's all for today.");
      },
      onState: (s) => states.push(s),
    });
    await t.translate();
    expect(states.at(-1)).toEqual({ kind: "error", code: "limit_reached", message: "That's all for today." });
    expect(document.querySelector("p")?.textContent).toBe("Hello");
  });
});
