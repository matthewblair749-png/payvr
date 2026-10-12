import type { Ack, ConnectAuth, ServerEvents } from "../protocol";

export type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "offline";

/** Why the server refused or ended the connection for good. */
export type FatalReason = "unauthorized" | "closed" | "removed";

/**
 * What the room UI needs from a realtime transport. The Socket.IO version is
 * in socketio-transport.ts; a managed service (Ably, Pusher...) would
 * implement the same interface.
 */
export interface RealtimeClient {
  on<E extends keyof ServerEvents>(event: E, handler: ServerEvents[E]): () => void;
  /** Sends an event and waits for the server's answer (or a timeout). */
  request<T>(event: string, payload: unknown, timeoutMs?: number): Promise<Ack<T> | { ok: false; error: "timeout" }>;
  /** Fire-and-forget, for things like typing indicators. */
  send(event: string, payload: unknown): void;
  onStatus(handler: (status: ConnectionStatus) => void): () => void;
  onFatal(handler: (reason: FatalReason) => void): () => void;
  close(): void;
}

export type ConnectFn = (url: string, auth: ConnectAuth) => RealtimeClient;
