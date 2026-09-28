/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildQr, newRequestRef, parseQr, REQUEST_CODE_TTL_S } from '../qr.ts';

const NOW = Date.UTC(2026, 8, 28, 12, 0, 0);

test('"My code" round-trips', () => {
  const raw = buildQr('Matthew');
  assert.equal(raw, 'payvr://u/matthew');
  assert.deepEqual(parseQr(raw, NOW), { ok: true, code: { handle: 'matthew' } });
});

test('request code round-trips with amount, note and expiry', () => {
  const raw = buildQr('jake', { amountCents: 2000, note: 'Pizza & drinks' }, NOW);
  const r = parseQr(raw, NOW);
  assert.ok(r.ok);
  assert.deepEqual(r.code.request, {
    amountCents: 2000,
    note: 'Pizza & drinks',
    expiresAt: NOW / 1000 + REQUEST_CODE_TTL_S,
  });
});

test('request codes expire (with a little clock-skew grace)', () => {
  const raw = buildQr('jake', { amountCents: 500, note: '' }, NOW);
  const justAfter = NOW + (REQUEST_CODE_TTL_S + 10) * 1000;
  const wayAfter = NOW + (REQUEST_CODE_TTL_S + 60) * 1000;
  assert.equal(parseQr(raw, justAfter).ok, true);
  assert.deepEqual(parseQr(raw, wayAfter), { ok: false, reason: 'expired' });
});

test('old v1 codes without a query still work', () => {
  assert.deepEqual(parseQr('  payvr://u/jake \n', NOW), { ok: true, code: { handle: 'jake' } });
});

test('rejects anything that is not a well-formed Payvr code', () => {
  const bad = [
    'https://evil.example/u/jake',
    'payvr://u/',
    'payvr://u/ab', // handle too short
    'payvr://u/jake/extra',
    'payvr://u/j%20ake',
    'payvr://u/jake?amt=-5&exp=9999999999',
    'payvr://u/jake?amt=0&exp=9999999999',
    'payvr://u/jake?amt=12.5&exp=9999999999',
    'payvr://u/jake?amt=1e3&exp=9999999999',
    'payvr://u/jake?amt=1000001&exp=9999999999', // over $10,000
    'payvr://u/jake?amt=2000', // request without expiry
    `payvr://u/jake?amt=2000&exp=9999999999&note=${'x'.repeat(61)}`,
    'payvr://u/%E0%A4%A',
    'random text',
  ];
  for (const raw of bad) assert.deepEqual(parseQr(raw, NOW), { ok: false, reason: 'not_payvr' }, raw);
});

test('notes are capped at 60 characters when building', () => {
  const raw = buildQr('jake', { amountCents: 100, note: 'y'.repeat(80) }, NOW);
  const r = parseQr(raw, NOW);
  assert.ok(r.ok && r.code.request?.note.length === 60);
});

test('request codes carry a ref that round-trips; bad refs are rejected', () => {
  const ref = newRequestRef();
  assert.match(ref, /^[a-z0-9]{12}$/);
  const r = parseQr(buildQr('jake', { amountCents: 1200, note: 'Lunch', ref }, NOW), NOW);
  assert.ok(r.ok);
  assert.equal(r.code.request?.ref, ref);
  assert.deepEqual(parseQr(`payvr://u/jake?amt=100&exp=9999999999&ref=NOT%20OK`, NOW), { ok: false, reason: 'not_payvr' });
  assert.deepEqual(parseQr(`payvr://u/jake?amt=100&exp=9999999999&ref=short`, NOW), { ok: false, reason: 'not_payvr' });
  const noRef = parseQr(buildQr('jake', { amountCents: 100, note: '' }, NOW), NOW);
  assert.ok(noRef.ok && noRef.code.request?.ref === undefined, 'older request codes without a ref still parse');
});

test('refs are different every time', () => {
  const refs = new Set(Array.from({ length: 1000 }, newRequestRef));
  assert.equal(refs.size, 1000);
});
