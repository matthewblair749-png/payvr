# babel for your browser

A Chrome/Edge extension (Manifest V3) that translates the page you're on into your language,
keeping its layout. The original is always one click away.

## What it does

- **Translates in place.** Only the text inside the page's existing text nodes changes (plus `title`,
  `alt`, `placeholder` and `aria-label`). No elements are added, moved or restyled, so the page's own
  CSS and scripts keep working. `<html lang>` is set to the new language for screen readers.
- **Keeps up with the page.** A `MutationObserver` translates content the page adds later (infinite
  scroll, chat, single-page navigation) and re-translates text the page itself changes.
- **Original one click away.** A small pill in the corner switches between the translation and the
  original instantly, from memory, without another request. The toolbar popup and
  **Alt+Shift+T** do the same.
- **Leaves alone** code (`code`, `pre`, `kbd`), form fields, editable areas, scripts, SVG, and anything
  marked `translate="no"` or `.notranslate`.
- **Only runs when asked.** Permissions are `activeTab`, `scripting` and `storage`: the extension
  reads a page only after you click Translate or press the shortcut, and only that tab.

## How it fits together

| File | Role |
| --- | --- |
| `src/content/page-translator.ts` | The translator: collects text, batches it, applies and restores. Plain DOM code, unit-tested |
| `src/content/pill.ts` | The on-page control, in a shadow root so page CSS can't touch it |
| `src/content/main.ts` | Injected into a tab on request; wires the translator, the pill and messages |
| `src/background.ts` | Holds the account token, calls the Babel API, injects the content script |
| `src/bridge.ts` | Runs only on Babel's `/extension/connect` page and hands the account token over |
| `src/popup.ts`, `static/popup.html` | The toolbar popup |

The language list and request limits are imported from the web app (`../src`), so both always agree.

**Account link:** the website's Connect page issues a token for this browser (only its hash is stored)
and passes it to the extension through `bridge.js`. People can disconnect a browser from their
dashboard; the extension then asks them to connect again.

**Usage:** each page view counts as **one** translation toward the daily plan limit, however many
requests it takes, per language. Requests are capped at 100 pieces of text and 20,000 characters.

## Build and load

```bash
cd babel/extension
npm install
APP_URL=http://localhost:3000 npm run build    # bakes the Babel server address into dist/
```

Then in Chrome or Edge: open `chrome://extensions`, turn on **Developer mode**, choose
**Load unpacked**, and pick `babel/extension/dist`. With the web app running, click the babel
toolbar button and choose **Connect your account**.

`npm run watch` rebuilds on changes (reload the extension afterwards). `npm test` runs the translator
tests; `npm run typecheck` checks types.

For release builds, set `APP_URL` to your production URL. The extension can only talk to that host.

## Known limits

- Text is translated one text node at a time. That keeps the layout exact, but a sentence split
  across inline elements (`Read <a>the guide</a> today`) is translated in pieces.
- Right-to-left target languages (Arabic) are translated, but the page's direction isn't flipped, so
  the layout stays as the site designed it.
- Firefox needs a small manifest change (`background.scripts`) and hasn't been tried.
- Text in iframes, canvas and images isn't translated.
