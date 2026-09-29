/**
 * WebRTC on the web: the browser's own implementation. (Phones use rtc.native.ts.)
 * Kept tiny so the engine can be bundled into a plain browser test page.
 */
type G = typeof globalThis & {
  RTCPeerConnection?: typeof RTCPeerConnection;
  RTCSessionDescription?: typeof RTCSessionDescription;
  RTCIceCandidate?: typeof RTCIceCandidate;
};
const g = globalThis as G;

export const rtc = {
  available: typeof g.RTCPeerConnection === 'function' && typeof navigator !== 'undefined' && !!navigator.mediaDevices,
  RTCPeerConnection: g.RTCPeerConnection as typeof RTCPeerConnection,
  RTCSessionDescription: g.RTCSessionDescription as typeof RTCSessionDescription,
  RTCIceCandidate: g.RTCIceCandidate as typeof RTCIceCandidate,
  getUserMedia: (c: MediaStreamConstraints) => navigator.mediaDevices.getUserMedia(c),
  /** Front/back camera switch isn't available in browsers. */
  switchCamera: (_track: MediaStreamTrack) => false,
};
