import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { ME, PEOPLE, SEED_BALANCE_CENTS, SEED_CONTACTS, SEED_TRANSACTIONS } from '@/data/mock';
import type { Contact, Draft, Transaction, User } from '@/data/types';
import { payments, type LedgerSnapshot } from '@/services/payments';
import { storage, StorageKeys } from '@/services/storage';
import { isToday } from '@/utils/dates';
import { haptics } from '@/utils/haptics';

type Status = 'loading' | 'signedOut' | 'signedIn';

export type IncomingEvent = {
  id: string;
  kind: 'payment' | 'request';
  transaction: Transaction;
};

type Settings = { notificationsOn: boolean; biometricsOn: boolean };

type AppState = {
  status: Status;
  me: User;
  balanceCents: number;
  transactions: Transaction[];
  contacts: Contact[];
  draft: Draft | null;
  settings: Settings;
  incoming: IncomingEvent | null;
  sentTodayCents: number;

  userById: (id: string) => User | undefined;
  userByHandle: (handle: string) => User | undefined;

  completeSignUp: (profile: Pick<User, 'name' | 'handle' | 'phone' | 'avatarUrl'>) => Promise<void>;
  logIn: () => Promise<void>;
  signOut: () => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => void;

  setDraft: (d: Draft | null) => void;
  /** Executes the current draft (send, request, or pay-a-request). */
  submitDraft: () => Promise<Transaction>;
  payRequest: (id: string) => Promise<Transaction>;
  declineRequest: (id: string) => Promise<void>;
  addMoney: (cents: number) => Promise<void>;
  cashOut: (cents: number) => Promise<void>;
  rememberContact: (userId: string) => void;

  dismissIncoming: () => void;
  /** Dev helpers standing in for realtime events from another phone. */
  simulateIncomingPayment: () => void;
  simulateIncomingRequest: () => void;
};

const Ctx = createContext<AppState | null>(null);

