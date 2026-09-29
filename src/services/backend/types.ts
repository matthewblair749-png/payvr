import type { Contact, Transaction, User } from '@/data/types';
import type { ThemePreference } from '@/theme/colors';

export type RemoteSettings = {
  theme: ThemePreference;
  notificationsOn: boolean;
  notifyPayments: boolean;
  notifyRequests: boolean;
};

export type Snapshot = {
  me: User;
  balanceCents: number;
  transactions: Transaction[];
  contacts: Contact[];
  /** Public profiles of everyone in `transactions` and `contacts`. */
  people: User[];
  settings: RemoteSettings;
};

/** Realtime changes pushed to this phone (Supabase Realtime in live mode). */
export type LiveEvent =
  | { type: 'transaction'; change: 'insert' | 'update'; tx: Transaction }
  | { type: 'balance'; balanceCents: number };

export type ProfileInput = { name: string; handle: string; avatarUri: string | null };

/** A 60-second tap session: its token is advertised over Bluetooth while the Tap screen is open. */
export type TapSession = { bleToken: string; expiresAt: string };

/** The phone on the other side of a tap, as resolved by the server. */
export type TapPeer = {
  user: User;
  mode: 'send' | 'request';
  amountCents: number;
  /** Their Nearby Interaction discovery token (UWB iPhones only). */
  niToken: string | null;
};

/**
 * Everything the app needs from a server, except moving money (see services/payments.ts).
 * Implemented by the in-memory mock and by Supabase.
 */
export interface Backend {
  mode: 'mock' | 'live';

  // Auth (phone number + SMS code)
  currentUserId(): Promise<string | null>;
  onSignedOut(cb: () => void): () => void;
  sendCode(phoneE164: string): Promise<void>;
  /** Returns the signed-in user's id. */
  verifyCode(phoneE164: string, code: string): Promise<string>;
  signOut(): Promise<void>;

  // Profiles
  getProfile(userId: string): Promise<User | null>;
  saveProfile(userId: string, input: ProfileInput): Promise<User>;
  handleAvailable(handle: string): Promise<boolean>;
  lookupHandle(handle: string): Promise<User | null>;
  getUsers(ids: string[]): Promise<User[]>;

  // Data
  loadSnapshot(userId: string): Promise<Snapshot>;
  saveSettings(userId: string, patch: Partial<RemoteSettings>): Promise<void>;
  subscribe(userId: string, onEvent: (e: LiveEvent) => void): () => void;

  // Tap sessions (Bluetooth / Nearby Interaction)
  startTapSession(input: { amountCents: number; mode: 'send' | 'request'; niToken: string | null }): Promise<TapSession>;
  /** Null when the token is unknown, expired, or the other phone left the Tap screen. */
  resolveTapToken(token: string): Promise<TapPeer | null>;
  endTapSession(): Promise<void>;

  // Push notifications
  registerPushToken(token: string, platform: 'ios' | 'android'): Promise<void>;
  unregisterPushToken(token: string): Promise<void>;

  // Prototype helpers
  /** Pretend another phone just paid you / requested from you. */
  simulateIncoming(
    kind: 'payment' | 'request',
    /** `from`: the demo friend who pays (mock only; defaults to Jake). */
    opts?: { amountCents?: number; note?: string; ref?: string; from?: string },
  ): Promise<void>;
  /** Demo people a single phone can "tap" before step 5 adds real Bluetooth. */
  demoPeople(): Promise<User[]>;
}

export class BackendError extends Error {}
