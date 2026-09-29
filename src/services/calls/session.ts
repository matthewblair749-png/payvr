/**
 * One 1:1 call over WebRTC. The caller sends an offer inside the invite; the callee answers
 * when they accept. Connection candidates ("ice") trickle both ways and are held until the
 * other side's description is in place. Audio/video flows phone-to-phone, encrypted by WebRTC
 * (DTLS-SRTP); the signaling channel only carries setup messages.
 */
import { rtc } from './rtc';
import { RING_TIMEOUT_MS, type CallKind, type CallPhase, type CallSnapshot, type EndReason, type IceCandidate, type Signal, type Signaling } from './types';

/** Omit that keeps each member of a union separate. */
type SignalBody = Signal extends infer S ? (S extends Signal ? Omit<S, 'callId' | 'from' | 'to'> : never) : never;

export type SessionOptions = {
  signaling: Signaling;
  meId: string;
  peerId: string;
  callId: string;
  kind: CallKind;
  direction: 'outgoing' | 'incoming';
  /** For incoming calls: the caller's offer from the invite. */
  offerSdp?: string;
  iceServers: RTCIceServer[];
  onChange: (s: CallSnapshot) => void;
  ringTimeoutMs?: number;
};

export class CallSession {
  private pc: RTCPeerConnection | null = null;
  private local: MediaStream | null = null;
  private remote: MediaStream | null = null;
  private pendingIce: IceCandidate[] = [];
  private remoteSet = false;
  private ringTimer: ReturnType<typeof setTimeout> | null = null;
  private phase: CallPhase;
  private endReason: EndReason | null = null;
  private connectedAt: number | null = null;
  private muted = false;
  private cameraOff = false;

  constructor(private o: SessionOptions) {
    this.phase = o.direction;
  }

  get id() {
    return this.o.callId;
  }

  snapshot(): CallSnapshot {
    return {
      callId: this.o.callId,
      peerId: this.o.peerId,
      kind: this.o.kind,
      direction: this.o.direction,
      phase: this.phase,
      endReason: this.endReason,
      connectedAt: this.connectedAt,
      muted: this.muted,
      cameraOff: this.cameraOff,
      demo: false,
      localStream: this.local,
      remoteStream: this.remote,
    };
  }

  private emit() {
    this.o.onChange(this.snapshot());
  }

  private send(s: SignalBody) {
    return this.o.signaling
      .send({ ...s, callId: this.o.callId, from: this.o.meId, to: this.o.peerId } as Signal)
      .catch(() => {});
  }

  private async openMedia() {
    this.local = await rtc.getUserMedia({
      audio: true,
      video: this.o.kind === 'video' ? { facingMode: 'user' } : false,
    });
  }

  private createPeer() {
    const pc = new rtc.RTCPeerConnection({ iceServers: this.o.iceServers });
    this.pc = pc;
    for (const track of this.local?.getTracks() ?? []) pc.addTrack(track, this.local!);
    pc.addEventListener('icecandidate', (e: RTCPeerConnectionIceEvent) => {
      if (!e.candidate) return;
      const c = e.candidate;
      this.send({ t: 'ice', candidate: { candidate: c.candidate, sdpMid: c.sdpMid, sdpMLineIndex: c.sdpMLineIndex } });
    });
    pc.addEventListener('track', (e: RTCTrackEvent) => {
      this.remote = e.streams[0] ?? this.remote;
      this.emit();
    });
    pc.addEventListener('connectionstatechange', () => {
      const st = pc.connectionState;
      if (st === 'connected' && this.phase !== 'connected') {
        this.phase = 'connected';
        this.connectedAt = Date.now();
        this.emit();
      } else if (st === 'failed') {
        this.end('failed', true);
      }
    });
    return pc;
  }

  private async applyPendingIce() {
    const list = this.pendingIce;
    this.pendingIce = [];
    for (const c of list) await this.pc?.addIceCandidate(new rtc.RTCIceCandidate(c)).catch(() => {});
  }

  /** Caller: open the camera/mic, make an offer and ring the other phone. */
  async start() {
    try {
      await this.openMedia();
    } catch {
      return this.end('permission', false);
    }
    this.emit();
    const pc = this.createPeer();
    const offer = await pc.createOffer({});
    await pc.setLocalDescription(offer);
    await this.send({ t: 'invite', kind: this.o.kind, sdp: offer.sdp ?? '' });
    this.ringTimer = setTimeout(() => {
      if (this.phase === 'outgoing') this.end('noAnswer', true);
    }, this.o.ringTimeoutMs ?? RING_TIMEOUT_MS);
  }

  /** Callee: pick up. */
  async accept() {
    if (this.phase !== 'incoming') return;
    this.phase = 'connecting';
    this.emit();
    try {
      await this.openMedia();
    } catch {
      return this.end('permission', true);
    }
    const pc = this.createPeer();
    await pc.setRemoteDescription(new rtc.RTCSessionDescription({ type: 'offer', sdp: this.o.offerSdp ?? '' }));
    this.remoteSet = true;
    await this.applyPendingIce();
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await this.send({ t: 'answer', sdp: answer.sdp ?? '' });
    this.emit();
  }

  decline() {
    if (this.phase === 'incoming') this.end('declined', true);
  }

  hangup() {
    this.end('hangup', true);
  }

  /** A signal for this call from the other phone. */
  async handle(s: Signal) {
    if (s.callId !== this.o.callId || this.phase === 'ended') return;
    switch (s.t) {
      case 'answer':
        if (this.o.direction !== 'outgoing' || !this.pc) return;
        this.clearRing();
        this.phase = 'connecting';
        this.emit();
        await this.pc.setRemoteDescription(new rtc.RTCSessionDescription({ type: 'answer', sdp: s.sdp }));
        this.remoteSet = true;
        await this.applyPendingIce();
        return;
      case 'ice':
        if (this.remoteSet && this.pc) await this.pc.addIceCandidate(new rtc.RTCIceCandidate(s.candidate)).catch(() => {});
        else this.pendingIce.push(s.candidate);
        return;
      case 'decline':
        return this.end('declined', false);
      case 'busy':
        return this.end('busy', false);
      case 'hangup':
        return this.end(this.phase === 'incoming' ? 'noAnswer' : 'remoteHangup', false);
    }
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    this.local?.getAudioTracks().forEach((t) => (t.enabled = !muted));
    this.emit();
  }

  setCameraOff(off: boolean) {
    this.cameraOff = off;
    this.local?.getVideoTracks().forEach((t) => (t.enabled = !off));
    this.emit();
  }

  /** Front ↔ back camera (phones only). */
  flipCamera() {
    const track = this.local?.getVideoTracks()[0];
    return track ? rtc.switchCamera(track) : false;
  }

  private clearRing() {
    if (this.ringTimer) clearTimeout(this.ringTimer);
    this.ringTimer = null;
  }

  private end(reason: EndReason, notify: boolean) {
    if (this.phase === 'ended') return;
    this.clearRing();
    if (notify) {
      this.send({ t: reason === 'declined' ? 'decline' : 'hangup' });
    }
    this.phase = 'ended';
    this.endReason = reason;
    this.local?.getTracks().forEach((t) => t.stop());
    this.pc?.close();
    this.pc = null;
    this.emit();
  }
}
