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

Expo Go works for the current build. Bluetooth tap-to-pay (build step 5) will need a
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
| 4 | QR send / request | Scanner + handle lookup built; next: polish and two-phone testing |
| 5 | Bluetooth LE + Nearby Interaction (UWB) | Mocked in `src/services/nearby.ts` |
| 6 | Stripe test mode (Connect) | Next after BLE; plugs in behind `src/services/payments.ts` |
| 7 | Push notifications, polish | In-app realtime banner done |

## Where things live

```
src/
  app/                  Expo Router screens
    (auth)/             phone → code → profile → Face ID → PIN → welcome
    (tabs)/             home, activity, profile (+ raised Tap button in the tab bar)
    amount, tap, confirm, success, request/[id], qr, person/[id],
    transaction/[id], wallet/[action], settings/*, legal/[doc]
  components/           UI kit: logo (SVG), icons (SVG), buttons, keypad, pulse rings, check draw…
  theme/                colors (both palettes), typography, theme provider (200ms fade)
  services/
    payments.ts         ALL money movement: Supabase RPCs (live) or the same rules in memory (mock)
    backend/            auth, profiles, data, realtime: live.ts (Supabase) and mock.ts
    supabase.ts         Supabase client (sessions stored in expo-secure-store)
    nearby.ts           Tap discovery (mock) + QR payload format
    biometrics.ts       Face ID / fingerprint
    storage.ts          expo-secure-store (localStorage on web)
  store/                App state, authorize() = Face ID or PIN before payments
  data/                 Types (mirror the Supabase schema) and mock seed data
supabase/
  migrations/           Tables, row-level security, money functions, realtime, storage
  seed.sql              Demo people and "simulate" helpers (dev projects only)
  tests/                SQL tests: npm run test:db
```

## Checks

```bash
npm run typecheck
npm run lint
npm run test:db     # needs Postgres 15+ binaries installed locally
```

## Prototype helpers

- **Profile → Prototype** has buttons to simulate "Jake pays you $20" (realtime banner +
  balance count-up) and an incoming request. With Supabase they call the helpers in
  `supabase/seed.sql`.
- The daily limit is a rolling 24 hours: $500 across payments and paid requests.
- The Tap screen "finds" one of your contacts after ~3.5s (`MOCK_DISCOVERY_MS`). Sessions
  expire after 60s with a retry message.
- QR → Scan has a "simulate a scan" button so one device can walk the flow.

## Design notes

- Brand blue `#2150FF`. Blue text on black uses `#5B82FF` so it stays readable.
- In light mode, small green text uses `#15803D` (`successText`). `#16A34A` on white is
  only about 3.3:1, which is below the WCAG AA minimum of 4.5:1 for small text. `#16A34A`
  is still used for icons and large amounts.
- All tap targets are at least 44px.
- App icons are generated from the logo with `node scripts/make-icons.mjs`
  (needs Playwright).
