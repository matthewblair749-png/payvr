/**
 * WebRTC on iOS/Android via react-native-webrtc (needs a development build; it isn't in Expo Go).
 * If the native module is missing, `available` is false and the app falls back to demo calls.
 */
type Rtc = {
  available: boolean;
  RTCPeerConnection: typeof RTCPeerConnection;
  RTCSessionDescription: typeof RTCSessionDescription;
  RTCIceCandidate: typeof RTCIceCandidate;
  getUserMedia: (c: MediaStreamConstraints) => Promise<MediaStream>;
  switchCamera: (track: MediaStreamTrack) => boolean;
};

function load(): Rtc {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const w = require('react-native-webrtc');
    return {
      available: true,
      RTCPeerConnection: w.RTCPeerConnection,
      RTCSessionDescription: w.RTCSessionDescription,
      RTCIceCandidate: w.RTCIceCandidate,
      getUserMedia: (c) => w.mediaDevices.getUserMedia(c),
      switchCamera: (track) => {
        // react-native-webrtc flips between front and back cameras on the video track.
        const t = track as MediaStreamTrack & { _switchCamera?: () => void };
        if (!t._switchCamera) return false;
        t._switchCamera();
        return true;
      },
    };
  } catch {
    const missing = () => {
      throw new Error('Calling needs the Payvr app build (not Expo Go).');
    };
    return {
      available: false,
      RTCPeerConnection: missing as never,
      RTCSessionDescription: missing as never,
      RTCIceCandidate: missing as never,
      getUserMedia: missing as never,
      switchCamera: () => false,
    };
  }
}

export const rtc = load();
