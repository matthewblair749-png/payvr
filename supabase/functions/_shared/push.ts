/**
 * Delivers queued notifications (notification_outbox) through the Expo Push API.
 * Called by a Supabase Database Webhook on every outbox insert (and safe to run from cron):
 * it claims whatever is unsent, so nothing is sent twice or dropped.
 */
export const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const BATCH = 100; // Expo accepts up to 100 messages per request.

export type ClaimedNotification = {
  id: number;
  user_id: string;
  kind: 'payment' | 'request';
  body: string;
  data: Record<string, unknown>;
  tokens: string[];
};

export type PushDeps = {
  claim(limit: number): Promise<ClaimedNotification[]>;
  recordError(id: number, error: string): Promise<void>;
  removeToken(token: string): Promise<void>;
  fetch: typeof fetch;
  expoAccessToken?: string;
  /** Only for local tests against a fake Expo server. */
  pushUrl?: string;
};

type ExpoMessage = {
  to: string;
  body: string;
  data: Record<string, unknown>;
  sound: 'default';
  channelId: string;
  priority: 'high';
};
type ExpoTicket = { status: 'ok'; id: string } | { status: 'error'; message: string; details?: { error?: string } };

export async function sendPending(deps: PushDeps, limit = 200) {
  const claimed = await deps.claim(limit);
  const messages: { notificationId: number; message: ExpoMessage }[] = [];
  for (const n of claimed) {
    for (const to of n.tokens) {
      messages.push({
        notificationId: n.id,
        message: {
          to,
          body: n.body,
          data: { ...n.data, kind: n.kind },
          sound: 'default',
          channelId: n.kind === 'request' ? 'requests' : 'payments',
          priority: 'high',
        },
      });
    }
  }

  let sent = 0;
  const failed = new Map<number, string>();
  for (let i = 0; i < messages.length; i += BATCH) {
    const chunk = messages.slice(i, i + BATCH);
    let tickets: ExpoTicket[];
    try {
      const res = await deps.fetch(deps.pushUrl ?? EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(deps.expoAccessToken ? { Authorization: `Bearer ${deps.expoAccessToken}` } : {}),
        },
        body: JSON.stringify(chunk.map((c) => c.message)),
      });
      if (!res.ok) throw new Error(`Expo push HTTP ${res.status}`);
      tickets = ((await res.json()) as { data: ExpoTicket[] }).data ?? [];
    } catch (e) {
      for (const c of chunk) failed.set(c.notificationId, (e as Error).message);
      continue;
    }
    for (let j = 0; j < chunk.length; j++) {
      const ticket = tickets[j];
      if (ticket?.status === 'ok') {
        sent++;
        continue;
      }
      const reason = ticket?.details?.error ?? ticket?.message ?? 'no ticket';
      // The app was uninstalled or the token expired: stop sending to it.
      if (reason === 'DeviceNotRegistered') await deps.removeToken(chunk[j].message.to);
      failed.set(chunk[j].notificationId, reason);
    }
  }
  for (const [id, error] of failed) await deps.recordError(id, error);
  return { claimed: claimed.length, sent, failed: failed.size, noDevice: claimed.filter((n) => !n.tokens.length).length };
}
