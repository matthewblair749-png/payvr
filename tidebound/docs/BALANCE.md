# Balance

All numbers below live in `shared/config/*.json` and can change through live config. The tests in `tests/specs/economy.spec.luau` and `night.spec.luau` play the game with scripted players and fail if the targets drift.

## How the free economy was set

I started from the targets (about 400 Silver in the first 8 minutes, first egg at 100 Silver, a Rare within about 3 sessions) and a scripted new player who fishes, farms and forages with human timing. I then tuned fish and crop values until that player earned 384 net Silver in 8 minutes and had an 81% chance of a Rare or better within 3 sessions.

## Free economy table

| Source | Amount | Time | Silver per minute (active) |
| --- | --- | --- | --- |
| Tutorial fish (Golden Harbor Snapper) | 100 | once | - |
| Fishing, Driftwood Rod (avg fish value 3.7, 85% catch) | 2 to 40 per fish | 6 to 8 s wait + 1.2 s | about 20 |
| Sea Lettuce (6 plots) | 5 sell - 2 seed | 60 s | about 18 |
| Kelp Bean / Glow Berry / Tide Pumpkin | 13 / 21 / 30 sell | 120 / 180 / 240 s | 4.5 / 5 / 5.25 per plot |
| Foraging (6 nodes) | 1 to 4 materials | 90 s respawn | materials for the harbor and repairs |
| Workers (Common, income 10) | 3 Silver per minute each | also offline, 8 h cap | 3 |
| Night (6 waves survived) | 150 + 60 boss | 5 min | about 40 |
| Login streak | 20 to 100 Silver, 2 Pearls on day 7 | daily | - |
| Daily quests (3) | 50 to 90 Silver each | daily | - |

| Sink | Price |
| --- | --- |
| Egg (standard odds) | 100 Silver |
| Extra farm plots 7 to 18 | 150 to 2,200 Silver |
| Rods tier 2 / 3 / 4 | 600 / 2,400 / 7,000 Silver |
| Storage upgrades (+20 each, to 200) | 300, 600, 1,000, 1,500, 2,200 Silver |
| Repairs at night | 1 iron scrap per 25 health |
| Harbor contributions | materials, shared by all players |

| Measured by the tests | Result | Target |
| --- | --- | --- |
| Net Silver in the first 8 minutes (10 seeds) | 384 | about 400 |
| Tutorial length | under 60 s | 60 s |
| First night starts | 7 min 15 s after joining | within 8 min |
| Silver per session (day + night) | 466 | - |
| Eggs affordable in 3 sessions (70% of Silver) | 9 | - |
| Chance of a Rare or better in 3 sessions | 81% | about 3 sessions |

## Drifters

Power at level L = species power x rarity multiplier x (1 + 0.06 x (L - 1)) x trait. A Common Puddlefin with Brave goes from 10.8 power at level 1 to 29.5 at level 30; a Legendary Maelstrom Koi goes from 22.5 to 61.8. Rarity matters, but a levelled Common still carries its weight.

Feeding gives 2 XP per Silver of food value and +8 happiness. Happiness decays 6 points per hour while a Drifter is active and moves output between 0.8x (unhappy) and 1.2x (happy). Nothing is ever lost.

Active slots: 3 at level 1, then 4, 5, 6, 7, 8 at levels 4, 8, 14, 22, 32. Player XP to reach level 5 is 398, level 10 is 2,301, level 20 is 12,876, and level 50 is 118,759.

Hatch odds: Common 60, Uncommon 25, Rare 10, Epic 4, Legendary 1. Pity guarantees Epic or better within 25 hatches and Legendary within 100. With pity, the overall rates are 58.6 / 24.4 / 9.8 / 5.4 / 1.8%.

## Night

Measured over 40 nights each with `lune run tests/tools/night-odds <power> <squad>` (bots that fight but do not repair, so real squads do better):

| Squad (power per player) | Night survived | The Undertow defeated |
| --- | --- | --- |
| Tutorial night, 1 brand-new player (power 11) | 100% | no boss |
| 1 brand-new player (power 11) | 40% | 0% |
| 1 player, level 4 Guardian (power 14) | 87% | 0% |
| 3 brand-new players (power 11) | 100% | 40% |
| 3 players (power 14) | 100% | 60% |
| 5 players (power 14) | 100% | 57% |
| 5 players (power 18) | 100% | 62% |

Squads fill automatically, so most players defend in groups. A failed night still pays 25% and never takes anything.

Enemy count per wave = 3 + 2 x wave + 1.5 x squad size (rounded). Health +8% per wave, compounding. The lighthouse has 800 health and the seawall 1,100. The boss has 450 x (1 + 0.4 x (squad - 1)) x wave health and raises a shield at 66% and 33% that needs one weak-point hit per squad member within 4 seconds.

Rewards: 25 Silver, 2 driftwood, 2 shells and 1 iron scrap per wave survived; boss +60 Silver and 3 Pearls. Silver is split by contribution: 50% equal share and 50% by contribution score (damage 1 point, repair 1.5 points per health, weak point 50 points), clamped to 0.5x to 2x. A survived night adds +5% per consecutive night (max +30%); a failed night pays 25% and resets the streak.

## Tuning guide

| If you see | Change | Where |
| --- | --- | --- |
| New players feel poor in the first session | Raise `fish` values for tier 1 or `crop_sea_lettuce.sellValue` | day.json |
| Rares come too slowly | Lower `eggPriceSilver` or raise Silver income; avoid touching hatch weights so the published odds stay stable | economy.json |
| Nights too hard for small squads | Lower `enemyCountBase` or `enemyHealthGrowthPerWave`; raise `catchUp.nightPowerBonus` for new players | night.json, economy.json |
| Boss rarely defeated | Lower `boss.baseHp` or `hpPerSquadMember`; raise `weakPointWindowSeconds` | night.json |
| Players hoard Silver late game | Add rod tiers or harbor costs; raise extra plot prices | day.json, harbor.json |
| Offline income too strong | Lower `worker.silverPerIncomePointPerMinute` or `cycle.offlineCapHours` | economy.json, cycle.json |
| Harbor tiers unlock too fast or slow | Scale `tierCosts` with your daily players | harbor.json |

After any economy change, run `lune run tests/run economy` and `lune run tests/tools/economy-trace` to see the effect on a scripted new player, and `lune run tests/tools/night-odds <power> <squad>` for night survival rates.
