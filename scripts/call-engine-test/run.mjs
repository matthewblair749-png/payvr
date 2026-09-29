/**
 * Real WebRTC test of the call engine (src/services/calls/session.ts) in Chromium with a fake
 * camera and microphone: two sessions call each other over in-memory signaling.
 *
 *   bun build scripts/call-engine-test/harness.ts --outfile scripts/call-engine-test/harness.js --target browser
 *   node scripts/call-engine-test/run.mjs   (needs Playwright + Chromium)
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const js = readFileSync(join(here, 'harness.js'), 'utf8');
const b = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
const p = await (await b.newContext({ permissions: ['camera', 'microphone'] })).newPage();
p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
// getUserMedia needs a secure origin; localhost counts, so serve a blank page there (intercepted, no server).
await p.route('http://localhost:9/', (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><body>' }));
await p.goto('http://localhost:9/');
await p.addScriptTag({ content: js });
await p.waitForFunction(() => window.__results, null, { timeout: 60000 });
const r = await p.evaluate(() => window.__results);
let failed = 0;
for (const [k, v] of Object.entries(r)) {
  if (v !== true) failed++;
  console.log((v === true ? 'PASS ' : 'FAIL ') + k + (v === true ? '' : ' = ' + JSON.stringify(v)));
}
await b.close();
process.exit(failed ? 1 : 0);
