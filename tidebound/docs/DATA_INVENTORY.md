# Data inventory

Tidebound stores only what the game needs to work, and nothing that identifies a person outside Roblox. The only identifier is the Roblox user id. There is no name, age, email, location, contact list, device id or advertising id.

## Roblox DataStores

| Store and key | Field | Why |
| --- | --- | --- |
| Players / u<userId> | currencies, debt, materials, fish, crops | Game progress |
| | rods, plots, forage timers, cast in progress | Day activities and timers |
| | drifters (species, trait, level, xp, happiness, role, skin) | Creature collection |
| | storage upgrades, eggs, pity counters, collection book | Hatching and storage |
| | cosmetics owned and equipped, crate pity | Cosmetics |
| | level, xp, play time, stats counters, quests, login streak | Progression; play time drives the new-player catch-up bonus |
| | night streak and results, onboarding steps | Night rewards and tutorial |
| | Harbor Pass progress, entitlements, Harbor Club status | Paid features |
| | monthly Robux spend, spend limit, purchase ledger (product, Robux, time, granted items) | Spending summary, spend limit, refunds |
| | settings (text size, haptics, reduced motion, volumes, notification switches, Smuggler opt-in) | Preferences |
| | blocked user ids | Hide blocked players' quick phrases |
| | violation count | Anti-cheat |
| | lock (server job id, time), revision | Prevent two sessions overwriting each other |
| PurchaseAudit / <PurchaseId> | userId, productId, variant, Robux, time, status | Purchase audit and support |
| PendingReversals / u<userId> | purchase id, reason, time | Support reversals for offline players |
| Reports / r<reported>_<reporter>_<time> | reporter id, reported id, reason, context, time, server id | Moderation |
| Harbor / global | building tiers and shared material totals | Shared harbor (no personal data) |
| LiveConfig / overrides | tuning values | Remote config (no personal data) |

## Companion backend

| File | Contents | Why | Kept |
| --- | --- | --- | --- |
| events.jsonl | event name, user id, time, event properties (product, Robux, step, waves...) | KPI dashboard | 13 months, then delete |
| reports.jsonl | same as the Reports store | Moderation follow-up | 12 months |
| logs.jsonl | server errors (may include a user id) | Crash reporting | 90 days |
| schedule.json | user id, pending notification types and times, sent counts per day | Opt-in notifications | Until sent |

## Roblox analytics

Custom, economy and funnel events go to the Roblox Creator Dashboard with the same fields as above (no personal data).

## Deletion and export

- In game: Settings > Your data > "See my data" shows the full save as JSON; "Delete my Tidebound data" erases the save after a typed confirmation.
- Roblox Right to Erasure: the backend webhook deletes the `Players` and `PendingReversals` entries, removes the user's events, reports and schedule, and closes any live session.
- `PurchaseAudit` entries are kept for tax and fraud obligations with the user id only. If local law requires, replace the user id with a one-way hash on erasure.
