/**
 * In-memory stand-in for Supabase so the app runs with no backend configured.
 * `mockDb` plays the role of the database; services/payments.ts moves money in it
 * with the same rules as the SQL functions.
 */
import { ME, PEOPLE, SEED_BALANCE_CENTS, SEED_CONTACTS, SEED_TRANSACTIONS } from '@/data/mock';
import type { Contact, Transaction, User } from '@/data/types';
import { storage, StorageKeys } from '@/services/storage';

import type { Backend, LiveEvent, RemoteSettings } from './types';

type Listener = (e: LiveEvent) => void;

export const mockDb = {
  me: { ...ME } as User,
  people: [...PEOPLE] as User[],
  balanceCents: SEED_BALANCE_CENTS,
  transactions: [...SEED_TRANSACTIONS] as Transaction[],
  contacts: [...SEED_CONTACTS] as Contact[],
  settings: { theme: 'dark', notificationsOn: true } as RemoteSettings,
  listeners: new Set<Listener>(),
  emit(e: LiveEvent) {
    this.listeners.forEach((l) => l(e));
  },
  remember(userId: string) {
    this.contacts = [
      { userId, lastTappedAt: new Date().toISOString() },
      ...this.contacts.filter((c) => c.userId !== userId),
    ];
  },
  newId() {
    return `tx_${Math.random().toString(16).slice(2, 8)}${Date.now().toString(16).slice(-4)}`;
  },
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const mockBackend: Backend = {
  mode: 'mock',

  async currentUserId() {
    return (await storage.get(StorageKeys.session)) ? mockDb.me.id : null;
  },
  onSignedOut() {
    return () => {};
  },
  async sendCode() {
    await wait(400);
  },
  async verifyCode() {
    await wait(500);
    await storage.set(StorageKeys.session, 'mock-session-token');
    return mockDb.me.id;
  },
  async signOut() {
    await storage.remove(StorageKeys.session);
  },

  async getProfile(userId) {
    return userId === mockDb.me.id ? mockDb.me : (mockDb.people.find((p) => p.id === userId) ?? null);
  },
  async saveProfile(_userId, input) {
    mockDb.me = { ...mockDb.me, name: input.name, handle: input.handle, avatarUrl: input.avatarUri };
    return mockDb.me;
  },
  async handleAvailable(handle) {
    return !mockDb.people.some((p) => p.handle === handle.toLowerCase());
  },
  async lookupHandle(handle) {
    const h = handle.toLowerCase();
    return [mockDb.me, ...mockDb.people].find((p) => p.handle === h) ?? null;
  },
  async getUsers(ids) {
    return mockDb.people.filter((p) => ids.includes(p.id));
  },

  async loadSnapshot() {
    return {
      me: mockDb.me,
      balanceCents: mockDb.balanceCents,
      transactions: mockDb.transactions,
      contacts: mockDb.contacts,
      people: mockDb.people,
      settings: mockDb.settings,
    };
  },
  async saveSettings(_userId, patch) {
    mockDb.settings = { ...mockDb.settings, ...patch };
  },
  subscribe(_userId, onEvent) {
    mockDb.listeners.add(onEvent);
    return () => mockDb.listeners.delete(onEvent);
  },

  async simulateIncoming(kind) {
    const now = new Date().toISOString();
    if (kind === 'payment') {
      const tx: Transaction = {
        id: mockDb.newId(),
        fromUser: 'u_jake',
        toUser: mockDb.me.id,
        amountCents: 2000,
        note: 'Pizza',
        type: 'send',
        status: 'completed',
        createdAt: now,
        completedAt: now,
      };
      mockDb.transactions = [tx, ...mockDb.transactions];
      mockDb.balanceCents += tx.amountCents;
      mockDb.remember('u_jake');
      mockDb.emit({ type: 'transaction', change: 'insert', tx });
      mockDb.emit({ type: 'balance', balanceCents: mockDb.balanceCents });
    } else {
      const tx: Transaction = {
        id: mockDb.newId(),
        fromUser: mockDb.me.id,
        toUser: 'u_priya',
        amountCents: 1450,
        note: 'Movie night',
        type: 'request',
        status: 'pending',
        createdAt: now,
      };
      mockDb.transactions = [tx, ...mockDb.transactions];
      mockDb.emit({ type: 'transaction', change: 'insert', tx });
    }
  },
  async demoPeople() {
    return mockDb.people.slice(0, 3);
  },
};
