/**
 * Group chat: conversations between friends, with bill splits right in the thread.
 * In the prototype chats live on the phone (demo data in mock mode). The live backend
 * work is described in docs/CHAT.md.
 */

export type SplitShare = {
  userId: string;
  cents: number;
  /** Set once this person has paid their share (the payment's transaction id). */
  paidTxId?: string | null;
};

export type Split = {
  id: string;
  /** Who paid the bill and is owed the shares. */
  ownerId: string;
  note: string;
  totalCents: number;
  shares: SplitShare[];
};

export type ChatMessage = {
  id: string;
  chatId: string;
  userId: string;
  createdAt: string;
} & (
  | { kind: 'text'; text: string }
  /** A bill split card; its shares update as people pay. */
  | { kind: 'split'; split: Split }
  /** "Jake paid Matthew" — posted when a share is paid. */
  | { kind: 'payment'; toUser: string; cents: number; note: string }
  /** Centered grey line: "Matthew created the group". */
  | { kind: 'system'; text: string }
);

export type Chat = {
  id: string;
  name: string;
  memberIds: string[];
  createdAt: string;
};

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

/** Splits `totalCents` evenly; the first people absorb the leftover cents. */
export function evenShares(totalCents: number, userIds: string[]): SplitShare[] {
  const base = Math.floor(totalCents / userIds.length);
  const extra = totalCents - base * userIds.length;
  return userIds.map((userId, i) => ({ userId, cents: base + (i < extra ? 1 : 0), paidTxId: null }));
}

export const SEED_CHATS: Chat[] = [
  { id: 'ch_pizza', name: 'Pizza crew', memberIds: ['u_me', 'u_jake', 'u_sofia', 'u_leo'], createdAt: minutesAgo(60 * 30) },
  { id: 'ch_home', name: 'Roommates', memberIds: ['u_me', 'u_priya', 'u_sam'], createdAt: minutesAgo(60 * 24 * 6) },
  { id: 'ch_trip', name: 'Lake trip', memberIds: ['u_me', 'u_ava', 'u_jake', 'u_priya', 'u_leo'], createdAt: minutesAgo(60 * 24 * 12) },
];

export const SEED_MESSAGES: ChatMessage[] = [
  // Pizza crew: Jake paid for pizza and split it; Sofia paid, you still owe.
  { id: 'm1', chatId: 'ch_pizza', userId: 'u_jake', createdAt: minutesAgo(60 * 30), kind: 'system', text: 'Jake created the group' },
  { id: 'm2', chatId: 'ch_pizza', userId: 'u_sofia', createdAt: minutesAgo(95), kind: 'text', text: 'pizza tonight? 🍕' },
  { id: 'm3', chatId: 'ch_pizza', userId: 'u_leo', createdAt: minutesAgo(93), kind: 'text', text: 'always' },
  { id: 'm4', chatId: 'ch_pizza', userId: 'u_jake', createdAt: minutesAgo(40), kind: 'text', text: 'got the bill, splitting it here' },
  {
    id: 'm5',
    chatId: 'ch_pizza',
    userId: 'u_jake',
    createdAt: minutesAgo(39),
    kind: 'split',
    split: {
      id: 'sp_pizza',
      ownerId: 'u_jake',
      note: 'Pizza night',
      totalCents: 6400,
      shares: [
        { userId: 'u_jake', cents: 1600, paidTxId: 'owner' },
        { userId: 'u_sofia', cents: 1600, paidTxId: 'demo_sofia' },
        { userId: 'u_leo', cents: 1600, paidTxId: null },
        { userId: 'u_me', cents: 1600, paidTxId: null },
      ],
    },
  },
  { id: 'm6', chatId: 'ch_pizza', userId: 'u_sofia', createdAt: minutesAgo(30), kind: 'payment', toUser: 'u_jake', cents: 1600, note: 'Pizza night' },
  { id: 'm7', chatId: 'ch_pizza', userId: 'u_sofia', createdAt: minutesAgo(29), kind: 'text', text: 'done ✅' },

  // Roommates: chat only.
  { id: 'm20', chatId: 'ch_home', userId: 'u_me', createdAt: minutesAgo(60 * 24 * 6), kind: 'system', text: 'Matthew created the group' },
  { id: 'm21', chatId: 'ch_home', userId: 'u_priya', createdAt: minutesAgo(60 * 5), kind: 'text', text: 'internet bill came in, I’ll split it this weekend' },
  { id: 'm22', chatId: 'ch_home', userId: 'u_sam', createdAt: minutesAgo(60 * 4), kind: 'text', text: 'sounds good' },

  // Lake trip
  { id: 'm30', chatId: 'ch_trip', userId: 'u_ava', createdAt: minutesAgo(60 * 24 * 12), kind: 'system', text: 'Ava created the group' },
  { id: 'm31', chatId: 'ch_trip', userId: 'u_ava', createdAt: minutesAgo(60 * 24 * 2), kind: 'text', text: 'cabin is booked!! 🏕️' },
  { id: 'm32', chatId: 'ch_trip', userId: 'u_leo', createdAt: minutesAgo(60 * 24 * 2 - 5), kind: 'text', text: 'let’s gooo' },
];

/** Short replies demo friends send back in mock mode, so a chat feels alive. */
export const DEMO_REPLIES = ['haha yes', 'on it', '👍', 'sounds good', 'omw', 'love it', 'for sure'];
