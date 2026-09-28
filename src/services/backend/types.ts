import type { Contact, Transaction, User } from '@/data/types';
import type { ThemePreference } from '@/theme/colors';

export type RemoteSettings = { theme: ThemePreference; notificationsOn: boolean };

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

  // Prototype helpers
  /** Pretend another phone just paid you / requested from you. */
  simulateIncoming(kind: 'payment' | 'request', opts?: { amountCents?: number; note?: string }): Promise<void>;
  /** Demo people a single phone can "tap" before step 5 adds real Bluetooth. */
  demoPeople(): Promise<User[]>;
}

export class BackendError extends Error {}
