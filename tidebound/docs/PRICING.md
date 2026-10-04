# Pricing

Every price, bundle size, odds table and pity rule here comes from `shared/config/catalog.json` and can change through live config. Robux prices follow the brief's rule (Robux = USD ÷ 0.01). Players always see the live price Roblox will charge.

Gems buy only cosmetics and convenience. No product, Gem item or pass track sells power, drop rates or more of anything a free player earns by playing. `ConfigValidator` rejects any config that breaks this, and `tests/specs/store.spec.luau` checks it by buying everything.

## Gem bundles (Developer Products, consumable)

| Bundle | USD | Robux | Gems | Bonus vs base |
| --- | --- | --- | --- | --- |
| Handful | $0.99 | 99 | 80 | base |
| Pouch | $4.99 | 499 | 450 | +12% |
| Chest | $9.99 | 999 | 950 | +19% |
| Hoard | $19.99 | 1,999 | 2,000 | +25% |
| Vault | $49.99 | 4,999 | 5,250 | +31% |

Bonuses are measured against 80 Gems per whole dollar, which is how the brief's percentages work out (450 / 400 = +12.5%). The ladder rewards larger bundles without making the small ones feel like a bad deal, and the shop shows each bonus plainly.

## Direct products

| Product | USD | Robux | Roblox type | Planning buy rate |
| --- | --- | --- | --- | --- |
| Starter Pack | $2.99 | 299 | Game Pass (once per account) | 1.0% |
| Tidecomb Crate | $1.99 | 199 (or 160 Gems) | Developer Product | 1.2% |
| Harbor Pass (4-week block) | $4.99 | 499 | Developer Product | 0.8% |
| Harbor Club (monthly) | $4.99/month | Roblox subscription | Subscription | 0.5% |
| Storage and Auto-collect Pass | $7.99 | 799 | Game Pass | 0.4% |

**Starter Pack.** It holds one ordinary egg (same odds a free player gets for 100 Silver), the Sailor Drifter skin and the Lantern rod skin. It is offered once, after the first night, with a "No thanks" button the same size as the buy button, because a first purchase converts best when the player already likes the game.

**Tidecomb Crate.** One random cosmetic with full odds on the card and in the odds screen, and Epic or better guaranteed within 30 crates. It is the only randomized purchase; it is hidden where Roblox policy restricts paid random items.

**Harbor Pass.** It unlocks the paid track for the current 4-week block: 7 cosmetics and 300 Gems across 30 tiers. Pass XP comes from play at the same rate for everyone, so paying never speeds up progress.

**Harbor Club.** Monthly: 30 Gems a day (claimed in game, up to about 900 a month), +100 Drifter storage up to the same 200 cap free players reach, auto-collect for Worker income and ripe crops, and one cosmetic per month. It is the best value for regular players and only adds convenience.

**Storage and Auto-collect Pass.** A one-time purchase: auto-collect forever and +50 storage within the 200 cap. It suits players who dislike subscriptions and want the same convenience.

## Gem prices

| Item | Gems | What it does |
| --- | --- | --- |
| Tidecomb Crate | 160 | Same crate and odds as the Robux version |
| Decorations | 120, 180, 250, 320, 400 | Lantern String, Kelp Arch, Shell Fountain, Coral Gazebo, Lighthouse Mural |
| Drifter skins | 250, 300, 450, 600 | Pirate Hat, Raincoat, Crown of Shells, Aurora Cloak |
| Rod skins | 200 | Bamboo, Starlight |
| Extra Drifter storage | 300 | +20 storage, never past the 200 cap |

Gem prices sit between one Handful and one Pouch for most items, so every bundle buys something and nothing needs an awkward top-up. Spending Gems is blocked while a refunded purchase has left the player in Gem debt.

## Cosmetic crate odds

| Rarity | Each roll | Overall with pity |
| --- | --- | --- |
| ● Common | 60.00% | 59.05% |
| ■ Uncommon | 25.00% | 24.60% |
| ▲ Rare | 10.50% | 10.33% |
| ◆ Epic | 3.50% | 4.67% |
| ★ Legendary | 1.00% | 1.34% |

| Item class | Overall chance |
| --- | --- |
| Decorations | 32.28% |
| Emotes | 25.83% |
| Drifter skins | 22.44% |
| Rod skins | 19.44% |

Each item in a rarity is equally likely; the odds screen lists every item's chance (for example Leviathan Costume 0.668%). Duplicates convert to Gems: 10, 20, 40, 80 or 160 by rarity. Pity: the 30th crate without an Epic or better is always Epic or better.

## Egg hatch odds (Silver, never sold for Robux)

| Rarity | Each hatch | Overall with pity |
| --- | --- | --- |
| ● Common | 60% | 58.62% |
| ■ Uncommon | 25% | 24.42% |
| ▲ Rare | 10% | 9.77% |
| ◆ Epic | 4% | 5.40% |
| ★ Legendary | 1% | 1.79% |

Pity: Epic or better within 25 hatches, Legendary within 100. The "overall" column is the long-run share including pity, computed by the same code the server rolls with. The odds test runs 100,000 hatches and 100,000 crates and requires every rarity to land within 4 standard errors of these numbers.

## Price tests

Experiments live in `catalog.experiments` (all off by default):

| Experiment | Variants |
| --- | --- |
| exp_starter_price | control 299 Robux; price_3_99 at 399 Robux (needs its own game pass id) |
| exp_pouch_size | control 450 Gems; gems_500 |
| exp_gem_crate_price | control 160 Gems; gems_150 |

Players are bucketed by a stable hash of user id and experiment id, so a player always sees the same variant on every server. Every purchase and Gem spend logs `variantId` and `experimentId`, in the analytics event and in the purchase ledger.

## Spending controls

Players can set a monthly Robux limit (0, 500, 1,000, 2,000, 5,000 or 10,000). Lowering applies at once; raising waits 24 hours. The spending summary shows this month's spend, history by month, recent purchases (including refunds) and Gems spent. Roblox Parental Controls (spending limits and purchase approval) apply on top.

## Rewarded ads

One placement, off by default: double one market sale per day. It is offered only when `PolicyService` allows ads for that player and Roblox reports an ad is available.
