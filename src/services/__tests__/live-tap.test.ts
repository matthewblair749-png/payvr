/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { tokenToUuid } from '../tap/ble-token.ts';
import { startLiveTap, type TapDeps, type TapFound, type TapPeer, type TapStatus } from '../tap/live-tap.ts';

const MINE = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const JAKE = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const FAR = 'cccccccccccccccccccccccc';
const GHOST = 'dddddddddddddddddddddddd';

const jake: TapPeer = {
  user: { id: 'u_jake', name: 'Jake Rivera', handle: 'jake', avatarUrl: null },
  mode: 'request',
  amountCents: 2000,
  niToken: null,
};

const flush = () => new Promise((r) => setImmediate(r));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A fake phone: radios, native module and server, all controllable from the test. */
function fakePhone(opts: {
  radio?: 'ready' | 'bluetooth_off' | 'unauthorized' | 'unsupported';
  uwb?: boolean;
  peers?: Record<string, TapPeer>;
  advertiseError?: { code: string };
} = {}) {
  const log: string[] = [];
  let onToken: ((token: string, rssi: number | null) => void) | null = null;
  let distanceListener: ((e: { distance: number | null }) => void) | null = null;
  const resolved: string[] = [];

  const deps: TapDeps = {
    prepareRadio: async () => opts.radio ?? 'ready',
    scanForTokens: (cb) => {
      onToken = cb;
      log.push('scan:start');
      return () => {
        onToken = null;
        log.push('scan:stop');
      };
    },
    nearby: {
      isNearbyInteractionSupported: () => !!opts.uwb,
      startAdvertising: async (uuid) => {
        if (opts.advertiseError) throw Object.assign(new Error('nope'), opts.advertiseError);
        log.push(`advertise:${uuid}`);
        return true;
      },
      stopAdvertising: async () => void log.push('advertise:stop'),
      startNearbyInteraction: async () => 'MY-NI-TOKEN',
      runNearbyInteraction: async (t) => void log.push(`ni:run:${t}`),
      stopNearbyInteraction: async () => void log.push('ni:stop'),
      addListener: (_e, l) => {
        distanceListener = l;
        return { remove: () => (distanceListener = null) };
      },
    },
    backend: {
      startTapSession: async (input) => {
        log.push(`session:start:${input.mode}:${input.amountCents}:${input.niToken}`);
        return { bleToken: MINE };
      },
      resolveTapToken: async (token) => {
        resolved.push(token);
        return opts.peers?.[token] ?? null;
      },
      endTapSession: async () => void log.push('session:end'),
    },
    uwbWaitMs: 60,
  };

  const statuses: TapStatus[] = [];
  const found: TapFound[] = [];
  const start = () =>
    startLiveTap({ amountCents: 2000, mode: 'send' }, { onStatus: (s) => statuses.push(s), onFound: (f) => found.push(f) }, deps);

  return {
    deps,
    log,
    resolved,
    statuses,
    found,
    start,
    /** Another phone's advert, heard `n` times at this signal strength. */
    hear: async (token: string, rssi: number, n = 3) => {
      for (let i = 0; i < n; i++) onToken?.(token, rssi);
      await flush();
    },
    distance: async (d: number | null) => {
      distanceListener?.({ distance: d });
      await flush();
    },
  };
}

test('no Bluetooth support → "unsupported", nothing is started', async () => {
  const p = fakePhone({ radio: 'unsupported' });
  p.start();
  await flush();
  assert.deepEqual(p.statuses, ['starting', 'unsupported']);
  assert.ok(!p.log.some((l) => l.startsWith('session:start')));
});

test('Bluetooth off → "bluetooth_off"', async () => {
  const p = fakePhone({ radio: 'bluetooth_off' });
  p.start();
  await flush();
  assert.equal(p.statuses.at(-1), 'bluetooth_off');
});

test('advertising permission denied → "unauthorized", and stop() ends the session', async () => {
  const p = fakePhone({ advertiseError: { code: 'ERR_UNAUTHORIZED' } });
  const tap = p.start();
  await flush();
  assert.equal(p.statuses.at(-1), 'unauthorized');
  tap.stop();
  assert.ok(p.log.includes('session:end'));
});

test('advertises its own token and ignores far phones and itself', async () => {
  const p = fakePhone({ peers: { [JAKE]: jake } });
  p.start();
  await flush();
  assert.ok(p.log.includes(`advertise:${tokenToUuid(MINE)}`));
  assert.ok(p.log.includes('session:start:send:2000:null'));
  assert.equal(p.statuses.at(-1), 'searching');

  await p.hear(FAR, -78, 5);
  await p.hear(MINE, -30, 5);
  assert.deepEqual(p.resolved, [], 'nothing close enough (except our own advert)');
  assert.equal(p.found.length, 0);
});

