# Voice and video calls

These are 1:1 calls between Payvr users. You can start one from anyone's profile using the phone or camera button at the top right.

The call screen shows:
- A ringing animation while it connects, then the call timer.
- **Mute**, **Camera** on/off, **Flip** (front/back camera, phones only) and **End**.
- **Pay**, which opens the payment screen for the person you're talking to.

While you're paying, the call shrinks to a bubble on the right edge; tap it to go back. An incoming call shows a full-screen **Accept** / **Decline** prompt.

## How it works

- **Media:** WebRTC, peer to peer.
  - Audio and video go directly between the two phones and are encrypted by WebRTC (DTLS-SRTP).
  - Phones use `react-native-webrtc`; browsers use their built-in WebRTC.
- **Code:**
  - `src/services/calls/session.ts`: the call logic, platform-neutral.
  - `rtc.ts` / `rtc.native.ts`: the platform WebRTC layer.
  - `components/call-video*.tsx`: video rendering.
- **Signaling (setting up the call):**
  - Supabase Realtime broadcast on a channel per person (`calls:<user id>`), in `signaling.ts`.
  - The caller sends an invite carrying its offer; the callee's answer comes back; connection candidates trickle both ways.
  - Signaling never carries audio or video.
- **Rules:**
  - A second incoming call while you're on one gets "busy".
  - An unanswered call stops ringing after 30 seconds and shows as "No answer".
- **Demo mode (no backend):**
  - Calls are simulated: the friend picks up after a moment, and nobody is really on the line.
  - The screen says "Demo call · no one is on the line".
  - Your own camera is real in video calls.
  - Profile → Prototype can simulate incoming calls.

## Testing

`npm run test:calls` runs the real call engine in Chromium with a fake camera and microphone. Two sessions call each other and the test checks that:
- The call connects and video frames arrive both ways.
- Mute and camera-off disable the right tracks.
- Hanging up ends the call on both sides and stops the camera and mic.
- Declining reaches the caller.
- An unanswered call times out as "No answer" on both sides.

It needs Bun and Playwright.

## Not verified yet

- **Real phones:** `react-native-webrtc` needs a development build (`eas build --profile development`); it isn't in Expo Go.
  - Its config plugin's compatibility table stops at Expo SDK 56, and this app is on 57.
  - `expo prebuild` runs cleanly with it and sets the camera and microphone permission text. Nothing has been compiled or run on a device.
- **Calls between two real accounts:** these need a hosted Supabase project with Realtime. The local test backend has no Realtime.

## Before real users

1. **Lock down signaling.**
   - Make `calls:*` private channels with Realtime Authorization.
   - Only the owner may listen on `calls:<their id>`.
   - Senders must be authenticated, and the server must check that `payload.from = auth.uid()`, so nobody can call while pretending to be someone else.
2. **Add a TURN relay.** Public STUN works on most home and office Wi-Fi. Strict mobile or corporate networks need a TURN relay.
   - The prototype reads `EXPO_PUBLIC_TURN_URL`, `EXPO_PUBLIC_TURN_USERNAME` and `EXPO_PUBLIC_TURN_CREDENTIAL`.
   - Anything in `EXPO_PUBLIC_*` ships inside the app, so production should hand out short-lived TURN credentials from an Edge Function instead.
3. **Ring phones that are asleep.** Today, incoming calls only ring while Payvr is open.
   - iOS needs CallKit with VoIP push (PushKit).
   - Android needs a high-priority notification with a full-screen intent, or ConnectionService.
4. **Route audio properly.** Speaker vs. earpiece and Bluetooth headsets need an audio-session module such as `react-native-incall-manager`. Until then there's no speaker button.
5. **Record call history.** Missed-call notices and a calls list would need a `calls` table.
6. **Group calls.** WebRTC peer to peer is fine for 1:1. Group calls need a media server (an SFU such as LiveKit).
