# Tap to pay: Bluetooth and Nearby Interaction

## How a tap works

1. **Open a session.** Both people open the Tap screen. Each phone asks the server for a
   **60-second tap session** and gets a random 96-bit token (`start_tap_session`).
2. **Advertise.** Each phone advertises its token over **Bluetooth LE**. The token is
   built into a 128-bit service UUID, `50415956-xxxx-…` ("PAYV" + token), because iOS
   only lets foreground apps advertise service UUIDs.
3. **Scan.** Each phone also scans (react-native-ble-plx) and tracks the signal strength
   of every Payvr token it hears.
4. **Pick the touching phone.** `ProximityTracker` picks a phone only when its smoothed
   signal is very strong (median of recent readings ≥ −52 dBm) and at least 6 dB stronger
   than any other phone. This stops two nearby phones from both "winning".
5. **Ask the server who it is.** The phone calls `resolve_tap_token`. The server only
   answers while **both** phones have an open session. Someone who just overhears the
   Bluetooth token gets nothing.
6. **Confirm the distance (UWB iPhones).** If both phones are iPhone 11 or later, they
   swap Nearby Interaction tokens through that server call and measure the real distance.
   - 20 cm or less: accepted.
   - Clearly more than 35 cm: rejected, even with a strong signal.
   - No reading within 2.5 s: falls back to Bluetooth.
7. **Show them.** The person's card slides up with a haptic. It shows how they were found
   ("8 cm away · Ultra Wideband" or "Right next to you · Bluetooth") and what their phone
   is doing, for example "Jake is requesting $20" or a warning if the amounts differ.
   Paying still needs Face ID or your PIN.

Leaving the Tap screen stops scanning and advertising and ends the session on the server.
Sessions also expire after 60 seconds.

## Code map

| File | What it does |
| --- | --- |
| `modules/payvr-nearby/` | Local Expo native module. iOS (Swift): BLE advertising (CoreBluetooth) + Nearby Interaction. Android (Kotlin): BLE advertising. |
| `src/services/tap/radio.ts` | Bluetooth permissions and state, scanning (ble-plx), native module handle. `radio.web.ts` = "unsupported". |
| `src/services/tap/live-tap.ts` | The tap flow above. Radios and backend are injected so it can be unit-tested. |
| `src/services/tap/proximity.ts` | Signal-strength and UWB decisions. Tune `PROXIMITY` here. |
| `src/services/tap/ble-token.ts` | Token ↔ UUID encoding. |
| `src/services/nearby.ts` | Picks live tapping (Supabase configured) or the mock. |
| `supabase/migrations/20260929090000_tap_nearby_interaction.sql` | `ni_token` on tap sessions; resolve returns it. |

## Building (Expo Go can't do this)

Bluetooth advertising and Nearby Interaction need native code, so use a **development
build**:

```bash
npx expo run:ios --device       # or: npx eas-cli@latest build --profile development --platform ios
npx expo run:android --device   # or: npx eas-cli@latest build --profile development --platform android
```

Bluetooth doesn't work in the iOS Simulator or most Android emulators. You need two real
phones. In Expo Go or on the web, the Tap screen says "Tap isn't available here" and offers
the QR code, plus a "Prototype: simulate a tap" button.

## Testing with two phones

1. Both phones: sign in (Supabase configured, see `docs/SUPABASE.md`) with different numbers.
2. Phone A: Send $5 → Ready to tap. Phone B: Request $5 → Ready to tap.
3. Hold the phones back to back. Both should show the other person within a second or two,
   with "Jake is requesting $5" on phone A.
4. Phone A: Continue → Send → Face ID. Phone B gets "… paid you $5" instantly.
5. Try it from across a table. Nothing should be found.
6. Two iPhone 11+: the card should say "N cm away · Ultra Wideband".

If taps trigger too easily or not at all, tune `PROXIMITY.closeRssi` in
`src/services/tap/proximity.ts`. Signal strength varies by phone model and case.

## Status

- The tap flow logic is unit-tested with simulated phones (`npm test`), and the
  database side is covered by `npm run test:db`.
- **The Swift and Kotlin code has not been compiled or run yet.** This environment has no
  Xcode or Android SDK. Expect to fix small build issues on the first `expo run:ios` /
  `run:android`, and to tune the signal threshold on real hardware.
