# payvr

**Tap phones. Money's sent.**

Payvr lets people send money by tapping two phones together. This repo is a working
**prototype that uses test money only**. No real money moves.

Expo SDK 57 · React Native · TypeScript · Expo Router · Reanimated

## Run it

```bash
npm install
npx expo start            # press i / a for a simulator, or w for web
```

With no configuration the app runs on built-in **mock data**. To use a real backend,
follow [docs/SUPABASE.md](docs/SUPABASE.md) (create a project, run one SQL file, add
two keys to `.env`).

Expo Go works for everything except Bluetooth tapping. Tapping needs a development build
(`npx expo run:ios --device` / `npx expo run:android --device`) because of the
native module in `modules/payvr-nearby`. See [docs/TAP.md](docs/TAP.md). Bluetooth tap-to-pay (build step 5) will need a
development build (`npx expo run:ios` / `eas build --profile development`).

**Prototype PIN:** `1234`, unless you created your own PIN during sign-up. On web and on
simulators without biometrics, every payment asks for your PIN. On devices with Face ID or
a fingerprint, it asks for that first.

## Build status

| Step | What | Status |
| --- | --- | --- |
| 1 | Setup, theme (dark / light / system), Space Grotesk, colors, logo SVG, tabs | Done |
| 2 | Every screen with mock data, full flow clickable | Done |
| 3 | Supabase auth, tables, RLS, realtime, avatars | Done ([setup](docs/SUPABASE.md)) |
| 4 | QR send / request | Done (see "QR codes" below) |
| 5 | Bluetooth LE + Nearby Interaction (UWB) | Built ([how it works](docs/TAP.md)); needs a dev build + two phones to test |
| 6 | Stripe test mode: add money (PaymentSheet) + cash out (Connect) | Built ([setup](docs/STRIPE.md)) |
| 7 | Push notifications, polish, accessibility | Done ([push setup](docs/PUSH.md)) |

## Where things live

```
src/
  app/                  Expo Router screens
    (auth)/             phone → code → profile → Face ID → PIN → welcome
    (tabs)/             home, feed, wallet, profile (+ raised Tap button in the tab bar)
    amount, people, tap, confirm, success, request/[id], qr, person/[id], feed/[id],
    transaction/[id], money/[action], settings/*, legal/[doc]
  components/           UI kit: logo (SVG), icons (SVG), buttons, keypad, pulse rings, check draw…
  theme/                colors (both palettes), typography, theme provider (200ms fade)
  services/
    payments.ts         ALL money movement: Supabase RPCs, Stripe add money / cash out, or the mock
    stripe/             Stripe config + PaymentSheet (test keys only)
    backend/            auth, profiles, data, realtime: live.ts (Supabase) and mock.ts
    supabase.ts         Supabase client (sessions stored in expo-secure-store)
    nearby.ts           Tap discovery: live Bluetooth/UWB (tap/) or mock
    tap/                Bluetooth scanning, proximity decisions, token encoding
    qr.ts               QR code format
    push.ts             Push registration + opening notifications
    biometrics.ts       Face ID / fingerprint
    storage.ts          expo-secure-store (localStorage on web)
  store/                App state, authorize() = Face ID or PIN before payments
  data/                 Types (mirror the Supabase schema) and mock seed data
modules/
  payvr-nearby/         Native module: BLE advertising (iOS + Android), Nearby Interaction (iOS)
supabase/
  migrations/           Tables, row-level security, money functions, realtime, storage
  functions/            Edge Functions (Deno): stripe-topup, -cashout, -connect, -webhook, -return, push-send
  seed.sql              Demo people and "simulate" helpers (dev projects only)
  tests/                SQL tests: npm run test:db
```

## Checks

```bash
npm run typecheck
npm run lint
npm test            # QR format, tap token, proximity and tap-flow unit tests
npm run test:db     # needs Postgres 15+ binaries installed locally
npm run test:functions  # needs Deno
```

## QR codes

QR is the fallback for phones without Bluetooth tap, and the easiest way to test with two
phones. Codes are plain deep links, so the phone's own camera app opens them in Payvr.