test('a touching phone is resolved once and found over Bluetooth', async () => {
  const p = fakePhone({ peers: { [JAKE]: jake } });
  p.start();
  await flush();
  await p.hear(FAR, -75, 5);
  await p.hear(JAKE, -40, 3);
  await p.hear(JAKE, -41, 3);
  assert.deepEqual(p.resolved, [JAKE]);
  assert.equal(p.found.length, 1);
  assert.equal(p.found[0].user.name, 'Jake Rivera');
  assert.equal(p.found[0].via, 'bluetooth');
  assert.equal(p.found[0].mode, 'request', 'shows what the other phone is doing');
  assert.ok(p.log.includes('scan:stop'), 'stops scanning once found');
});

test('an unknown token (not on the Tap screen) is ignored, then the real phone is found', async () => {
  const p = fakePhone({ peers: { [JAKE]: jake } });
  p.start();
  await flush();
  await p.hear(GHOST, -38, 3);
  await p.hear(GHOST, -38, 3);
  assert.deepEqual(p.resolved, [GHOST], 'asked once, then ignored');
  await p.hear(GHOST, -70, 3); // ghost moves away
  await p.hear(JAKE, -40, 3);
  assert.deepEqual(p.resolved, [GHOST, JAKE]);
  assert.equal(p.found[0]?.user.id, 'u_jake');
});

test('UWB iPhones: accepted when Nearby Interaction measures ≤ 20 cm', async () => {
  const p = fakePhone({ uwb: true, peers: { [JAKE]: { ...jake, niToken: 'JAKE-NI' } } });
  p.start();
  await flush();
  assert.ok(p.log.includes('session:start:send:2000:MY-NI-TOKEN'), 'NI token is stored with the tap session');
  await p.hear(JAKE, -42, 3);
  assert.ok(p.log.includes('ni:run:JAKE-NI'));
  await p.distance(0.45);
  assert.equal(p.found.length, 0, 'still waiting');
  await p.distance(0.08);
  assert.equal(p.found[0]?.via, 'uwb');
  assert.equal(p.found[0]?.distanceCm, 8);
});

test('UWB iPhones: strong signal but UWB says they are across the table → rejected', async () => {
  const p = fakePhone({ uwb: true, peers: { [JAKE]: { ...jake, niToken: 'JAKE-NI' } } });
  p.start();
  await flush();
  await p.hear(JAKE, -42, 3);
  await p.distance(0.9);
  await p.distance(0.8);
  assert.equal(p.found.length, 0);
  await p.hear(JAKE, -42, 3);
  assert.deepEqual(p.resolved, [JAKE], 'ignored for a while after UWB rejects');
});

test('UWB with no readings in time falls back to Bluetooth', async () => {
  const p = fakePhone({ uwb: true, peers: { [JAKE]: { ...jake, niToken: 'JAKE-NI' } } });
  p.start();
  await flush();
  await p.hear(JAKE, -42, 3);
  await sleep(90);
  assert.equal(p.found[0]?.via, 'bluetooth');
  assert.equal(p.found[0]?.distanceCm, null);
});

test('only one phone with UWB → Bluetooth only, no NI run', async () => {
  const p = fakePhone({ uwb: true, peers: { [JAKE]: jake } });
  p.start();
  await flush();
  await p.hear(JAKE, -42, 3);
  assert.ok(!p.log.some((l) => l.startsWith('ni:run')));
  assert.equal(p.found[0]?.via, 'bluetooth');
});

test('stop() tears everything down and nothing is found afterwards', async () => {
  const p = fakePhone({ uwb: true, peers: { [JAKE]: jake } });
  const tap = p.start();
  await flush();
  tap.stop();
  for (const step of ['scan:stop', 'advertise:stop', 'ni:stop', 'session:end']) assert.ok(p.log.includes(step), step);
  await p.hear(JAKE, -40, 5);
  assert.equal(p.found.length, 0);
});

test('stop() while Bluetooth is still starting up: no session is ever opened', async () => {
  const p = fakePhone();
  let release!: () => void;
  p.deps.prepareRadio = () => new Promise((r) => (release = () => r('ready')));
  const tap = p.start();
  tap.stop();
  release();
  await flush();
  assert.ok(!p.log.some((l) => l.startsWith('session:start')));
  assert.ok(!p.log.includes('scan:start'));
});
