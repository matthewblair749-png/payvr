# Lumen

The home dashboard for Lumen, a checkout and payments platform for creators and small brands.
The goal: a merchant opens it for the first time and instantly understands their business.
Calm, confident, a little delightful. Not busy.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm run lint
npx tsc --noEmit
npm run build      # production build
LUMEN_EXPORT=1 npx next build   # static export to out/ (used for hosted previews)
```

## Stack

Next.js (App Router) · TypeScript · Tailwind v4 · shadcn-style components on Radix ·
Framer Motion · TanStack Query · cmdk. Fonts (Sora 700, DM Sans) are self-hosted via `next/font/local`.

## Design tokens

Everything lives in one file: [`src/styles/theme.css`](src/styles/theme.css).

- **Brand:** orange `#F04A1A`, spark `#FFD84D`, ink `#0E0E10`, white, page `#F7F7F8`, hairline `#E6E6EA`, muted `#6B6B73`.
- **Status only:** success `#12B76A`, failure `#D92D20`. Pending is neutral gray with a clock icon, never amber.
  Status color is always paired with an icon or label.
- **Orange is scarce.** It appears only on the primary action, the selected nav item, the main chart series
  and the single biggest-problem highlight. Every other chart is ink and gray.
- **Contrast:** ink on orange is 5.2:1, white on orange is 3.7:1, so primary buttons use **ink labels**.
  Orange is never used for small text.
- **Type:** exactly six sizes (12, 14, 16, 20, 28, 56). Sora 700 for the greeting, big numbers and the wordmark;
  DM Sans for UI. Tabular numerals everywhere (set on `body`).
- **Surfaces:** white cards, 16px radius, hairline borders, very soft shadows. Flat, no gradients.
- Tailwind's default palette and type scale are removed (`--color-*: initial`, `--text-*: initial`), so only
  the tokens above can be used.

## Theme and layout preferences

`<html data-theme>` and `<html data-sidebar>` are set by a tiny inline script before first paint
(`src/lib/prefs.ts`), so there is no theme flash and no sidebar width jump. Theme follows the OS by default
and can be overridden (System / Light / Dark) from the top bar. React reads these attributes through
`useSyncExternalStore` (`src/lib/html-attr.ts`).

## Structure

```
src/
  app/                 routes (Home + one page per job)
  components/
    shell/             app shell, sidebar, mobile drawer, top bar, ⌘K command menu
    home/              home widgets and their content-shaped skeletons
    ui/                button, card, dialog, select, tooltip, skeleton, kbd
  lib/                 filters (global date range), theme, prefs, nav, live-sales
  styles/theme.css     the design tokens
```

## Accessibility

- Skip link, landmarks (`aside`, `nav`, `header`, `main`), `aria-current` on the selected nav item.
- Full keyboard path: skip link → nav → collapse → search (⌘K / Ctrl+K) → live status → date range → theme.
- Visible focus ring on every control. Tooltips for the collapsed icon rail.
- `prefers-reduced-motion` removes all animation (CSS and Framer Motion via `MotionConfig reducedMotion="user"`).

## Build status

1. ✅ Tokens, layout shell, sidebar, top bar
2. KPI tiles and North Star chart
3. Funnel with drill-down
4. Morning brief and Ask Lumen
5. Live feed, "Why they buy", experiment card
6. Empty states, dark mode polish, motion, accessibility, performance
