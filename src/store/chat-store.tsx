import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { DEMO_REPLIES, evenShares, SEED_CHATS, SEED_MESSAGES, type Chat, type ChatMessage, type Split } from '@/data/chat';
import { haptics } from '@/utils/haptics';

import { useApp } from './app-store';

type ChatState = {
  /** Newest activity first. */
  chats: Chat[];
  chatById: (id: string) => Chat | undefined;
  messagesFor: (chatId: string) => ChatMessage[];
  lastMessage: (chatId: string) => ChatMessage | undefined;
  unread: Record<string, number>;
  totalUnread: number;
  markRead: (chatId: string) => void;
  /** Who is typing in a chat right now (demo friends in mock mode). */
  typing: Record<string, string | null>;
  sendText: (chatId: string, text: string) => void;
  createChat: (name: string, memberIds: string[]) => string;
  /** You paid the bill: split it evenly between the chosen members (you included). */
  createSplit: (chatId: string, totalCents: number, note: string, memberIds: string[]) => void;
  /** A share was paid (by you through the normal payment flow, or by a friend). */
  markSharePaid: (chatId: string, splitId: string, userId: string, txId: string) => void;
};

const Ctx = createContext<ChatState | null>(null);

let seq = 0;
const newId = (p: string) => `${p}_${Date.now().toString(36)}${(seq++).toString(36)}`;

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { me, backendMode, simulateIncomingPayment } = useApp();
  const mock = backendMode === 'mock';
  const [chats, setChats] = useState<Chat[]>(mock ? SEED_CHATS : []);
  const [messages, setMessages] = useState<ChatMessage[]>(mock ? SEED_MESSAGES : []);
  const [unread, setUnread] = useState<Record<string, number>>(mock ? { ch_pizza: 3, ch_home: 1 } : {});
  const [typing, setTyping] = useState<Record<string, string | null>>({});
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const list = timers.current;
    return () => list.forEach(clearTimeout);
  }, []);
  const later = useCallback((ms: number, fn: () => void) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);

  const post = useCallback((m: ChatMessage, countUnread = false) => {
    setMessages((list) => [...list, m]);
    if (countUnread) setUnread((u) => ({ ...u, [m.chatId]: (u[m.chatId] ?? 0) + 1 }));
  }, []);

  const chatById = useCallback((id: string) => chats.find((c) => c.id === id), [chats]);

  const messagesFor = useCallback(
    (chatId: string) => messages.filter((m) => m.chatId === chatId).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [messages],
  );

  const lastMessage = useCallback(
    (chatId: string) => {
      let last: ChatMessage | undefined;
      for (const m of messages) if (m.chatId === chatId && (!last || m.createdAt > last.createdAt)) last = m;
      return last;
    },
    [messages],
  );

  const sortedChats = useMemo(() => {
    const at = (c: Chat) => lastMessage(c.id)?.createdAt ?? c.createdAt;
    return [...chats].sort((a, b) => at(b).localeCompare(at(a)));
  }, [chats, lastMessage]);

  const markRead = useCallback((chatId: string) => setUnread((u) => (u[chatId] ? { ...u, [chatId]: 0 } : u)), []);

  // Demo friends answer: someone starts typing, then replies.
  const demoReply = useCallback(
    (chatId: string) => {
      const chat = chats.find((c) => c.id === chatId);
      const friends = chat?.memberIds.filter((id) => id !== me.id) ?? [];
      if (!mock || !friends.length) return;
      const who = friends[Math.floor(Math.random() * friends.length)];
      later(900, () => setTyping((t) => ({ ...t, [chatId]: who })));
      later(2600, () => {
        setTyping((t) => ({ ...t, [chatId]: null }));
        const text = DEMO_REPLIES[Math.floor(Math.random() * DEMO_REPLIES.length)];
        post({ id: newId('m'), chatId, userId: who, createdAt: new Date().toISOString(), kind: 'text', text }, true);
        haptics.light();
      });
    },
    [chats, me.id, mock, later, post],
  );

  const sendText = useCallback(
    (chatId: string, text: string) => {
      const clean = text.trim().slice(0, 1000);
      if (!clean) return;
      haptics.tap();
      post({ id: newId('m'), chatId, userId: me.id, createdAt: new Date().toISOString(), kind: 'text', text: clean });
      demoReply(chatId);
    },
    [me.id, post, demoReply],
  );

  const createChat = useCallback(
    (name: string, memberIds: string[]) => {
      const id = newId('ch');
      const now = new Date().toISOString();
      const members = [me.id, ...memberIds.filter((m) => m !== me.id)];
      setChats((list) => [{ id, name: name.trim() || 'New group', memberIds: members, createdAt: now }, ...list]);
      post({ id: newId('m'), chatId: id, userId: me.id, createdAt: now, kind: 'system', text: `${me.name.split(' ')[0]} created the group` });
      return id;
    },
    [me.id, me.name, post],
  );

  const updateSplit = useCallback((splitId: string, fn: (s: Split) => Split) => {
    setMessages((list) => list.map((m) => (m.kind === 'split' && m.split.id === splitId ? { ...m, split: fn(m.split) } : m)));
  }, []);

  const markSharePaid = useCallback(
    (chatId: string, splitId: string, userId: string, txId: string) => {
      let owner = '';
      let cents = 0;
      let note = '';
      for (const m of messages) {
        if (m.kind === 'split' && m.split.id === splitId) {
          owner = m.split.ownerId;
          note = m.split.note;
          cents = m.split.shares.find((s) => s.userId === userId)?.cents ?? 0;
        }
      }
      updateSplit(splitId, (s) => ({
        ...s,
        shares: s.shares.map((sh) => (sh.userId === userId ? { ...sh, paidTxId: txId } : sh)),
      }));
      if (owner) {
        post(
          { id: newId('m'), chatId, userId, createdAt: new Date().toISOString(), kind: 'payment', toUser: owner, cents, note },
          userId !== me.id,
        );
      }
    },
    [messages, me.id, post, updateSplit],
  );

  const createSplit = useCallback(
    (chatId: string, totalCents: number, note: string, memberIds: string[]) => {
      const members = [me.id, ...memberIds.filter((m) => m !== me.id)];
      const shares = evenShares(totalCents, members).map((s) => (s.userId === me.id ? { ...s, paidTxId: 'owner' } : s));
      const split: Split = { id: newId('sp'), ownerId: me.id, note: note.trim() || 'Split', totalCents, shares };
      post({ id: newId('m'), chatId, userId: me.id, createdAt: new Date().toISOString(), kind: 'split', split });
      if (!mock) return;
      // Demo: friends pay their shares one by one; the money really lands in your (test) balance.
      shares
        .filter((s) => s.userId !== me.id)
        .forEach((s, i) => {
          later(3500 + i * 2800, () => {
            simulateIncomingPayment({ amountCents: s.cents, note: split.note, from: s.userId });
            setMessages((list) =>
              list
                .map((m) =>
                  m.kind === 'split' && m.split.id === split.id
                    ? {
                        ...m,
                        split: {
                          ...m.split,
                          shares: m.split.shares.map((sh) => (sh.userId === s.userId ? { ...sh, paidTxId: `demo_${s.userId}` } : sh)),
                        },
                      }
                    : m,
                )
                .concat({
                  id: newId('m'),
                  chatId,
                  userId: s.userId,
                  createdAt: new Date().toISOString(),
                  kind: 'payment',
                  toUser: me.id,
                  cents: s.cents,
                  note: split.note,
                }),
            );
          });
        });
    },
    [me.id, mock, post, later, simulateIncomingPayment],
  );

  const totalUnread = Object.values(unread).reduce((a, b) => a + b, 0);

  const value: ChatState = {
    chats: sortedChats,
    chatById,
    messagesFor,
    lastMessage,
    unread,
    totalUnread,
    markRead,
    typing,
    sendText,
    createChat,
    createSplit,
    markSharePaid,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useChat() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useChat must be used inside ChatProvider');
  return ctx;
}
