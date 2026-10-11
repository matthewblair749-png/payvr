import { io } from "socket.io-client";
import type { Ack, ConnectAuth, ServerEvents } from "../protocol";
import type { ConnectionStatus, FatalReason, RealtimeClient } from "./transport";

const FATAL = new Set<FatalReason>(["unauthorized", "closed", "removed"]);

/** Socket.IO implementation of RealtimeClient. Reconnects on its own with backoff. */
export function connectSocketIO(url: string, auth: ConnectAuth): RealtimeClient {
  const socket = io(url, {
    auth,
    transports: ["websocket", "polling"],
    reconnectionDelay: 500,
    reconnectionDelayMax: 8_000,
  });

  const statusHandlers = new Set<(s: ConnectionStatus) => void>();
  const fatalHandlers = new Set<(r: FatalReason) => void>();
  const setStatus = (s: ConnectionStatus) => statusHandlers.forEach((h) => h(s));

  socket.on("connect", () => setStatus("connected"));
  socket.on("disconnect", (reason) => {
    // "io server disconnect" means we were sent away on purpose; no retry.
    if (reason === "io server disconnect") return;
    setStatus(navigator.onLine ? "reconnecting" : "offline");
  });
  socket.io.on("reconnect_attempt", () => setStatus(navigator.onLine ? "reconnecting" : "offline"));
  socket.on("connect_error", (error) => {
    if (FATAL.has(error.message as FatalReason)) {
      socket.disconnect();
      fatalHandlers.forEach((h) => h(error.message as FatalReason));
      return;
    }
    setStatus(navigator.onLine ? "reconnecting" : "offline");
  });

  // The browser knows about lost connections long before a ping times out.
  const onOffline = () => setStatus("offline");
  const onOnline = () => {
    if (socket.connected) setStatus("connected");
    else {
      setStatus("reconnecting");
      socket.connect();
    }
  };
  window.addEventListener("offline", onOffline);
  window.addEventListener("online", onOnline);

  return {
    on(event, handler) {
      // Socket.IO's own typings are looser than ours; the protocol types are the contract.
      const listener = handler as (...args: unknown[]) => void;
      socket.on(event as string, listener);
      return () => void socket.off(event as string, listener);
    },
    request<T>(event: string, payload: unknown, timeoutMs = 10_000) {
      return new Promise<Ack<T> | { ok: false; error: "timeout" }>((resolve) => {
        socket.timeout(timeoutMs).emit(event, payload, (err: Error | null, result: Ack<T>) => {
          resolve(err ? { ok: false, error: "timeout" } : result);
        });
      });
    },
    send(event, payload) {
      if (socket.connected) socket.emit(event, payload);
    },
    onStatus(handler) {
      statusHandlers.add(handler);
      return () => void statusHandlers.delete(handler);
    },
    onFatal(handler) {
      fatalHandlers.add(handler);
      return () => void fatalHandlers.delete(handler);
    },
    close() {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
      socket.disconnect();
    },
  } satisfies RealtimeClient;
}

export type { ServerEvents };
