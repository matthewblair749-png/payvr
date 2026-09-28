import type { Contact, Transaction, User } from './types';

/** Seed data so every screen is clickable before Supabase is wired up. */
export const ME: User = {
  id: 'u_me',
  name: 'Matthew Cooper',
  handle: 'matthew',
  phone: '+1 415 555 0142',
  avatarUrl: null,
};

export const PEOPLE: User[] = [
  { id: 'u_jake', name: 'Jake Rivera', handle: 'jake' },
  { id: 'u_priya', name: 'Priya Shah', handle: 'priya' },
  { id: 'u_sofia', name: 'Sofia Martins', handle: 'sofia' },
  { id: 'u_leo', name: 'Leo Park', handle: 'leo' },
  { id: 'u_ava', name: 'Ava Chen', handle: 'ava' },
  { id: 'u_sam', name: 'Sam Okafor', handle: 'samo' },
];

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
const daysAgo = (d: number, h = 12) => {
  const t = new Date();
  t.setDate(t.getDate() - d);
  t.setHours(h, 20, 0, 0);
  return t.toISOString();
};

export const SEED_BALANCE_CENTS = 124_050;

export const SEED_TRANSACTIONS: Transaction[] = [
  { id: 'tx_9f2a41', fromUser: 'u_me', toUser: 'u_priya', amountCents: 1800, note: 'Tacos', type: 'request', status: 'pending', createdAt: minutesAgo(12) },
  { id: 'tx_8c1e07', fromUser: 'u_jake', toUser: 'u_me', amountCents: 2000, note: 'Pizza', type: 'send', status: 'completed', createdAt: minutesAgo(48), completedAt: minutesAgo(48) },
  { id: 'tx_7b33d9', fromUser: 'u_me', toUser: 'u_sofia', amountCents: 4250, note: 'Concert tickets', type: 'send', status: 'completed', createdAt: minutesAgo(190), completedAt: minutesAgo(190) },
  { id: 'tx_6a904c', fromUser: 'u_me', toUser: 'u_leo', amountCents: 650, note: 'Coffee', type: 'send', status: 'completed', createdAt: daysAgo(1, 9), completedAt: daysAgo(1, 9) },
  { id: 'tx_5d12e8', fromUser: 'u_ava', toUser: 'u_me', amountCents: 3500, note: 'Cab home', type: 'send', status: 'completed', createdAt: daysAgo(1, 23), completedAt: daysAgo(1, 23) },
  { id: 'tx_4e77b2', fromUser: 'u_sam', toUser: 'u_me', amountCents: 1200, note: 'Lunch', type: 'request', status: 'declined', createdAt: daysAgo(2, 13) },
  { id: 'tx_3f08a5', fromUser: 'u_me', toUser: 'u_jake', amountCents: 8000, note: 'Rent split', type: 'send', status: 'completed', createdAt: daysAgo(3, 18), completedAt: daysAgo(3, 18) },
  { id: 'tx_2c5b19', fromUser: 'u_priya', toUser: 'u_me', amountCents: 2400, note: 'Groceries', type: 'send', status: 'completed', createdAt: daysAgo(5, 11), completedAt: daysAgo(5, 11) },
  { id: 'tx_1a6f3d', fromUser: 'u_me', toUser: 'u_sofia', amountCents: 1500, note: 'Flowers', type: 'send', status: 'completed', createdAt: daysAgo(8, 16), completedAt: daysAgo(8, 16) },
];

export const SEED_CONTACTS: Contact[] = [
  { userId: 'u_jake', lastTappedAt: minutesAgo(48), viaTap: true },
  { userId: 'u_sofia', lastTappedAt: minutesAgo(190), viaTap: true },
  { userId: 'u_leo', lastTappedAt: daysAgo(1, 9), viaTap: true },
  { userId: 'u_ava', lastTappedAt: daysAgo(1, 23) },
  { userId: 'u_priya', lastTappedAt: daysAgo(5, 11) },
  { userId: 'u_sam', lastTappedAt: daysAgo(2, 13) },
];
