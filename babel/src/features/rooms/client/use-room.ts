"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import type { ReportReason } from "@/config/rooms";
import type { Ack, MessageView, ParticipantView, RoomStateView } from "../protocol";
import { connectSocketIO } from "./socketio-transport";
import { loadOutbox, saveOutbox, type Credentials, type OutboxItem } from "./storage";
import type { ConnectFn, ConnectionStatus, FatalReason, RealtimeClient } from "./transport";

export interface PendingMessage extends OutboxItem {
  state: "sending" | "waiting" | "failed";
  error?: string;
}

export interface RoomState {
  status: ConnectionStatus;
  fatal: FatalReason | null;
  room: RoomStateView["room"] | null;
  me: RoomStateView["me"] | null;
  participants: ParticipantView[];
  blocked: string[];
  messages: MessageView[];
  pending: PendingMessage[];
  /** participantId → when their typing indicator should disappear (ms). */
  typing: Record<string, number>;
  notice: string | null;
}

type Action =
  | { type: "status"; status: ConnectionStatus }
  | { type: "fatal"; reason: FatalReason }
  | { type: "state"; state: RoomStateView }
  | { type: "history"; messages: MessageView[] }
  | { type: "message"; message: MessageView }
  | { type: "presence"; participants: ParticipantView[] }
  | { type: "blocked"; blocked: string[] }
  | { type: "typing"; participantId: string; until: number | null }
  | { type: "expireTyping"; now: number }
  | { type: "notice"; message: string }
  | { type: "pending"; item: PendingMessage }
  | { type: "pendingUpdate"; clientId: string; patch: Partial<PendingMessage> }
  | { type: "pendingRemove"; clientId: string };

const TYPING_TIMEOUT_MS = 6_000;

/** Oldest first; the id breaks ties between messages sent in the same millisecond. */
function byTime(a: MessageView, b: MessageView) {
  return a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
}

function reducer(state: RoomState, action: Action): RoomState {
  switch (action.type) {
    case "status":
      return { ...state, status: action.status };
    case "fatal":
      return { ...state, fatal: action.reason };
    case "state":
      return { ...state, room: action.state.room, me: action.state.me, participants: action.state.participants, blocked: action.state.blocked };
    case "history": {
      // Keep anything newer that arrived live while history was loading.
      const ids = new Set(action.messages.map((m) => m.id));
      const extra = state.messages.filter((m) => !ids.has(m.id) && m.createdAt > (action.messages.at(-1)?.createdAt ?? ""));
      const sent = new Set(action.messages.map((m) => m.clientId));
      return { ...state, messages: [...action.messages, ...extra].sort(byTime), pending: state.pending.filter((p) => !sent.has(p.clientId)) };
    }
    case "message": {
      const others = state.messages.filter((m) => m.id !== action.message.id);
      const typing = { ...state.typing };
      delete typing[action.message.senderId];
      return {
        ...state,
        messages: [...others, action.message].sort(byTime),
        pending: state.pending.filter((p) => p.clientId !== action.message.clientId),
        typing,
      };
    }
    case "presence":
      return { ...state, participants: action.participants };
    case "blocked":
      return { ...state, blocked: action.blocked };
    case "typing": {
      const typing = { ...state.typing };
      if (action.until === null) delete typing[action.participantId];
      else typing[action.participantId] = action.until;
      return { ...state, typing };
    }
    case "expireTyping": {
      const entries = Object.entries(state.typing).filter(([, until]) => until > action.now);
      return entries.length === Object.keys(state.typing).length ? state : { ...state, typing: Object.fromEntries(entries) };
    }
    case "notice":
      return { ...state, notice: action.message };
    case "pending":
      return { ...state, pending: [...state.pending, action.item] };
    case "pendingUpdate":
      return { ...state, pending: state.pending.map((p) => (p.clientId === action.clientId ? { ...p, ...action.patch } : p)) };
    case "pendingRemove":
      return { ...state, pending: state.pending.filter((p) => p.clientId !== action.clientId) };
  }
}

