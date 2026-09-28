// deno-lint-ignore-file require-await -- fakes mirror async client APIs.
import { assertEquals } from 'jsr:@std/assert@1';

import { type ClaimedNotification, EXPO_PUSH_URL, sendPending } from './push.ts';

function setup(queue: ClaimedNotification[], respond: (messages: { to: string }[]) => Response | Promise<Response>) {
  const errors: [number, string][] = [];
  const removed: string[] = [];
  const requests: { url: string; messages: { to: string; body: string; channelId: string; data: Record<string, unknown> }[]; auth?: string }[] = [];
  let claimedOnce = false;
  const deps = {
    claim: async () => {
      if (claimedOnce) return [];
      claimedOnce = true;
      return queue;
    },
    recordError: async (id: number, e: string) => void errors.push([id, e]),
    removeToken: async (t: string) => void removed.push(t),
    fetch: (async (url: string, init: RequestInit) => {
      const messages = JSON.parse(String(init.body));
      requests.push({ url, messages, auth: (init.headers as Record<string, string>).Authorization });
      return respond(messages);
    }) as unknown as typeof fetch,
    expoAccessToken: 'expo-token',
  };
  return { deps, errors, removed, requests };
}

const ok = (messages: { to: string }[]) =>
  new Response(JSON.stringify({ data: messages.map((_, i) => ({ status: 'ok', id: `t${i}` })) }));

const note = (id: number, tokens: string[], kind: 'payment' | 'request' = 'payment'): ClaimedNotification => ({
  id,
  user_id: 'u',
  kind,
  body: 'Jake paid you $20 · Pizza',
  data: { url: '/transaction/1' },
  tokens,
});

Deno.test('sends one message per device, with deep link data and the right channel', async () => {
  const { deps, requests } = setup([note(1, ['ExponentPushToken[a]', 'ExponentPushToken[b]']), note(2, ['ExponentPushToken[c]'], 'request')], ok);
  const res = await sendPending(deps);
  assertEquals(res, { claimed: 2, sent: 3, failed: 0, noDevice: 0 });
  assertEquals(requests.length, 1);
  assertEquals(requests[0].url, EXPO_PUSH_URL);
  assertEquals(requests[0].auth, 'Bearer expo-token');
  assertEquals(requests[0].messages[0].body, 'Jake paid you $20 · Pizza');
  assertEquals(requests[0].messages[0].data, { url: '/transaction/1', kind: 'payment' });
  assertEquals(requests[0].messages[2].channelId, 'requests');
});

Deno.test('people without a registered phone are skipped (no request)', async () => {
  const { deps, requests } = setup([note(1, [])], ok);
  assertEquals(await sendPending(deps), { claimed: 1, sent: 0, failed: 0, noDevice: 1 });
  assertEquals(requests.length, 0);
});

Deno.test('batches of 100 messages', async () => {
  const tokens = Array.from({ length: 250 }, (_, i) => `ExponentPushToken[t${i}]`);
  const { deps, requests } = setup([note(1, tokens)], ok);
  const res = await sendPending(deps);
  assertEquals(requests.map((r) => r.messages.length), [100, 100, 50]);
  assertEquals(res.sent, 250);
});

Deno.test('uninstalled apps (DeviceNotRegistered) lose their token; the error is recorded', async () => {
  const { deps, errors, removed } = setup([note(7, ['ExponentPushToken[gone]', 'ExponentPushToken[here]'])], () =>
    new Response(JSON.stringify({
      data: [
        { status: 'error', message: 'not registered', details: { error: 'DeviceNotRegistered' } },
        { status: 'ok', id: 'x' },
      ],
    })));
  const res = await sendPending(deps);
  assertEquals(res.sent, 1);
  assertEquals(removed, ['ExponentPushToken[gone]']);
  assertEquals(errors, [[7, 'DeviceNotRegistered']]);
});

Deno.test('Expo being down records errors instead of crashing', async () => {
  const { deps, errors } = setup([note(1, ['ExponentPushToken[a]']), note(2, ['ExponentPushToken[b]'])], () => new Response('boom', { status: 503 }));
  const res = await sendPending(deps);
  assertEquals(res.failed, 2);
  assertEquals(errors.map(([id]) => id), [1, 2]);
});
