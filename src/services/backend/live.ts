/** Supabase implementation of the Backend interface (auth, profiles, data, realtime). */
import type { Contact, Transaction, User } from '@/data/types';
import { supabase } from '@/services/supabase';

import { BackendError, type Backend, type RemoteSettings } from './types';

// ─── row mapping (snake_case rows → app types)

type UserRow = { id: string; name: string; handle: string; phone?: string | null; avatar_url: string | null };
export type TransactionRow = {
  id: string;
  from_user: string;
  to_user: string;
  amount_cents: number;
  note: string;
  type: Transaction['type'];
  status: Transaction['status'];
  created_at: string;
  completed_at: string | null;
  ref?: string | null;
};
type ContactRow = { contact_user_id: string; last_tapped_at: string };

const toUser = (r: UserRow): User => ({
  id: r.id,
  name: r.name,
  handle: r.handle,
  phone: r.phone ?? undefined,
  avatarUrl: r.avatar_url,
});

export const toTransaction = (r: TransactionRow): Transaction => ({
  id: r.id,
  fromUser: r.from_user,
  toUser: r.to_user,
  amountCents: Number(r.amount_cents),
  note: r.note ?? '',
  type: r.type,
  status: r.status,
  createdAt: r.created_at,
  completedAt: r.completed_at,
  ref: r.ref ?? null,
});

const toContact = (r: ContactRow): Contact => ({ userId: r.contact_user_id, lastTappedAt: r.last_tapped_at });

function db() {
  if (!supabase) throw new BackendError('Supabase is not configured.');
  return supabase;
}

function fail(error: { message: string; code?: string } | null, fallback: string): never {
  const msg = error?.message ?? '';
  if (/fetch|network/i.test(msg)) throw new BackendError('Can’t reach Payvr. Check your connection and try again.');
  throw new BackendError(msg || fallback);
}

// ─── avatar upload

async function uploadAvatar(userId: string, uri: string): Promise<string> {
  const sb = db();
  const res = await fetch(uri);
  const body = await res.arrayBuffer();
  const type = res.headers.get('content-type') || 'image/jpeg';
  const ext = type.includes('png') ? 'png' : 'jpg';
  // Path must start with the user's id — enforced by the storage policy.
  const path = `${userId}/avatar-${Date.now()}.${ext}`;
  const { error } = await sb.storage.from('avatars').upload(path, body, { contentType: type, upsert: true });
  if (error) fail(error, 'Could not upload your photo.');
  return sb.storage.from('avatars').getPublicUrl(path).data.publicUrl;
}

const DEMO_HANDLES = ['jake', 'priya', 'sofia'];

