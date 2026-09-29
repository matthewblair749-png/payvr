import { CallSession } from '../../src/services/calls/session';
import { memorySignaling } from '../../src/services/calls/signaling';
import type { CallSnapshot, Signal } from '../../src/services/calls/types';

const results: Record<string, unknown> = {};
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function until(fn: () => boolean, ms = 10000) {
  const t0 = Date.now();
  while (!fn()) {
    if (Date.now() - t0 > ms) return false;
    await wait(50);
  }
  return true;
}

function pair(opts: { ringTimeoutMs?: number; kind?: 'audio' | 'video' } = {}) {
  const bus = memorySignaling();
  const kind = opts.kind ?? 'video';
  let a: CallSnapshot | null = null;
  let b: CallSnapshot | null = null;
  let callee: CallSession | null = null;
  const caller = new CallSession({
    signaling: bus, meId: 'alice', peerId: 'bob', callId: 'c' + Math.random(), kind, direction: 'outgoing',
    iceServers: [], onChange: (s) => (a = s), ringTimeoutMs: opts.ringTimeoutMs,
  });
  const pendingIce: Signal[] = [];
  bus.listen('alice', (s) => void caller.handle(s));
  bus.listen('bob', (s) => {
    if (s.t === 'invite') {
      callee = new CallSession({
        signaling: bus, meId: 'bob', peerId: 'alice', callId: s.callId, kind: s.kind, direction: 'incoming',
        offerSdp: s.sdp, iceServers: [], onChange: (x) => (b = x),
      });
      pendingIce.splice(0).forEach((x) => void callee!.handle(x));
    } else if (callee) void callee.handle(s);
    else pendingIce.push(s);
  });
  return { caller, get callee() { return callee; }, get a() { return a; }, get b() { return b; } };
}

(async () => {
  // 1. Video call connects both ways.
  const p = pair();
  await p.caller.start();
  results.inviteArrived = await until(() => !!p.callee && p.callee.snapshot().phase === 'incoming');
  results.callerRinging = p.a?.phase === 'outgoing';
  await p.callee!.accept();
  results.bothConnected = await until(() => p.a?.phase === 'connected' && p.b?.phase === 'connected');
  const ra = p.a?.remoteStream as MediaStream | null;
  const rb = p.b?.remoteStream as MediaStream | null;
  results.callerGetsVideoAndAudio = !!ra && ra.getVideoTracks().length === 1 && ra.getAudioTracks().length === 1;
  results.calleeGetsVideoAndAudio = !!rb && rb.getVideoTracks().length === 1 && rb.getAudioTracks().length === 1;
  // Frames actually flow: play the remote stream and check it has a size.
  const v = document.createElement('video');
  v.muted = true; v.srcObject = ra; document.body.appendChild(v); await v.play().catch(() => {});
  results.remoteVideoHasFrames = await until(() => v.videoWidth > 0, 8000);
  p.caller.setMuted(true);
  results.muteDisablesTrack = (p.a?.localStream as MediaStream).getAudioTracks().every((t) => !t.enabled);
  p.caller.setCameraOff(true);
  results.cameraOffDisablesTrack = (p.a?.localStream as MediaStream).getVideoTracks().every((t) => !t.enabled);
  p.caller.hangup();
  results.hangupEndsBoth = await until(() => p.b?.phase === 'ended');
  results.calleeSeesRemoteHangup = p.b?.endReason === 'remoteHangup';
  results.localTracksStopped = (p.a?.localStream as MediaStream).getTracks().every((t) => t.readyState === 'ended');

  // 2. Declined.
  const d = pair({ kind: 'audio' });
  await d.caller.start();
  await until(() => !!d.callee);
  d.callee!.decline();
  results.declineReachesCaller = await until(() => d.a?.phase === 'ended' && d.a?.endReason === 'declined');
  results.audioCallHasNoVideo = (d.a?.localStream as MediaStream).getVideoTracks().length === 0;

  // 3. Nobody answers.
  const n = pair({ ringTimeoutMs: 800 });
  await n.caller.start();
  results.noAnswerTimesOut = await until(() => n.a?.endReason === 'noAnswer', 3000);
  results.calleeSeesMissed = await until(() => n.b?.phase === 'ended' && n.b?.endReason === 'noAnswer', 3000);

  (window as unknown as { __results: unknown }).__results = results;
})().catch((e) => ((window as unknown as { __results: unknown }).__results = { error: String(e?.stack ?? e) }));