| Code | Payload | When it shows |
| --- | --- | --- |
| My code | `payvr://u/<handle>` | QR screen → My code (or the QR button on Home) |
| Request | `payvr://u/<handle>?amt=2000&note=Pizza&exp=…` | Request an amount → Tap → "Show QR code instead" |

- **Scanning a request code** opens "Pay $20 to Jake?" and needs Face ID or your PIN.
  The requester's screen jumps to "Jake paid you $20" the moment the money lands (realtime).
- **Scanning "My code"** while you're sending or requesting fills in the person. Otherwise
  it opens the Amount screen for them.
- **Request codes expire** after 2 minutes and the showing phone refreshes them every
  minute, so screenshots stop working.
- **Nothing in a code is trusted.** The handle is looked up on the server and you always see
  the real name and photo before paying. Malformed codes are rejected.
- **Scanner extras:** flashlight, "Choose from photos" (good for testing with a
  screenshot), and a button to open Settings if camera access was denied.
- The format lives in `src/services/qr.ts`; tests run with `npm test`.

## Prototype helpers

- **Profile → Prototype** has buttons to simulate "Jake pays you $20" (realtime banner +
  balance count-up) and an incoming request. With Supabase they call the helpers in
  `supabase/seed.sql`.
- The daily limit is a rolling 24 hours: $500 across payments and paid requests.
- In mock mode the Tap screen "finds" one of your contacts after ~3.5s
  (`MOCK_DISCOVERY_MS`). With Supabase it uses real Bluetooth. Where that isn't
  available, it offers QR and a "simulate a tap" button. Sessions expire after 60s with a
  retry message.
- QR → Scan has buttons to "scan" Jake's code or Jake's $12 request, and a request
  code has "Jake pays this code", so one device (or the web preview) can walk every QR flow.

## Accessibility

- **Contrast:** every text/background pairing is checked against WCAG AA in both themes
  by `src/theme/__tests__/contrast.test.ts`, which runs with `npm test`. Two colors were
  deepened slightly from the spec to pass:
  - small green text in light mode: `#15803D`
  - light-mode red: `#D82424` (the spec's `#DC2626` is 4.47:1 on cards; the minimum is 4.5)
- **Tap targets:** every button, link, tab and switch is at least 44×44 (checked on every
  screen). Settings switches use the whole row as the target.
- **Reduce Motion:** the balance count-up jumps straight to the new value, tap rings are
  static, and the other animations skip to their end state.
- **Screen readers:** buttons, tabs and switches expose their state (selected, on/off,
  disabled, busy) through `aria-*` props, which work on iOS, Android and web. Amounts and
  people have spoken labels.

## Design notes

- Brand blue `#2150FF`. Blue text on black uses `#5B82FF` so it stays readable.
- In light mode, small green text uses `#15803D` (`successText`), because `#16A34A` on
  white is only about 3.3:1. `#16A34A` is still used for icons and large amounts. See
  Accessibility above for the red.
- All tap targets are at least 44px.
- App icons are generated from the logo with `node scripts/make-icons.mjs`
  (needs Playwright).

## Not verified yet (needs real phones and real accounts)

Everything above was built and tested in a cloud environment without Xcode, the Android
SDK, or real Supabase, Stripe or Expo accounts. Still to verify:

- **First native builds** (`expo run:ios` / `run:android`). The Swift/Kotlin module in
  `modules/payvr-nearby` has never been compiled.
- **Bluetooth tapping on two real phones,** and tuning `PROXIMITY.closeRssi`. Also UWB
  distance on two iPhone 11+.
- **Stripe's PaymentSheet and Connect onboarding** in a real Stripe test account.
- **Push delivery** through Expo/APNs/FCM (needs an EAS project and push credentials).
- **Hosted Supabase pieces:** Realtime, Storage (avatars) and phone OTP. The SQL, the Edge
  Functions and the app's REST calls were tested locally with PostgREST.
- **Real money:** would need money-transmission licensing and compliance (KYC) and
  Stripe's approval for that use. Out of scope for this prototype.
