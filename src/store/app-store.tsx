import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';

import type { Contact, Draft, Transaction, User } from '@/data/types';
import { backend, type LiveEvent, type ProfileInput } from '@/services/backend';
import { payments } from '@/services/payments';
import { registerForPush, type PushRegistration } from '@/services/push';
import { storage, StorageKeys } from '@/services/storage';
import type { ThemePreference } from '@/theme/colors';
import { haptics } from '@/utils/haptics';

/**
 * loading      → checking for a saved session
 * signedOut    → show onboarding
 * needsProfile → phone verified, but no name / @handle yet
 * signedIn     → everything loaded
 */
type Status = 'loading' | 'signedOut' | 'needsProfile' | 'signedIn';

export type IncomingEvent = {
  id: string;
  kind: 'payment' | 'request' | 'requestPaid';
  transaction: Transaction;
};

type Settings = {
  notificationsOn: boolean;
  notifyPayments: boolean;
  notifyRequests: boolean;
  biometricsOn: boolean;
};

const EMPTY_USER: User = { id: '', name: '', handle: '' };
const DAY_MS = 24 * 60 * 60 * 1000;

type AppState = {
  status: Status;
  backendMode: 'mock' | 'live';
  me: User;
  balanceCents: number;
  transactions: Transaction[];
  contacts: Contact[];
  draft: Draft | null;
  settings: Settings;
  incoming: IncomingEvent | null;
  /** Sent in the last 24 hours (the daily limit is a rolling 24h window). */
  sentTodayCents: number;

  userById: (id: string) => User | undefined;
  /** Finds someone by QR handle (and remembers their profile). */
  lookupHandle: (handle: string) => Promise<User | null>;
  handleAvailable: (handle: string) => Promise<boolean>;
  /** People a single phone can "tap" until Bluetooth arrives in step 5. */
  tapCandidates: () => Promise<User[]>;
  /** Remembers public profiles (e.g. someone just found by tapping). */
  addPeople: (users: User[]) => void;

  sendCode: (phoneE164: string) => Promise<void>;
  /** Verifies the SMS code; resolves to whether a profile still has to be created. */
  verifyCode: (phoneE164: string, code: string) => Promise<{ needsProfile: boolean }>;
  completeSignUp: (profile: ProfileInput) => Promise<void>;
  signOut: () => Promise<void>;
  /** Changes your name or photo (the @handle stays the same). */
  updateProfile: (patch: { name: string; avatarUrl?: string | null }) => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => void;
  saveTheme: (theme: ThemePreference) => void;

  setDraft: (d: Draft | null) => void;
  /** Executes the current draft (send, request, or pay-a-request), with last-second edits (note, privacy). */
  submitDraft: (patch?: Partial<Draft>) => Promise<Transaction>;
  payRequest: (id: string) => Promise<Transaction>;
  declineRequest: (id: string) => Promise<void>;
  addMoney: (cents: number) => Promise<void>;
  cashOut: (cents: number) => Promise<void>;
  rememberContact: (userId: string, viaTap?: boolean) => void;

  dismissIncoming: () => void;
  simulateIncomingPayment: (opts?: { amountCents?: number; note?: string; ref?: string; from?: string }) => void;
  /** Result of the last push registration (null until tried). */
  push: PushRegistration | null;
  simulateIncomingRequest: () => void;
};

const Ctx = createContext<AppState | null>(null);

