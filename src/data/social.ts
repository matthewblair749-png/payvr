/**
 * Demo social data for the Friends feed (payments between your friends, with likes and
 * comments). Friends' amounts are never included: the feed only ever shows who paid whom
 * and the note. In live mode this comes from the server (see docs/SOCIAL.md).
 */
import type { Privacy } from './types';

export type FeedComment = { id: string; userId: string; text: string; createdAt: string };

export type FriendStory = {
  id: string;
  fromUser: string;
  toUser: string;
  note: string;
  createdAt: string;
  type: 'send' | 'request';
  privacy: Privacy;
  likes: number;
  comments: FeedComment[];
};

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

export const SEED_FRIEND_STORIES: FriendStory[] = [
  {
    id: 'st_1',
    fromUser: 'u_jake',
    toUser: 'u_sofia',
    note: 'pizza night 🍕',
    createdAt: minutesAgo(26),
    type: 'send',
    privacy: 'public',
    likes: 4,
    comments: [
      { id: 'c1', userId: 'u_priya', text: 'invite me next time', createdAt: minutesAgo(20) },
      { id: 'c2', userId: 'u_sofia', text: 'deal', createdAt: minutesAgo(18) },
    ],
  },
  {
    id: 'st_2',
    fromUser: 'u_priya',
    toUser: 'u_ava',
    note: 'concert tickets, front row',
    createdAt: minutesAgo(95),
    type: 'send',
    privacy: 'friends',
    likes: 7,
    comments: [{ id: 'c3', userId: 'u_leo', text: 'jealous', createdAt: minutesAgo(80) }],
  },
  {
    id: 'st_3',
    fromUser: 'u_leo',
    toUser: 'u_jake',
    note: 'gas money for the road trip ⛽',
    createdAt: minutesAgo(60 * 5),
    type: 'send',
    privacy: 'public',
    likes: 2,
    comments: [],
  },
  {
    id: 'st_4',
    fromUser: 'u_sofia',
    toUser: 'u_priya',
    note: 'sunday brunch 🥞',
    createdAt: minutesAgo(60 * 26),
    type: 'send',
    privacy: 'friends',
    likes: 5,
    comments: [
      { id: 'c4', userId: 'u_jake', text: 'those pancakes were unreal', createdAt: minutesAgo(60 * 25) },
    ],
  },
  {
    id: 'st_5',
    fromUser: 'u_ava',
    toUser: 'u_leo',
    note: 'happy birthday!! 🎂',
    createdAt: minutesAgo(60 * 30),
    type: 'send',
    privacy: 'public',
    likes: 11,
    comments: [
      { id: 'c5', userId: 'u_sam', text: 'happy bday Leo', createdAt: minutesAgo(60 * 29) },
      { id: 'c6', userId: 'u_priya', text: '🎉', createdAt: minutesAgo(60 * 29) },
      { id: 'c7', userId: 'u_leo', text: 'thank you all', createdAt: minutesAgo(60 * 28) },
    ],
  },
  {
    id: 'st_6',
    fromUser: 'u_sam',
    toUser: 'u_jake',
    note: 'fantasy league dues',
    createdAt: minutesAgo(60 * 50),
    type: 'send',
    privacy: 'friends',
    likes: 1,
    comments: [],
  },
];

/** Seed likes/comments for your own demo payments, so they feel alive too. */
export const SEED_MY_REACTIONS: Record<string, { likes: number; comments: FeedComment[] }> = {
  tx_8c1e07: { likes: 3, comments: [{ id: 'c8', userId: 'u_jake', text: 'thanks for grabbing it!', createdAt: minutesAgo(40) }] },
  tx_7b33d9: { likes: 6, comments: [{ id: 'c9', userId: 'u_sofia', text: 'best show of the year', createdAt: minutesAgo(170) }] },
  tx_5d12e8: { likes: 1, comments: [] },
};

export const SEED_FAVORITES = ['u_jake', 'u_priya'];
