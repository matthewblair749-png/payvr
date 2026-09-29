import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { DemoSession } from '@/services/calls/demo';
import { iceServers } from '@/services/calls/ice';
import { rtc } from '@/services/calls/rtc';
import { CallSession } from '@/services/calls/session';
import { supabaseSignaling } from '@/services/calls/signaling';
import type { CallKind, CallSnapshot, Signal, Signaling } from '@/services/calls/types';
import { supabase } from '@/services/supabase';
import { haptics } from '@/utils/haptics';

import { useApp } from './app-store';

type Session = CallSession | DemoSession;

type CallState = {
  call: CallSnapshot | null;
  /** Full-screen call UI showing (false while you step away, e.g. to pay them). */
  expanded: boolean;
  setExpanded: (v: boolean) => void;
  /** True when real calls can be made here (live backend + WebRTC available). */
  realCalls: boolean;
  startCall: (peerId: string, kind: CallKind) => void;
  accept: () => void;
  decline: () => void;
  hangup: () => void;
  setMuted: (m: boolean) => void;
  setCameraOff: (off: boolean) => void;
  flipCamera: () => boolean;
  /** Demo mode: a friend calls you. */
  simulateIncomingCall: (peerId: string, kind: CallKind) => void;
};

const Ctx = createContext<CallState | null>(null);
/** How long the "Call ended" screen stays up. */
const ENDED_MS = 1400;

const newCallId = () => `call_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { me, status, backendMode } = useApp();
  const [call, setCall] = useState<CallSnapshot | null>(null);
  const [expanded, setExpanded] = useState(false);
  const session = useRef<Session | null>(null);
  const signaling = useRef<Signaling | null>(null);
  const earlyIce = useRef<Map<string, Signal[]>>(new Map());
  const realCalls = backendMode === 'live' && !!supabase && rtc.available;

  const onChange = useCallback((s: CallSnapshot) => {
    setCall(s);
    if (s.phase === 'connected') haptics.success();
    if (s.phase === 'ended') {
      setTimeout(() => {
        if (session.current?.id === s.callId) session.current = null;
        setCall((c) => (c?.callId === s.callId ? null : c));
      }, ENDED_MS);
    }
  }, []);

  const open = useCallback(() => setExpanded(true), []);

  // Live: listen for calls addressed to you.
  useEffect(() => {
    if (!realCalls || status !== 'signedIn' || !me.id || !supabase) return;
    const sig = supabaseSignaling(supabase);
    signaling.current = sig;
    const stop = sig.listen(me.id, (s) => {
      const cur = session.current;
      if (s.t === 'invite') {
        if (cur && cur.snapshot().phase !== 'ended') {
          void sig.send({ t: 'busy', callId: s.callId, from: me.id, to: s.from });
          return;
        }
        const incoming = new CallSession({
          signaling: sig,
          meId: me.id,
          peerId: s.from,
          callId: s.callId,
          kind: s.kind,
          direction: 'incoming',
          offerSdp: s.sdp,
          iceServers: iceServers(),
          onChange,
        });
        session.current = incoming;
        // Candidates that raced ahead of the invite.
        for (const early of earlyIce.current.get(s.callId) ?? []) void incoming.handle(early);
        earlyIce.current.delete(s.callId);
        setCall(incoming.snapshot());
        open();
        return;
      }
      if (cur && cur.id === s.callId) void cur.handle(s);
      else if (s.t === 'ice') earlyIce.current.set(s.callId, [...(earlyIce.current.get(s.callId) ?? []), s]);
    });
    return () => {
      stop();
      signaling.current = null;
    };
  }, [realCalls, status, me.id, onChange, open]);

  // Incoming ring: a gentle buzz every 1.5s until answered.
  const ringing = call?.phase === 'incoming';
  useEffect(() => {
    if (!ringing) return;
    haptics.medium();
    const t = setInterval(() => haptics.medium(), 1500);
    return () => clearInterval(t);
  }, [ringing]);

  const busy = () => {
    const cur = session.current;
    return !!cur && cur.snapshot().phase !== 'ended';
  };

  const startCall = useCallback(
    (peerId: string, kind: CallKind) => {
      if (busy()) {
        open();
        return;
      }
      if (backendMode === 'live' && !realCalls) {
        Alert.alert('Calling isn’t available here', 'Calls need the Payvr app build (not Expo Go) and a connected account.');
        return;
      }
      haptics.medium();
      const callId = newCallId();
      const s: Session =
        realCalls && signaling.current
          ? new CallSession({
              signaling: signaling.current,
              meId: me.id,
              peerId,
              callId,
              kind,
              direction: 'outgoing',
              iceServers: iceServers(),
              onChange,
            })
          : new DemoSession({ callId, peerId, kind, direction: 'outgoing', onChange });
      session.current = s;
      setCall(s.snapshot());
      open();
      void s.start();
    },
    [backendMode, realCalls, me.id, onChange, open],
  );

  const simulateIncomingCall = useCallback(
    (peerId: string, kind: CallKind) => {
      if (busy()) return;
      const s = new DemoSession({ callId: newCallId(), peerId, kind, direction: 'incoming', onChange });
      session.current = s;
      setCall(s.snapshot());
      open();
    },
    [onChange, open],
  );

  const value: CallState = {
    call,
    expanded,
    setExpanded,
    realCalls,
    startCall,
    accept: () => void session.current?.accept(),
    decline: () => session.current?.decline(),
    hangup: () => session.current?.hangup(),
    setMuted: (m) => session.current?.setMuted(m),
    setCameraOff: (off) => session.current?.setCameraOff(off),
    flipCamera: () => session.current?.flipCamera() ?? false,
    simulateIncomingCall,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCall() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCall must be used inside CallProvider');
  return ctx;
}
