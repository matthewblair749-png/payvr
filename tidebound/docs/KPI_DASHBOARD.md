# KPI dashboard

Two sources feed the dashboard:

- **Roblox Creator Dashboard** (Analytics): retention, engagement, monetization, the onboarding funnel (`LogOnboardingFunnelStepEvent`), economy flows (`LogEconomyEvent`) and custom events (`LogCustomEvent`).
- **Companion backend** (`GET /admin/kpis?from=<unix>&to=<unix>`): the same events with full properties, used for the formulas below. The code is `backend/src/kpi.ts` and is unit tested.

## Events

Exact names, logged by the server unless noted:

`store_opened`, `product_viewed` (client UI, server-validated), `purchase_started`, `purchase_completed`, `purchase_failed`, `purchase_refunded`, `crate_opened`, `subscription_started`, `subscription_renewed`, `subscription_cancelled`, `pass_tier_claimed`, `tutorial_step`, `first_hatch`, `night_started`, `night_survived`, `night_failed`, `boss_defeated`, `harbor_tier_unlocked`, `session_length`, `notification_opened`.

Supporting events: `session_started`, `gems_spent`, `drifter_hatched`, `quest_completed`, `level_up`, `starter_offer_shown`, `rewarded_ad_completed`. Purchase events carry `productId`, `robux`, `variantId` and `experimentId`. No personal data is logged; the only identifier is the Roblox user id.

## Definitions

- **Player-day**: one player with at least one `session_started` on a UTC day.
- **DAU**: player-days in the period ÷ days in the period.
- **Cohort day 0**: a player's first `session_started` day.

## KPIs, formulas and targets

| KPI | Formula | Target |
| --- | --- | --- |
| Day-1 retention | players active on cohort day 1 ÷ players in the cohort (cohorts whose day 1 is in range) | 35% or more |
| Day-7 retention | players active on cohort day 7 ÷ players in the cohort | 12% or more |
| Share of players who pay | distinct users with `purchase_completed` ÷ distinct users with `session_started` (same period) | 1.5% to 3% (monthly) |
| Average revenue per daily player (ARPDAU) | Robux from `purchase_completed` × $0.01 ÷ player-days (details below) | $0.005 per day ($0.15 per month) |
| Subscription conversion | distinct users with `subscription_started` ÷ distinct users with `session_started` | 0.5% (monthly) |
| Refund rate | Robux in `purchase_refunded` ÷ Robux in `purchase_completed` | under 2% |

ARPDAU in detail:

- **Gross ARPDAU (player spend)** = Σ `robux` on `purchase_completed` × $0.01 ÷ player-days. This is the number the planning model uses ($0.15 per DAU per month ≈ $0.005 per DAU per day).
- **Net ARPDAU (your earnings)** = gross ARPDAU × 0.7 × 0.0038 ÷ 0.01 = gross ARPDAU × 0.266, plus Premium Payouts ÷ player-days.

## Supporting views

| View | Formula | Use |
| --- | --- | --- |
| Tutorial funnel | count of `tutorial_step` by `step` ÷ count of `step = welcome` | Find the step where new players stop |
| Time to first night | median of first `night_started.at` − first `session_started.at` | Must stay under 8 minutes |
| First night survival | `night_survived` ÷ `night_started` where `onboarding = true` | Target 85% or more |
| Night survival by squad size | `night_survived` ÷ `night_started` grouped by `squadSize` | Balance solo and small squads |
| Starter offer conversion | `purchase_completed` (starter_pack) within 24 h of `starter_offer_shown` ÷ `starter_offer_shown` | Target 3% to 6% |
| Price test results | conversion and Robux per player grouped by `experimentId`, `variantId` | Decide A/B tests |
| Crate pity rate | `crate_opened` with `pity = true` ÷ all `crate_opened` | Should sit near the odds model |
| Session length | median and p75 of `session_length.seconds` | Target median 15 minutes or more |
| Notification opens | `notification_opened` by `type` ÷ notifications sent (backend log) | Keep only types players open |
| Harbor progress | `harbor_tier_unlocked` over time | Tune tier costs to player count |
