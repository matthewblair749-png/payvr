// Renders the Payvr logo to the PNG assets Expo needs, from the brand SVG.
// Usage: node scripts/make-icons.mjs  (requires Playwright + Chromium)
// eslint-disable-next-line import/no-unresolved -- Playwright is a one-off tool, not an app dependency.
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';

const BLUE = '#2150FF';

// The brand mark on a 100×100 grid. `cut` paints the gap in a color (as in the brand SVG);
// without it the gap is cut out with a mask, so the mark works on a transparent background.
const mark = (color, cut) =>
  cut
    ? `<g transform="translate(-2.5,0)">
         <rect x="22" y="22" width="20" height="66" rx="10" fill="${color}"/>
         <circle cx="56" cy="42" r="19" fill="none" stroke="${cut}" stroke-width="24"/>
         <circle cx="56" cy="42" r="19" fill="none" stroke="${color}" stroke-width="16"/>
       </g>`
    : `<defs><mask id="cut" maskUnits="userSpaceOnUse" x="-10" y="0" width="120" height="100">
         <rect x="-10" width="120" height="100" fill="#fff"/>
         <circle cx="56" cy="42" r="19" fill="none" stroke="#000" stroke-width="24"/>
       </mask></defs>
       <g transform="translate(-2.5,0)">
         <rect x="22" y="22" width="20" height="66" rx="10" fill="${color}" mask="url(#cut)"/>
         <circle cx="56" cy="42" r="19" fill="none" stroke="${color}" stroke-width="16"/>
       </g>`;

/** Square asset: optional blue background (square or rounded), mark scaled about the center. */
const square = ({ bg, rounded, color, cut, scale = 1 }) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="1024" height="1024">
  ${bg ? `<rect width="100" height="100" ${rounded ? 'rx="23"' : ''} fill="${bg}"/>` : ''}
  <g transform="translate(${50 - 50 * scale} ${50 - 50 * scale}) scale(${scale})">${mark(color, cut)}</g>
</svg>`;

// Splash: the rounded blue icon with the "payvr" wordmark below, on a transparent canvas
// (the splash background is #000000 in app.json).
const font = readFileSync('node_modules/@expo-google-fonts/space-grotesk/700Bold/SpaceGrotesk_700Bold.ttf').toString('base64');
const splash = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 330" width="900" height="990">
  <style>@font-face { font-family: SG; src: url(data:font/ttf;base64,${font}); }</style>
  <svg x="90" y="40" width="120" height="120" viewBox="0 0 100 100">
    <rect width="100" height="100" rx="23" fill="${BLUE}"/>${mark('#fff', BLUE)}
  </svg>
  <text x="150" y="232" text-anchor="middle" font-family="SG" font-weight="700" font-size="56" letter-spacing="-2.2" fill="#fff">payvr</text>
</svg>`;

const assets = [
  // App Store / Play icon: square, no rounding (the stores round it).
  ['payvr-app-icon.png', square({ bg: BLUE, color: '#fff', cut: BLUE })],
  // Android adaptive icon layers: the mark only, padded into the 66% safe zone.
  ['android-icon-foreground.png', square({ color: '#fff', scale: 0.62 })],
  ['android-icon-monochrome.png', square({ color: '#000', scale: 0.62 })],
  ['splash-icon.png', splash],
  // Browser tab icon: the rounded version.
  ['favicon.png', square({ bg: BLUE, rounded: true, color: '#fff', cut: BLUE })],
];

mkdirSync('assets/images', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, svg] of assets) {
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
  await page.waitForTimeout(200); // let the embedded font load
  await page.locator('body > svg').screenshot({ path: `assets/images/${name}`, omitBackground: true });
  console.log('wrote', name);
}
await browser.close();
