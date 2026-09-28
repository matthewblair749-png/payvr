/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { findToken, tokenToUuid, uuidToToken } from '../tap/ble-token.ts';
import { PROXIMITY, ProximityTracker, uwbVerdict } from '../tap/proximity.ts';

const TOKEN = '0123456789abcdef01234567';

test('token ↔ UUID round trip', () => {
  const uuid = tokenToUuid(TOKEN);
  assert.equal(uuid, '50415956-0123-4567-89ab-cdef01234567');
  assert.equal(uuidToToken(uuid), TOKEN);
  assert.equal(uuidToToken(uuid.toUpperCase()), TOKEN, 'iOS reports UUIDs in upper case');
});

test('rejects bad tokens and non-Payvr UUIDs', () => {
  assert.throws(() => tokenToUuid('xyz'));
  assert.throws(() => tokenToUuid(TOKEN + '00'));
  assert.equal(uuidToToken('0000180d-0000-1000-8000-00805f9b34fb'), null);
  assert.equal(uuidToToken('180D'), null);
  assert.equal(findToken(['180D', '50415956-0123-4567-89ab-cdef01234567']), TOKEN);
  assert.equal(findToken(null), null);
});

function feed(t: ProximityTracker, token: string, rssis: number[], start: number) {
  rssis.forEach((r, i) => t.add(token, r, start + i * 100));
  return start + (rssis.length - 1) * 100;
}

test('a phone far away is never picked', () => {
  const t = new ProximityTracker();
  const now = feed(t, 'far', [-75, -72, -78, -74], 0);
  assert.equal(t.closest(now), null);
});

test('a touching phone is picked once readings are steady', () => {
  const t = new ProximityTracker();
  t.add('near', -40, 0);
  t.add('near', -42, 100);
  assert.equal(t.closest(100), null, 'needs a few readings first');
  t.add('near', -41, 200);
  assert.equal(t.closest(200), 'near');
});

test('one noisy spike does not count as a tap', () => {
  const t = new ProximityTracker();
  const now = feed(t, 'x', [-80, -38, -79, -81, -78], 0);
  assert.equal(t.closest(now), null);
});

test('two phones equally close: nobody wins until one is clearly closer', () => {
  const t = new ProximityTracker();
  feed(t, 'a', [-45, -44, -46], 0);
  const now = feed(t, 'b', [-46, -45, -47], 0);
  assert.equal(t.closest(now), null);
  feed(t, 'b', [-70, -71, -72, -70, -71], now + 100);
  assert.equal(t.closest(now + 500), 'a');
});

test('stale readings expire', () => {
  const t = new ProximityTracker();
  const now = feed(t, 'near', [-40, -40, -40], 0);
  assert.equal(t.closest(now), 'near');
  assert.equal(t.closest(now + PROXIMITY.staleMs + 1), null);
});

test('ignored phones are skipped for a while', () => {
  const t = new ProximityTracker();
  let now = feed(t, 'near', [-40, -40, -40], 0);
  t.ignore('near', now);
  now = feed(t, 'near', [-40, -40, -40], now + 100);
  assert.equal(t.closest(now), null);
  now = feed(t, 'near', [-40, -40, -40], now + PROXIMITY.ignoreMs);
  assert.equal(t.closest(now), 'near');
});

test('unknown RSSI values are ignored', () => {
  const t = new ProximityTracker();
  const now = feed(t, 'x', [127, 0, 127], 0);
  assert.equal(t.signal('x', now), null);
});

test('UWB: accept within 20cm, reject when clearly far, else wait', () => {
  assert.equal(uwbVerdict([]), 'wait');
  assert.equal(uwbVerdict([0.6, 0.12]), 'accept');
  assert.equal(uwbVerdict([0.5, 0.8]), 'reject');
  assert.equal(uwbVerdict([0.5]), 'wait');
  assert.equal(uwbVerdict([0.3, 0.25]), 'wait');
});
