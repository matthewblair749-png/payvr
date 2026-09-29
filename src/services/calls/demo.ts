/**
 * Simulated call for demo mode: the friend "picks up" after a moment and nobody is really on
 * the line. Your own camera still turns on for video calls when the device allows it, so the
 * self-view is real.
 */
import { rtc } from './rtc';
import type { CallKind, CallPhase, CallSnapshot, EndReason } from './types';

export class DemoSession {
  private phase: CallPhase;
  private endReason: EndReason | null = null;
  private connectedAt: number | null = null;
  private muted = false;
  private cameraOff = false;
  private local: MediaStream | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private o: {
      callId: string;
      peerId: string;
      kind: CallKind;
      direction: 'outgoing' | 'incoming';
      onChange: (s: CallSnapshot) => void;
      answerAfterMs?: number;
    },
  ) {
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
      demo: true,
      localStream: this.local,
      remoteStream: null,
    };
  }

  private emit() {
    this.o.onChange(this.snapshot());
  }

  private async camera() {
    if (this.o.kind !== 'video' || !rtc.available) return;
    try {
      this.local = await rtc.getUserMedia({ audio: false, video: { facingMode: 'user' } });
      this.emit();
    } catch {
      // No camera (or permission denied): the self-view shows your avatar instead.
    }
  }

  private connect() {
    this.phase = 'connected';
    this.connectedAt = Date.now();
    this.emit();
  }

  async start() {
    this.emit();
    void this.camera();
    this.timer = setTimeout(() => this.connect(), this.o.answerAfterMs ?? 2600);
  }

  async accept() {
    if (this.phase !== 'incoming') return;
    this.phase = 'connecting';
    this.emit();
    await this.camera();
    this.timer = setTimeout(() => this.connect(), 600);
  }

  decline() {
    if (this.phase === 'incoming') this.end('declined');
  }

  hangup() {
    this.end('hangup');
  }

  async handle() {}

  setMuted(muted: boolean) {
    this.muted = muted;
    this.emit();
  }

  setCameraOff(off: boolean) {
    this.cameraOff = off;
    this.local?.getVideoTracks().forEach((t) => (t.enabled = !off));
    this.emit();
  }

  flipCamera() {
    const track = this.local?.getVideoTracks()[0];
    return track ? rtc.switchCamera(track) : false;
  }

  private end(reason: EndReason) {
    if (this.phase === 'ended') return;
    if (this.timer) clearTimeout(this.timer);
    this.phase = 'ended';
    this.endReason = reason;
    this.local?.getTracks().forEach((t) => t.stop());
    this.emit();
  }
}
