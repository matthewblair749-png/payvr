# Setup

This guide takes you from a fresh clone to a published Roblox experience with working purchases.

## 1. Tools

Install [aftman](https://github.com/LPGhatguy/aftman) (or rokit), then run this in `tidebound/`:

```bash
aftman install
```

This installs the versions in `aftman.toml`: Rojo 7.7.1, Lune 0.10.5, StyLua 2.5.2 and Selene 0.31.0. You also need Node.js 22 for the backend and Python 3.11+ with `openpyxl` for the revenue model.

Check everything works:

```bash
lune run tests/run          # builds the place with Rojo, then runs all 64 specs
```

## 2. Create the experience

1. In Creator Hub, create a new experience named Tidebound. Note the **universe id** and **place id**.
2. Open the place in Roblox Studio. Install the Rojo Studio plugin (the Rojo plugin matching 7.7.x).
3. Run `rojo serve` and click Connect in the plugin. Studio now mirrors `default.project.json`.
4. In Game Settings:
   - Security: turn on **Allow HTTP Requests** (backend calls) and **Enable Studio Access to API Services** (DataStores in Studio).
   - Places: set **Max Players** to 20 (one room = 4 squads of 5).
   - Avatar: R15, default movement. Leave the default touch controls on (the thumbstick is the night joystick).
5. Fill in the **Experience Questionnaire** (maturity label) and the **paid random items** disclosure. See STORE_READINESS.md.

## 3. Create the products

Create each product on Creator Hub (Monetization) with the Robux price below. These follow the brief's rule: Robux = USD ÷ 0.01.

| Config id | Roblox type | Robux |
| --- | --- | --- |
| gems_handful | Developer Product | 99 |
| gems_pouch | Developer Product | 499 |
| gems_chest | Developer Product | 999 |
| gems_hoard | Developer Product | 1,999 |
| gems_vault | Developer Product | 4,999 |
| cosmetic_crate | Developer Product | 199 |
| harbor_pass | Developer Product | 499 |
| starter_pack | Game Pass | 299 |
| storage_pass | Game Pass | 799 |
| harbor_club | Subscription | US$4.99 per month (Roblox picks local prices) |

Then put each Roblox id into `robloxId` for that product in `shared/config/catalog.json` (subscriptions use the `EXP-...` id), or push it live without a rebuild (step 6). Products with `robloxId` 0 show "not on sale yet" and never prompt.

A/B price tests need one extra product per variant (for example a second Starter Pack pass at 399 Robux). Put its id in the experiment's variant `robloxId` and set `enabled: true`.

On join, the server logs `price_mismatch` whenever a Roblox price differs from the config's expected price. Players always see and pay the live Roblox price.

## 4. Secrets and attributes

- Creator Hub > Experience > Secrets: add `tidebound_backend` with the value of `TIDEBOUND_GAME_SECRET` (step 5). Restrict it to `your-backend-domain`.
- In Studio, select `ServerScriptService.Server` and add a string attribute `BackendUrl` (for example `https://tidebound-backend.example.com`). Leave it empty to run without the backend; the game works fully, only offline notifications and the KPI event feed are off.
- Test places only: add boolean `IsTestPlace = true` and string `DebugTesters = "123,456"` (user ids) to use the cheat menu outside Studio. Release builds do not contain the debug code at all.

## 5. Companion backend

```bash
cd backend
npm ci && npm test && npm run build
```

Environment variables:

| Variable | What it is |
| --- | --- |
| `TIDEBOUND_GAME_SECRET` | Shared with game servers (the `tidebound_backend` secret) |
| `TIDEBOUND_ADMIN_KEY` | Bearer key for `/admin/*` (live config, reversals, export, KPIs) |
| `ROBLOX_WEBHOOK_SECRET` | Secret you set on the Roblox webhook |
| `ROBLOX_OPEN_CLOUD_KEY` | Open Cloud API key: DataStores read/write (Players, PendingReversals, LiveConfig), Messaging publish, user notifications |
| `ROBLOX_UNIVERSE_ID` | From step 2 |
| `ROBLOX_NOTIFICATION_MESSAGE_IDS` | JSON map of notification type to message template id, for example `{"crops_ready":"...","worker_income_full":"...","night_starting":"...","season_changed":"..."}` |
| `TIDEBOUND_DATA_DIR` | Where events, reports and the notification schedule are stored (default `./data`) |
| `PORT` | Default 8080 |

Run `npm start` on any small host (one CPU, 512 MB RAM is enough at launch) behind HTTPS.

Roblox setup for the backend:

1. Creator Hub > Webhooks: add `https://<backend>/webhooks/roblox` with your secret and the **Right to erasure** event.
2. Creator Hub > Experience notifications: create one message template per notification type (crops ready, Worker income full, night starting, new season) and put their ids in `ROBLOX_NOTIFICATION_MESSAGE_IDS`.

## 6. Live config

Every tunable value can change without a new place version:

```bash
curl -X POST https://<backend>/admin/config \
  -H "Authorization: Bearer $TIDEBOUND_ADMIN_KEY" -H "content-type: application/json" \
  -d '{"overrides": {"economy": {"eggPriceSilver": 120}}}'
```

Overrides are JSON Merge Patches on top of the shipped config. The backend checks them against the JSON Schemas and the fairness rules, writes them to the `LiveConfig` DataStore, and tells every server to reload. Each server validates again and keeps its last good config if anything is wrong. Arrays (like `products`) are replaced whole, so send the full list when you change one entry.

After changing `shared/config/catalog.json` itself, rebuild the revenue model:

```bash
python3 model/build_model.py
```

## 7. Support reversals

When Roblox support reverses a Developer Product purchase or you confirm a chargeback:

```bash
curl -X POST https://<backend>/admin/reverse -H "Authorization: Bearer $TIDEBOUND_ADMIN_KEY" \
  -H "content-type: application/json" -d '{"userId": 123, "purchaseId": "<PurchaseId>", "reason": "chargeback"}'
```

Find purchase ids in the `PurchaseAudit` DataStore (key = PurchaseId). Game passes reverse themselves: the server rechecks ownership on every join.

## 8. Publish

```bash
rojo build release.project.json -o Tidebound.rbxl
```

Open `Tidebound.rbxl` in Studio, check it in a Team Test, then publish. CI uploads the same file as a build artifact on every push. You can also publish it with the Open Cloud place publishing API.

## 9. Assets

The game runs on placeholder parts. To add art, put models named as listed in ASSETS.md under `ReplicatedStorage.Assets` (create that folder in Studio or add it to the Rojo project). The world builder and the night renderer pick them up by name.
