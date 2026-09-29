/**
 * Servers that help two phones find a network path to each other.
 * STUN (public, free) works on most home and office networks. Phones on strict mobile or
 * corporate networks also need a TURN relay (EXPO_PUBLIC_TURN_URL / _USERNAME / _CREDENTIAL);
 * in production, hand out short-lived TURN credentials from a server instead (docs/CALLS.md).
 */
export function iceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
  const turn = process.env.EXPO_PUBLIC_TURN_URL;
  if (turn) {
    servers.push({
      urls: turn,
      username: process.env.EXPO_PUBLIC_TURN_USERNAME,
      credential: process.env.EXPO_PUBLIC_TURN_CREDENTIAL,
    });
  }
  return servers;
}
