# Security

The server is the only authority. Clients send intents ("cast", "plant plot 3", "buy starter_pack"); the server validates them and decides results. Currency, inventory, hatch and crate rolls, damage, rewards, timers and purchases never take a value from the client.

Every remote checks, in this order: rate limit (token bucket per player), size (2 KB for intents), types and ranges (`Util/Validate`: no NaN, no infinities, integers where expected, id patterns), ownership (the Drifter, plot or cosmetic must be the player's), cooldowns and game state. Repeated violations are logged with the player id and kick the player after 50. The companion backend rate limits per IP and route, checks bearer secrets in constant time, and verifies Roblox webhook signatures with a 10-minute replay window.

## The ten most likely attacks

| # | Attempt | How it is blocked |
| --- | --- | --- |
| 1 | **Fake purchase grant**: firing a remote that says "I bought Gems" | Only `ProcessReceipt` (called by Roblox after it charges) grants Developer Products, and only game pass ownership read from Roblox grants passes. No client remote can grant anything. |
| 2 | **Double grant**: getting a receipt processed twice (Roblox retries, server crash, two servers) | Grants are idempotent on `PurchaseId`, stored in the save. The save is written before `PurchaseGranted` is returned; if the write fails the grant is rolled back and Roblox retries later. Tested in `server_store.spec.luau`. |
| 3 | **Refund abuse**: buying Gems, spending them, then charging back | Support reversals undo exactly what the purchase granted. Spent Gems or Silver become debt that blocks Gem spending until repaid. Revoked game passes are reversed on the next join. Every grant and reversal is in the `PurchaseAudit` log. |
| 4 | **Odds manipulation**: rerolling or predicting hatches and crates | Rolls use the server's `Random`, never a client seed. Pity counters live in the server save. A client can only see the result after the roll. |
| 5 | **Fishing bot or tap faking** | The server picks bite time, zone and fish at cast. A tap that claims to land before the bite is rejected and flagged; a reel faster than the rod's minimum wait is impossible because the server's clock decides. Perfect timing gives at most what a skilled player gets. |
| 6 | **Speed hacks and clock tampering for timers** | Crops, forage, Worker income and offline progress use server time (`GetServerTimeNow` / `os.time` on the server). Offline progress is capped at 8 hours. Changing the device clock does nothing. |
| 7 | **Night exploits**: teleporting, damage injection, hitting from across the map | Damage and hits are computed in `NightSim` from server-side positions. Positions read from characters are clamped to the sector and to 1.5x the player's speed per tick; impossible moves snap the character back. Inputs are booleans and bounded aim vectors only. There is no friendly fire and squads cannot reach each other's sectors. |
| 8 | **Replaying or flooding remotes** | Intents carry sequence numbers; each is applied once, so replays do nothing. Token buckets limit intents (8/s, burst 16), purchase prompts (6/min), quick chat (1/s), reports (2/min) and night input (40/s). |
| 9 | **Save corruption or multi-server duplication** (two sessions writing the same save) | DataStore session locking: every write is an `UpdateAsync` that checks this server still holds the lock. A server that lost the lock cannot write and removes the player. Tested with two simulated servers. |
| 10 | **Chat abuse and personal information sharing** | There is no free text. Quick phrases and emotes are ids checked against the config list (and owned emotes). Report and block are one tap away on every player, at night and by day. |

Other measures: the debug cheat panel is not in release builds (`release.project.json` leaves it out; CI checks the built place), and it answers only in Studio or for allowlisted testers on a test place. Remote config is validated by JSON Schema and by fairness rules in the backend, then again by every server, which keeps its last good config on failure. Secrets live in the Roblox Secrets store and the backend environment, never in the repo.
