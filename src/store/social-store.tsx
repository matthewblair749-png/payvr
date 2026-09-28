import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { SEED_FAVORITES, SEED_FRIEND_STORIES, SEED_MY_REACTIONS, type FeedComment } from '@/data/social';
import type { Privacy } from '@/data/types';
import { storage } from '@/services/storage';
import { haptics } from '@/utils/haptics';

import { useApp } from './app-store';

/** One item in the feed: a payment between two people. */
export type Story = {
  id: string;
  fromUser: string;
  toUser: string;
  note: string;
  createdAt: string;
  type: 'send' | 'request';
  privacy: Privacy;
  /** Only ever set on your own payments. Friends' amounts are private. */
  amountCents: number | null;
  mine: boolean;
  likes: number;
  likedByMe: boolean;
  comments: FeedComment[];
};

type Reaction = { likes: number; likedByMe: boolean; comments: FeedComment[] };

type SocialState = {
  friendsFeed: Story[];
  myFeed: Story[];
  storyById: (id: string) => Story | undefined;
  toggleLike: (id: string) => void;
  addComment: (id: string, text: string) => void;
  /** Visibility of one of your payments. */
  setPrivacy: (txId: string, p: Privacy) => void;
  defaultPrivacy: Privacy;
  setDefaultPrivacy: (p: Privacy) => void;
  favorites: string[];
  toggleFavorite: (userId: string) => void;
};

const Ctx = createContext<SocialState | null>(null);
const KEYS = { privacy: 'payvr.defaultPrivacy', favorites: 'payvr.favorites' };

export function SocialProvider({ children }: { children: React.ReactNode }) {
  const { transactions, me, backendMode } = useApp();
  const mock = backendMode === 'mock';

  const [reactions, setReactions] = useState<Record<string, Reaction>>(() => {
    if (!mock) return {};
    const r: Record<string, Reaction> = {};
    for (const s of SEED_FRIEND_STORIES) r[s.id] = { likes: s.likes, likedByMe: false, comments: s.comments };
    for (const [id, v] of Object.entries(SEED_MY_REACTIONS)) r[id] = { ...v, likedByMe: false };
    return r;
  });
  const [privacyById, setPrivacyById] = useState<Record<string, Privacy>>({});
  const [defaultPrivacy, setDefault] = useState<Privacy>('friends');
  const [favorites, setFavorites] = useState<string[]>(mock ? SEED_FAVORITES : []);

  useEffect(() => {
    storage.get(KEYS.privacy).then((v) => {
      if (v === 'public' || v === 'friends' || v === 'private') setDefault(v);
    });
    storage.get(KEYS.favorites).then((v) => {
      if (!v) return;
      try {
        const list = JSON.parse(v);
        if (Array.isArray(list)) setFavorites(list.filter((x) => typeof x === 'string'));
      } catch {
        // ignore a corrupt value
      }
    });
  }, []);

  const reactionFor = useCallback((id: string): Reaction => reactions[id] ?? { likes: 0, likedByMe: false, comments: [] }, [reactions]);

  const myFeed = useMemo<Story[]>(
    () =>
      transactions
        .filter((t) => t.status === 'completed' && (t.fromUser === me.id || t.toUser === me.id))
        .map((t) => ({
          id: t.id,
          fromUser: t.fromUser,
          toUser: t.toUser,
          note: t.note,
          createdAt: t.completedAt ?? t.createdAt,
          type: t.type,
          privacy: privacyById[t.id] ?? t.privacy ?? 'friends',
          amountCents: t.amountCents,
          mine: true,
          ...reactionFor(t.id),
        })),
    [transactions, me.id, privacyById, reactionFor],
  );

  const friendsFeed = useMemo<Story[]>(() => {
    const friends: Story[] = mock
      ? SEED_FRIEND_STORIES.map((s) => ({ ...s, amountCents: null, mine: false, ...reactionFor(s.id) }))
      : [];
    return [...friends, ...myFeed.filter((s) => s.privacy !== 'private')].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [mock, myFeed, reactionFor]);

  const storyById = useCallback(
    (id: string) => friendsFeed.find((s) => s.id === id) ?? myFeed.find((s) => s.id === id),
    [friendsFeed, myFeed],
  );

  const toggleLike = useCallback((id: string) => {
    haptics.tap();
    setReactions((r) => {
      const cur = r[id] ?? { likes: 0, likedByMe: false, comments: [] };
      return { ...r, [id]: { ...cur, likedByMe: !cur.likedByMe, likes: cur.likes + (cur.likedByMe ? -1 : 1) } };
    });
  }, []);

  const addComment = useCallback(
    (id: string, text: string) => {
      const clean = text.trim().slice(0, 280);
      if (!clean) return;
      setReactions((r) => {
        const cur = r[id] ?? { likes: 0, likedByMe: false, comments: [] };
        const c: FeedComment = { id: `c_${Date.now()}`, userId: me.id, text: clean, createdAt: new Date().toISOString() };
        return { ...r, [id]: { ...cur, comments: [...cur.comments, c] } };
      });
    },
    [me.id],
  );

  const setPrivacy = useCallback((txId: string, p: Privacy) => setPrivacyById((m) => ({ ...m, [txId]: p })), []);

  const setDefaultPrivacy = useCallback((p: Privacy) => {
    setDefault(p);
    storage.set(KEYS.privacy, p);
  }, []);

  const toggleFavorite = useCallback((userId: string) => {
    haptics.tap();
    setFavorites((list) => {
      const next = list.includes(userId) ? list.filter((x) => x !== userId) : [userId, ...list];
      storage.set(KEYS.favorites, JSON.stringify(next));
      return next;
    });
  }, []);

  const value: SocialState = {
    friendsFeed,
    myFeed,
    storyById,
    toggleLike,
    addComment,
    setPrivacy,
    defaultPrivacy,
    setDefaultPrivacy,
    favorites,
    toggleFavorite,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSocial() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSocial must be used inside SocialProvider');
  return ctx;
}

export const PRIVACY_LABEL: Record<Privacy, string> = { public: 'Public', friends: 'Friends', private: 'Private' };