export const liveBackend: Backend = {
  mode: 'live',

  async currentUserId() {
    const { data } = await db().auth.getSession();
    return data.session?.user.id ?? null;
  },
  onSignedOut(cb) {
    const { data } = db().auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') cb();
    });
    return () => data.subscription.unsubscribe();
  },
  async sendCode(phone) {
    const { error } = await db().auth.signInWithOtp({ phone });
    if (error) fail(error, 'Could not send a code.');
  },
  async verifyCode(phone, token) {
    const { data, error } = await db().auth.verifyOtp({ phone, token, type: 'sms' });
    if (error || !data.user) fail(error, 'That code didn’t work.');
    return data.user.id;
  },
  async signOut() {
    await db().auth.signOut();
  },

  async getProfile(userId) {
    const { data, error } = await db().from('users').select('*').eq('id', userId).maybeSingle();
    if (error) fail(error, 'Could not load your profile.');
    return data ? toUser(data as UserRow) : null;
  },
  async saveProfile(userId, input) {
    const sb = db();
    let avatarUrl = input.avatarUri;
    if (avatarUrl && !/^https?:/.test(avatarUrl)) avatarUrl = await uploadAvatar(userId, avatarUrl);
    const fields = { name: input.name, handle: input.handle.toLowerCase(), avatar_url: avatarUrl };
    const existing = await this.getProfile(userId);
    // Separate insert / update: the app is only granted these specific columns.
    const { data, error } = existing
      ? await sb.from('users').update(fields).eq('id', userId).select('*').single()
      : await sb.from('users').insert({ id: userId, ...fields }).select('*').single();
    if (error?.code === '23505') throw new BackendError('That handle is taken.');
    if (error || !data) fail(error, 'Could not save your profile.');
    return toUser(data as UserRow);
  },
  async handleAvailable(handle) {
    const { data, error } = await db().rpc('handle_available', { p_handle: handle });
    if (error) return true; // Don't block typing on a network blip; the insert still enforces it.
    return data === true;
  },
  async lookupHandle(handle) {
    const { data, error } = await db().rpc('lookup_handle', { p_handle: handle });
    if (error) fail(error, 'Could not look up that code.');
    const row = (data as UserRow[] | null)?.[0];
    return row ? toUser(row) : null;
  },
  async getUsers(ids) {
    if (!ids.length) return [];
    const { data, error } = await db().from('users').select('id, name, handle, avatar_url').in('id', ids);
    if (error) fail(error, 'Could not load people.');
    return (data as UserRow[]).map(toUser);
  },

  async loadSnapshot(userId) {
    const sb = db();
    const [me, wallet, txs, contacts, settings] = await Promise.all([
      sb.from('users').select('*').eq('id', userId).single(),
      sb.from('wallets').select('balance_cents').eq('user_id', userId).single(),
      sb.from('transactions').select('*').order('created_at', { ascending: false }).limit(200),
      sb.from('contacts').select('contact_user_id, last_tapped_at').order('last_tapped_at', { ascending: false }),
      sb.from('settings').select('theme, notifications_on, notify_payments, notify_requests').eq('user_id', userId).maybeSingle(),
    ]);
    for (const r of [me, wallet, txs, contacts, settings]) if (r.error) fail(r.error, 'Could not load your account.');

    const transactions = (txs.data as TransactionRow[]).map(toTransaction);
    const contactList = (contacts.data as ContactRow[]).map(toContact);
    const ids = new Set<string>();
    transactions.forEach((t) => ids.add(t.fromUser === userId ? t.toUser : t.fromUser));
    contactList.forEach((c) => ids.add(c.userId));
    const s = settings.data as {
      theme: RemoteSettings['theme'];
      notifications_on: boolean;
      notify_payments: boolean;
      notify_requests: boolean;
    } | null;

    return {
      me: toUser(me.data as UserRow),
      balanceCents: Number((wallet.data as { balance_cents: number }).balance_cents),
      transactions,
      contacts: contactList,
      people: await this.getUsers([...ids]),
      settings: {
        theme: s?.theme ?? 'dark',
        notificationsOn: s?.notifications_on ?? true,
        notifyPayments: s?.notify_payments ?? true,
        notifyRequests: s?.notify_requests ?? true,
      },
    };
  },
  async saveSettings(userId, patch) {
    const row: Record<string, unknown> = {};
    if (patch.theme) row.theme = patch.theme;
    if (patch.notificationsOn !== undefined) row.notifications_on = patch.notificationsOn;
    if (patch.notifyPayments !== undefined) row.notify_payments = patch.notifyPayments;
    if (patch.notifyRequests !== undefined) row.notify_requests = patch.notifyRequests;
    await db().from('settings').update(row).eq('user_id', userId);
  },

  subscribe(userId, onEvent) {
    const sb = db();
    const onTx = (payload: { eventType: string; new: unknown }) => {
      if (payload.eventType !== 'INSERT' && payload.eventType !== 'UPDATE') return;
      onEvent({
        type: 'transaction',
        change: payload.eventType === 'INSERT' ? 'insert' : 'update',
        tx: toTransaction(payload.new as TransactionRow),
      });
    };
    // Realtime applies row-level security, so only this user's rows ever arrive.
    const channel = sb
      .channel(`payvr:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `to_user=eq.${userId}` }, onTx)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `from_user=eq.${userId}` }, onTx)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wallets', filter: `user_id=eq.${userId}` }, (payload) => {
        const row = payload.new as { balance_cents?: number };
        if (row?.balance_cents !== undefined) onEvent({ type: 'balance', balanceCents: Number(row.balance_cents) });
      })
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  },

  async startTapSession({ amountCents, mode, niToken }) {
    const { data, error } = await db().rpc('start_tap_session', {
      p_amount_cents: amountCents,
      p_mode: mode,
      p_ni_token: niToken,
    });
    if (error || !data) fail(error, 'Could not start tapping.');
    const row = data as { ble_token: string; expires_at: string };
    return { bleToken: row.ble_token, expiresAt: row.expires_at };
  },
  async resolveTapToken(token) {
    const { data, error } = await db().rpc('resolve_tap_token', { p_token: token });
    if (error) fail(error, 'Could not check that phone.');
    const row = (data as (UserRow & { mode: 'send' | 'request'; amount_cents: number; ni_token: string | null })[] | null)?.[0];
    if (!row) return null;
    return { user: toUser(row), mode: row.mode, amountCents: Number(row.amount_cents), niToken: row.ni_token };
  },
  async endTapSession() {
    await db().rpc('end_tap_session');
  },

  async registerPushToken(token, platform) {
    const { error } = await db().rpc('register_push_token', { p_token: token, p_platform: platform });
    if (error) fail(error, 'Could not turn on notifications.');
  },
  async unregisterPushToken(token) {
    await db().rpc('unregister_push_token', { p_token: token });
  },

  async simulateIncoming(kind, opts) {
    // Helpers from supabase/seed.sql (dev projects only).
    const { error } =
      kind === 'payment'
        ? await db().rpc('demo_incoming_payment', {
            p_amount_cents: opts?.amountCents ?? 2000,
            p_note: opts?.note ?? 'Pizza',
            p_ref: opts?.ref ?? null,
          })
        : await db().rpc('demo_incoming_request');
    if (error) fail(error, 'Demo helpers missing — run supabase/seed.sql on your dev project.');
  },
  async demoPeople() {
    const found = await Promise.all(DEMO_HANDLES.map((h) => this.lookupHandle(h).catch(() => null)));
    return found.filter((u): u is User => !!u);
  },
};