function newClientId(): string {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Connects to a room and keeps its state. Messages written while offline
 * wait in an outbox (kept across reloads) and go out in order on reconnect;
 * the server ignores duplicates by clientId, so resending is always safe.
 */
export function useRoom(roomId: string, credentials: Credentials, realtimeUrl: string, connect: ConnectFn = connectSocketIO) {
  const [state, dispatch] = useReducer(reducer, undefined, (): RoomState => ({
    status: "connecting",
    fatal: null,
    room: null,
    me: null,
    participants: [],
    blocked: [],
    messages: [],
    pending: loadOutbox(roomId).map((item) => ({ ...item, state: "waiting" })),
    typing: {},
    notice: null,
  }));
  const clientRef = useRef<RealtimeClient | null>(null);
  const pendingRef = useRef(state.pending);
  useEffect(() => {
    pendingRef.current = state.pending;
  }, [state.pending]);
  const flushing = useRef(false);

  const deliver = useCallback(async (item: PendingMessage) => {
    const client = clientRef.current;
    if (!client) return;
    dispatch({ type: "pendingUpdate", clientId: item.clientId, patch: { state: "sending", error: undefined } });
    const result = await client.request<MessageView>("message:send", { clientId: item.clientId, text: item.text });
    if (result.ok) dispatch({ type: "message", message: result.data });
    else if (result.error === "timeout") dispatch({ type: "pendingUpdate", clientId: item.clientId, patch: { state: "waiting" } });
    else dispatch({ type: "pendingUpdate", clientId: item.clientId, patch: { state: "failed", error: result.error } });
  }, []);

  /** Sends everything still waiting, oldest first. */
  const flush = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    try {
      for (const item of pendingRef.current.filter((p) => p.state !== "failed")) await deliver(item);
    } finally {
      flushing.current = false;
    }
  }, [deliver]);

  useEffect(() => {
    const client = connect(realtimeUrl, { roomId, ...credentials });
    clientRef.current = client;
    const offs = [
      client.onStatus((status) => {
        dispatch({ type: "status", status });
        if (status === "connected") void flush();
      }),
      client.onFatal((reason) => dispatch({ type: "fatal", reason })),
      client.on("room:state", (s) => dispatch({ type: "state", state: s })),
      client.on("history", (messages) => dispatch({ type: "history", messages })),
      client.on("message", (message) => dispatch({ type: "message", message })),
      client.on("presence", (participants) => dispatch({ type: "presence", participants })),
      client.on("blocked", (blocked) => dispatch({ type: "blocked", blocked })),
      client.on("typing", ({ participantId, typing }) =>
        dispatch({ type: "typing", participantId, until: typing ? Date.now() + TYPING_TIMEOUT_MS : null }),
      ),
      client.on("notice", ({ message }) => dispatch({ type: "notice", message })),
      client.on("removed", () => dispatch({ type: "fatal", reason: "removed" })),
      client.on("room:closed", () => dispatch({ type: "fatal", reason: "closed" })),
    ];
    const timer = setInterval(() => dispatch({ type: "expireTyping", now: Date.now() }), 1_000);
    return () => {
      offs.forEach((off) => off());
      clearInterval(timer);
      client.close();
      clientRef.current = null;
    };
  }, [roomId, credentials, realtimeUrl, connect, flush]);

  // Keep the outbox on the device so a reload while offline loses nothing.
  useEffect(() => {
    saveOutbox(
      roomId,
      state.pending.filter((p) => p.state !== "failed").map(({ clientId, text, createdAt }) => ({ clientId, text, createdAt })),
    );
  }, [roomId, state.pending]);

  const send = useCallback(
    (text: string) => {
      const item: PendingMessage = {
        clientId: newClientId(),
        text,
        createdAt: new Date().toISOString(),
        state: state.status === "connected" ? "sending" : "waiting",
      };
      dispatch({ type: "pending", item });
      if (state.status === "connected") void deliver(item);
    },
    [deliver, state.status],
  );

  const retry = useCallback(
    (clientId: string) => {
      const item = pendingRef.current.find((p) => p.clientId === clientId);
      if (item) void deliver(item);
    },
    [deliver],
  );

  const discard = useCallback((clientId: string) => dispatch({ type: "pendingRemove", clientId }), []);

  // Typing: tell others at most every 3s while typing, and when we stop.
  const lastTypingSent = useRef(0);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setTyping = useCallback((typing: boolean) => {
    const client = clientRef.current;
    if (!client) return;
    if (stopTimer.current) clearTimeout(stopTimer.current);
    if (!typing) {
      lastTypingSent.current = 0;
      client.send("typing", { typing: false });
      return;
    }
    if (Date.now() - lastTypingSent.current > 3_000) {
      lastTypingSent.current = Date.now();
      client.send("typing", { typing: true });
    }
    stopTimer.current = setTimeout(() => {
      lastTypingSent.current = 0;
      client.send("typing", { typing: false });
    }, 3_000);
  }, []);

  const call = useCallback(async (event: string, payload: unknown): Promise<Ack> => {
    const client = clientRef.current;
    if (!client) return { ok: false, error: "Not connected." };
    const result = await client.request<undefined>(event, payload);
    if (!result.ok && result.error === "timeout") return { ok: false, error: "That took too long. Check your connection and try again." };
    return result;
  }, []);

  return {
    state,
    send,
    retry,
    discard,
    setTyping,
    block: (participantId: string) => call("block", { participantId }),
    unblock: (participantId: string) => call("unblock", { participantId }),
    report: (participantId: string, reason: ReportReason, messageId?: string) => call("report", { participantId, reason, messageId }),
    remove: (participantId: string) => call("remove", { participantId }),
    closeRoom: () => call("room:close", {}),
  };
}