export function AppStoreProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [userId, setUserId] = useState<string | null>(null);
  const [me, setMe] = useState<User>(EMPTY_USER);
  const [people, setPeople] = useState<Record<string, User>>({});
  const [balanceCents, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [draftState, setDraft] = useState<Draft | null>(null);
  const draft = draftState;
  const [settings, setSettings] = useState<Settings>({
    notificationsOn: true,
    notifyPayments: true,
    notifyRequests: true,
    biometricsOn: true,
  });
  const [push, setPush] = useState<PushRegistration | null>(null);
  const pushToken = useRef<string | null>(null);
  const [incoming, setIncoming] = useState<IncomingEvent | null>(null);

  const addPeople = useCallback((users: User[]) => {
    if (!users.length) return;
    setPeople((p) => {
      const next = { ...p };
      users.forEach((u) => (next[u.id] = u));
      return next;
    });
  }, []);

  /** Loads the account after sign-in (or on app start with a saved session). */
  const load = useCallback(
    async (uid: string) => {
      const profile = await backend.getProfile(uid);
      setUserId(uid);
      if (!profile) {
        setStatus('needsProfile');
        return;
      }
      const snap = await backend.loadSnapshot(uid);
      setMe(snap.me);
      setBalance(snap.balanceCents);
      setTransactions(snap.transactions);
      setContacts(snap.contacts);
      setPeople({});
      addPeople(snap.people);
      const bio = await storage.get(StorageKeys.biometrics);
      setSettings({
        notificationsOn: snap.settings.notificationsOn,
        notifyPayments: snap.settings.notifyPayments,
        notifyRequests: snap.settings.notifyRequests,
        biometricsOn: bio !== '0',
      });
      setStatus('signedIn');
    },
    [addPeople],
  );

  // Restore the session on launch.
  useEffect(() => {
    backend
      .currentUserId()
      .then((uid) => (uid ? load(uid) : setStatus('signedOut')))
      .catch(() => setStatus('signedOut'));
    return backend.onSignedOut(() => setStatus('signedOut'));
  }, [load]);

  const peopleRef = useRef(people);
  useEffect(() => {
    peopleRef.current = people;
  }, [people]);

  // Clock for the rolling 24h limit window; ticks each minute.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Realtime: money and requests arriving from other phones.
  useEffect(() => {
    if (status !== 'signedIn' || !userId) return;
    const onEvent = (e: LiveEvent) => {
      if (e.type === 'balance') {
        setBalance(e.balanceCents);
        return;
      }
      const tx = e.tx;
      setTransactions((list) => [tx, ...list.filter((t) => t.id !== tx.id)].sort(byNewest));
      const otherId = tx.fromUser === userId ? tx.toUser : tx.fromUser;
      if (!peopleRef.current[otherId]) backend.getUsers([otherId]).then(addPeople).catch(() => {});

      let kind: IncomingEvent['kind'] | null = null;
      if (e.change === 'insert' && tx.type === 'send' && tx.toUser === userId) kind = 'payment';
      if (e.change === 'insert' && tx.type === 'request' && tx.fromUser === userId && tx.status === 'pending') kind = 'request';
      if (e.change === 'update' && tx.type === 'request' && tx.toUser === userId && tx.status === 'completed') kind = 'requestPaid';
      if (kind) {
        if (kind === 'request') haptics.medium();
        else haptics.success();
        setIncoming({ id: tx.id, kind, transaction: tx });
      }
    };
    return backend.subscribe(userId, onEvent);
  }, [status, userId, addPeople]);

  // Register this phone for push notifications once signed in (and when turned back on).
  useEffect(() => {
    if (status !== 'signedIn' || !settings.notificationsOn || backend.mode !== 'live') return;
    let live = true;
    registerForPush().then(async (result) => {
      if (!live) return;
      setPush(result);
      if ('token' in result) {
        pushToken.current = result.token;
        await backend.registerPushToken(result.token, Platform.OS === 'ios' ? 'ios' : 'android').catch(() => {});
      }
    });
    return () => {
      live = false;
    };
  }, [status, settings.notificationsOn]);

  const userById = useCallback((id: string) => (id === me.id ? me : people[id]), [me, people]);

  const sentTodayCents = useMemo(() => {
    const since = now - DAY_MS;
    return transactions
      .filter((t) => t.fromUser === me.id && t.status === 'completed')
      .filter((t) => new Date(t.completedAt ?? t.createdAt).getTime() > since)
      .reduce((s, t) => s + t.amountCents, 0);
  }, [transactions, me.id, now]);

  const applyTx = useCallback((tx: Transaction, balance: number) => {
    setTransactions((list) => [tx, ...list.filter((t) => t.id !== tx.id)].sort(byNewest));
    setBalance(balance);
  }, []);

  const rememberContact = useCallback((id: string, viaTap?: boolean) => {
    setContacts((list) => {
      const prev = list.find((c) => c.userId === id);
      return [
        { userId: id, lastTappedAt: new Date().toISOString(), viaTap: !!(viaTap || prev?.viaTap) },
        ...list.filter((c) => c.userId !== id),
      ];
    });
  }, []);

  const payRequest = useCallback(
    async (id: string) => {
      const { transaction, balanceCents: b } = await payments.payRequest(id);
      applyTx(transaction, b);
      rememberContact(transaction.toUser);
      return transaction;
    },
    [applyTx, rememberContact],
  );

  const submitDraft = useCallback(async (patch?: Partial<Draft>) => {
    const draft = draftState && { ...draftState, ...patch };
    if (!draft?.peerId) throw new Error('No one to pay yet');
    if (draft.requestId) return payRequest(draft.requestId);
    const input = { amountCents: draft.amountCents, note: draft.note };
    const { transaction, balanceCents: b } =
      draft.mode === 'send'
        ? await payments.send({ ...input, to: draft.peerId, ref: draft.ref })
        : await payments.request({ ...input, from: draft.peerId });
    applyTx({ ...transaction, privacy: draft.privacy }, b);
    rememberContact(draft.peerId, draft.viaTap);
    return transaction;
  }, [draftState, payRequest, applyTx, rememberContact]);

  const declineRequest = useCallback(
    async (id: string) => {
      const { transaction, balanceCents: b } = await payments.declineRequest(id);
      applyTx(transaction, b);
    },
    [applyTx],
  );

  const addMoney = useCallback(async (cents: number) => setBalance(await payments.addMoney(cents)), []);
  const cashOut = useCallback(async (cents: number) => setBalance(await payments.cashOut(cents)), []);

  const sendCode = useCallback((phone: string) => backend.sendCode(phone), []);

  const verifyCode = useCallback(
    async (phone: string, code: string) => {
      const uid = await backend.verifyCode(phone, code);
      await load(uid);
      return { needsProfile: !(await backend.getProfile(uid)) };
    },
    [load],
  );

  const completeSignUp = useCallback(
    async (profile: ProfileInput) => {
      const uid = userId ?? (await backend.currentUserId());
      if (!uid) throw new Error('Your session expired. Please verify your number again.');
      await backend.saveProfile(uid, profile);
      await load(uid);
    },
    [userId, load],
  );

  const updateProfile = useCallback(
    async (patch: { name: string; avatarUrl?: string | null }) => {
      const saved = await backend.saveProfile(me.id, { name: patch.name, handle: me.handle, avatarUri: patch.avatarUrl === undefined ? (me.avatarUrl ?? null) : patch.avatarUrl });
      setMe(saved);
    },
    [me],
  );

  const signOut = useCallback(async () => {
    // Stop pushes to this phone for the account that's leaving.
    if (pushToken.current) await backend.unregisterPushToken(pushToken.current).catch(() => {});
    pushToken.current = null;
    await backend.signOut();
    setUserId(null);
    setMe(EMPTY_USER);
    setTransactions([]);
    setContacts([]);
    setDraft(null);
    setStatus('signedOut');
  }, []);

  const updateSettings = useCallback(
    (patch: Partial<Settings>) => {
      setSettings((s) => ({ ...s, ...patch }));
      if (patch.biometricsOn !== undefined) storage.set(StorageKeys.biometrics, patch.biometricsOn ? '1' : '0');
      const remote = {
        notificationsOn: patch.notificationsOn,
        notifyPayments: patch.notifyPayments,
        notifyRequests: patch.notifyRequests,
      };
      if (userId && Object.values(remote).some((v) => v !== undefined)) {
        backend.saveSettings(userId, remote).catch(() => {});
      }
    },
    [userId],
  );

  const saveTheme = useCallback(
    (theme: ThemePreference) => {
      if (userId && status === 'signedIn') backend.saveSettings(userId, { theme }).catch(() => {});
    },
    [userId, status],
  );

  const lookupHandle = useCallback(
    async (handle: string) => {
      const u = await backend.lookupHandle(handle);
      if (u) addPeople([u]);
      return u;
    },
    [addPeople],
  );

  const tapCandidates = useCallback(async () => {
    const known = contacts.map((c) => people[c.userId]).filter((u): u is User => !!u);
    if (known.length) return known;
    const demo = await backend.demoPeople();
    addPeople(demo);
    return demo;
  }, [contacts, people, addPeople]);

  const value: AppState = {
    status,
    backendMode: backend.mode,
    me,
    balanceCents,
    transactions,
    contacts,
    draft,
    settings,
    incoming,
    sentTodayCents,
    userById,
    lookupHandle,
    handleAvailable: backend.handleAvailable,
    tapCandidates,
    addPeople,
    sendCode,
    verifyCode,
    completeSignUp,
    signOut,
    updateProfile,
    updateSettings,
    saveTheme,
    setDraft,
    submitDraft,
    payRequest,
    declineRequest,
    addMoney,
    cashOut,
    rememberContact,
    dismissIncoming: () => setIncoming(null),
    simulateIncomingPayment: (opts) => void backend.simulateIncoming('payment', opts).catch(() => haptics.error()),
    push,
    simulateIncomingRequest: () => void backend.simulateIncoming('request').catch(() => haptics.error()),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function byNewest(a: Transaction, b: Transaction) {
  return b.createdAt.localeCompare(a.createdAt);
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
