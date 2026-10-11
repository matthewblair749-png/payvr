/**
 * Per-room browser storage. Every access is wrapped: storage can be
 * unavailable (private windows, blocked site data) and the room must still work.
 */
export interface Credentials {
  participantId: string;
  token: string;
}

export interface OutboxItem {
  clientId: string;
  text: string;
  createdAt: string;
}

const key = (roomId: string, what: "creds" | "outbox") => `babel:room:${roomId}:${what}`;

function read<T>(k: string): T | null {
  try {
    const raw = window.localStorage.getItem(k);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(k: string, value: unknown): void {
  try {
    if (value === null) window.localStorage.removeItem(k);
    else window.localStorage.setItem(k, JSON.stringify(value));
  } catch {
    // Not fatal: we just won't remember across reloads.
  }
}

export const loadCredentials = (roomId: string) => {
  const c = read<Credentials>(key(roomId, "creds"));
  return c && typeof c.participantId === "string" && typeof c.token === "string" ? c : null;
};
export const saveCredentials = (roomId: string, creds: Credentials | null) => write(key(roomId, "creds"), creds);

export const loadOutbox = (roomId: string) => {
  const items = read<OutboxItem[]>(key(roomId, "outbox"));
  return Array.isArray(items) ? items.filter((i) => typeof i?.clientId === "string" && typeof i?.text === "string") : [];
};
export const saveOutbox = (roomId: string, items: OutboxItem[]) => write(key(roomId, "outbox"), items.length ? items : null);
