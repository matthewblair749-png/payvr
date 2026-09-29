/** 1:1 voice and video calls. See docs/CALLS.md. */

export type CallKind = 'audio' | 'video';

export type CallPhase =
  /** You're calling them; their phone is ringing (or about to). */
  | 'outgoing'
  /** They're calling you. */
  | 'incoming'
  /** Answered; audio/video is connecting. */
  | 'connecting'
  | 'connected'
  | 'ended';

export type EndReason = 'hangup' | 'remoteHangup' | 'declined' | 'noAnswer' | 'busy' | 'failed' | 'permission';

/** Messages the two phones exchange to set up a call (never the audio/video itself). */
export type Signal =
  | { t: 'invite'; callId: string; from: string; to: string; kind: CallKind; sdp: string }
  | { t: 'answer'; callId: string; from: string; to: string; sdp: string }
  | { t: 'ice'; callId: string; from: string; to: string; candidate: IceCandidate }
  | { t: 'decline' | 'hangup' | 'busy'; callId: string; from: string; to: string };

export type IceCandidate = { candidate: string; sdpMid?: string | null; sdpMLineIndex?: number | null };

/** Delivers signals between phones. Live: Supabase Realtime. Tests: an in-memory bus. */
export interface Signaling {
  send(signal: Signal): Promise<void>;
  /** Signals addressed to `userId`. Returns an unsubscribe function. */
  listen(userId: string, onSignal: (signal: Signal) => void): () => void;
}

/** What the call screen renders. Streams are platform objects (MediaStream). */
export type CallSnapshot = {
  callId: string;
  peerId: string;
  kind: CallKind;
  direction: 'outgoing' | 'incoming';
  phase: CallPhase;
  endReason: EndReason | null;
  connectedAt: number | null;
  muted: boolean;
  cameraOff: boolean;
  /** True for simulated calls (demo mode): nobody is really on the line. */
  demo: boolean;
  localStream: unknown | null;
  remoteStream: unknown | null;
};

export const RING_TIMEOUT_MS = 30_000;
