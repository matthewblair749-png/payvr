/** Mirrors the planned Supabase schema (users, transactions, contacts…), camelCased for the app. */
export type User = {
  id: string;
  name: string;
  handle: string;
  phone?: string;
  avatarUrl?: string | null;
};

export type TransactionType = 'send' | 'request';
export type TransactionStatus = 'pending' | 'completed' | 'declined';

/**
 * Money always flows fromUser -> toUser.
 * For a request, toUser is the requester and fromUser is who is being asked to pay.
 */
export type Transaction = {
  id: string;
  fromUser: string;
  toUser: string;
  amountCents: number;
  note: string;
  type: TransactionType;
  status: TransactionStatus;
  createdAt: string;
  /** When the money actually moved (payments, and requests once paid). */
  completedAt?: string | null;
  /** Set when the payment was made for a specific request QR code. */
  ref?: string | null;
  /** Feed visibility chosen when paying. */
  privacy?: Privacy;
};

export type Contact = {
  userId: string;
  lastTappedAt: string;
  /** Met in person with a phone tap (a trusted-contact signal), not just paid remotely or by QR. */
  viaTap?: boolean;
};

/** Who can see a payment in the feed. Amounts are never shown to friends. */
export type Privacy = 'public' | 'friends' | 'private';

export type TapMode = 'send' | 'request';

/** The payment being put together across Amount -> Tap -> Confirm -> Success. */
export type Draft = {
  mode: TapMode;
  amountCents: number;
  note: string;
  /** Set once a nearby phone is found (or preset for a remote payment from a profile). */
  peerId?: string;
  /** Set when the draft is paying an incoming request. */
  requestId?: string;
  /** Set when the draft came from scanning someone's request QR code. */
  origin?: 'qrRequest';
  /** The request code's ref, sent with the payment so the requester's phone can match it. */
  ref?: string;
  /** Feed visibility for this payment. */
  privacy?: Privacy;
  /** True when the person was found by tapping phones. */
  viaTap?: boolean;
  /** Set when paying your share of a bill split in a group chat. */
  chatSplit?: { chatId: string; splitId: string };
};