export function AppStoreProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [me, setMe] = useState<User>(ME);
  const [balanceCents, setBalance] = useState(SEED_BALANCE_CENTS);
  const [transactions, setTransactions] = useState<Transaction[]>(SEED_TRANSACTIONS);
  const [contacts, setContacts] = useState<Contact[]>(SEED_CONTACTS);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [settings, setSettings] = useState<Settings>({ notificationsOn: true, biometricsOn: true });
  const [incoming, setIncoming] = useState<IncomingEvent | null>(null);

  useEffect(() => {
    storage.get(StorageKeys.session).then((s) => setStatus(s ? 'signedIn' : 'signedOut'));
  }, []);

  const directory = useMemo(() => new Map([me, ...PEOPLE].map((u) => [u.id, u])), [me]);
  const userById = useCallback((id: string) => directory.get(id), [directory]);
  const userByHandle = useCallback(
    (handle: string) => [...directory.values()].find((u) => u.handle === handle.toLowerCase()),
    [directory],
  );

  const sentTodayCents = useMemo(
    () =>
      transactions
        .filter((t) => t.fromUser === me.id && t.status === 'completed' && isToday(t.createdAt))
        .reduce((s, t) => s + t.amountCents, 0),
    [transactions, me.id],
  );

  // Refs so async actions always see the latest ledger.
  const ledgerRef = useRef<LedgerSnapshot>({ balanceCents, sentTodayCents });
  ledgerRef.current = { balanceCents, sentTodayCents };

  const upsert = (tx: Transaction) =>
    setTransactions((list) => [tx, ...list.filter((t) => t.id !== tx.id)]);

  const rememberContact = useCallback((userId: string) => {
    setContacts((list) => [
      { userId, lastTappedAt: new Date().toISOString() },
      ...list.filter((c) => c.userId !== userId),
    ]);
  }, []);

  const payRequest = useCallback(async (id: string) => {
    const req = transactions.find((t) => t.id === id);
    if (!req) throw new Error('Request not found');
    const done = await payments.payRequest(req, ledgerRef.current);
    upsert(done);
    setBalance((b) => b - done.amountCents);
    return done;
  }, [transactions]);

  const submitDraft = useCallback(async () => {
    if (!draft?.peerId) throw new Error('No one to pay yet');
    if (draft.requestId) return payRequest(draft.requestId);
    let tx: Transaction;
    if (draft.mode === 'send') {
      tx = await payments.send(
        { fromUser: me.id, toUser: draft.peerId, amountCents: draft.amountCents, note: draft.note },
        ledgerRef.current,
      );
      setBalance((b) => b - tx.amountCents);
    } else {
      tx = await payments.request({
        requester: me.id,
        payer: draft.peerId,
        amountCents: draft.amountCents,
        note: draft.note,
      });
    }
    upsert(tx);
    rememberContact(draft.peerId);
    return tx;
  }, [draft, me.id, payRequest, rememberContact]);

  const declineRequest = useCallback(async (id: string) => {
    const req = transactions.find((t) => t.id === id);
    if (!req) return;
    upsert(await payments.declineRequest(req));
  }, [transactions]);

  const addMoney = useCallback(async (cents: number) => {
    await payments.addMoney(cents);
    setBalance((b) => b + cents);
  }, []);

  const cashOut = useCallback(async (cents: number) => {
    await payments.cashOut(cents, ledgerRef.current);
    setBalance((b) => b - cents);
  }, []);

  const completeSignUp = useCallback(
    async (profile: Pick<User, 'name' | 'handle' | 'phone' | 'avatarUrl'>) => {
      setMe((m) => ({ ...m, ...profile }));
      await storage.set(StorageKeys.session, 'mock-session-token');
      setStatus('signedIn');
    },
    [],
  );

  const logIn = useCallback(async () => {
    await storage.set(StorageKeys.session, 'mock-session-token');
    setStatus('signedIn');
  }, []);

  const signOut = useCallback(async () => {
    await storage.remove(StorageKeys.session);
    setStatus('signedOut');
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((s) => ({ ...s, ...patch }));
  }, []);

  const simulateIncomingPayment = useCallback(() => {
    const from = PEOPLE[0];
    const tx: Transaction = {
      id: `tx_${Date.now().toString(16)}`,
      fromUser: from.id,
      toUser: me.id,
      amountCents: 2000,
      note: 'Pizza',
      type: 'send',
      status: 'completed',
      createdAt: new Date().toISOString(),
    };
    upsert(tx);
    setBalance((b) => b + tx.amountCents);
    haptics.success();
    setIncoming({ id: tx.id, kind: 'payment', transaction: tx });
  }, [me.id]);

  const simulateIncomingRequest = useCallback(() => {
    const from = PEOPLE[3];
    const tx: Transaction = {
      id: `tx_${Date.now().toString(16)}`,
      fromUser: me.id,
      toUser: from.id,
      amountCents: 1450,
      note: 'Movie night',
      type: 'request',
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    upsert(tx);
    haptics.medium();
    setIncoming({ id: tx.id, kind: 'request', transaction: tx });
  }, [me.id]);

  const value: AppState = {
    status,
    me,
    balanceCents,
    transactions,
    contacts,
    draft,
    settings,
    incoming,
    sentTodayCents,
    userById,
    userByHandle,
    completeSignUp,
    logIn,
    signOut,
    updateSettings,
    setDraft,
    submitDraft,
    payRequest,
    declineRequest,
    addMoney,
    cashOut,
    rememberContact,
    dismissIncoming: () => setIncoming(null),
    simulateIncomingPayment,
    simulateIncomingRequest,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp must be used inside AppStoreProvider');
  return ctx;
}

/** Perspective helpers for a transaction relative to the signed-in user. */
export function describe(tx: Transaction, meId: string) {
  const outgoing = tx.fromUser === meId;
  const otherId = outgoing ? tx.toUser : tx.fromUser;
  const isRequest = tx.type === 'request';
  /** A request someone sent me that I still need to act on. */
  const needsMyAction = isRequest && tx.status === 'pending' && outgoing;
  const received = !outgoing && tx.status === 'completed';
  const sent = outgoing && tx.status === 'completed';
  return { outgoing, otherId, isRequest, needsMyAction, received, sent };
}
