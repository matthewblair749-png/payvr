// Renders the Payvr logo SVG to the PNG assets Expo needs.
// Usage: node scripts/make-icons.mjs  (requires Playwright + Chromium)
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BLUE = '#2150FF';
const glyph = (color) => `
  <defs><mask id="m" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
    <rect width="100" height="100" fill="#fff"/>
    <rect x="17.5" y="12.5" width="26" height="77" rx="13" fill="#000"/>
  </mask></defs>
  <circle cx="55" cy="41" r="18.5" stroke="${color}" stroke-width="14" fill="none" mask="url(#m)"/>
  <rect x="21" y="16" width="19" height="70" rx="9.5" fill="${color}"/>`;

const svg = ({ bg, color, scale, rounded }) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="1024" height="1024">
  ${bg ? `<rect width="100" height="100" ${rounded ? 'rx="23"' : ''} fill="${bg}"/>` : ''}
  <g transform="translate(${50 - 50 * scale} ${50 - 50 * scale}) scale(${scale})">${glyph(color)}</g>
</svg>`;

const assets = [
  ['icon.png', { bg: BLUE, color: '#fff', scale: 0.76 }],
  ['android-icon-foreground.png', { color: '#fff', scale: 0.5 }],
  ['android-icon-background.png', { bg: BLUE, color: BLUE, scale: 0.0001 }],
  ['android-icon-monochrome.png', { color: '#000', scale: 0.5 }],
  ['splash-icon.png', { bg: BLUE, color: '#fff', scale: 0.76, rounded: true }],
  ['favicon.png', { bg: BLUE, color: '#fff', scale: 0.76, rounded: true }],
];

mkdirSync('assets/images', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1024, height: 1024 } });
for (const [name, opts] of assets) {
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg(opts)}</body></html>`);
  await page.locator('svg').screenshot({ path: `assets/images/${name}`, omitBackground: true });
  console.log('wrote', name);
}
await browser.close();
