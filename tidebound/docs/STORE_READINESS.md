# Store readiness

Tidebound ships as a Roblox experience. Roblox is the app on the App Store and Google Play, so Apple's and Google's rules reach the game through Roblox's own policies. This checklist covers what Roblox requires of an experience, then what a standalone app port would need.

## Roblox: monetization

- [ ] Every product exists on Creator Hub and its id is in `catalog.json` (or live config). See SETUP.md step 3.
- [ ] Robux prices match `catalog.json`; the server logs `price_mismatch` on join if not.
- [ ] Developer Products are granted only in `ProcessReceipt`, idempotently, and confirmed after saving. Done.
- [ ] Game passes are checked with `UserOwnsGamePassAsync` on join and after purchase. Done.
- [ ] Harbor Club: the experience meets Roblox's subscription eligibility rules (verified creator, experience standing). Subscription benefits are described accurately in the shop, and cancelling is done in Roblox settings.
- [ ] Nothing sells power or advantages that break Roblox's guidance on paid advantages; all paid items are cosmetic or convenience. Done and tested.
- [ ] No purchase prompt before the first night, during nights, or as a pop-up; the shop is a small button. Done.
- [ ] Prices are shown in Robux from `GetProductInfo`; subscription prices are shown by Roblox in local currency.

## Roblox: paid random items

- [ ] Odds for every rarity, item class and item are shown before purchase. Done (crate card plus full odds screen).
- [ ] Pity rule stated next to the odds. Done.
- [ ] Crates are hidden when `PolicyService:GetPolicyInfoForPlayerAsync().ArePaidRandomItemsRestricted` is true. Done.
- [ ] The experience questionnaire declares paid random items.
- [ ] No paid random item contains anything other than cosmetics. Enforced by `ConfigValidator`.

## Roblox: audience, maturity and safety

- [ ] Complete the Experience Questionnaire. Expected label: Minimal or Mild (cartoon creatures, non-violent knockback, no blood, no free chat).
- [ ] Free-text chat is off: `TextChatService.CreateDefaultTextChannels = false`; chat window and input hidden on the client. Done.
- [ ] Quick phrases and emotes only. Report and block on every player. Done.
- [ ] No collection of age, birthday, real names, or contact details. No links off Roblox. Done.
- [ ] Respect Roblox Parental Controls (spending limits, chat settings); the in-game monthly limit adds a second layer. Done.
- [ ] Rewarded ads (off by default): if enabled, only through Roblox's ad products and only where `PolicyService` allows ads.

## Roblox: privacy and data

- [ ] Right to Erasure webhook configured and tested (Creator Hub > Webhooks). The backend deletes `Players` and `PendingReversals` entries, drops events and reports, and closes a live session.
- [ ] In-game "See my data" and "Delete my Tidebound data" work. Done and tested.
- [ ] Data inventory (DATA_INVENTORY.md) and privacy policy published on your website and linked from the experience description.
- [ ] Experience notifications: players opt in through Roblox's prompt; at most 2 a day; each type can be switched off in Settings.

## Roblox: technical

- [ ] Studio Access to API Services on for testing; HTTP requests on (backend).
- [ ] Max Players 20; StreamingEnabled on.
- [ ] Release built from `release.project.json` (no debug panel). CI checks the built place.
- [ ] Device testing: one low-end Android, one mid-range Android, one iPhone from the last four years; target 60 FPS during wave 6 with a full squad.
- [ ] DevEx: account eligible (age 13+, verified email, minimum Robux balance for cash-out) before planning revenue.

## Standalone app port (for later)

If Tidebound later ships as its own iOS and Android app, these apply on top of the work above:

- [ ] **Apple Small Business Program**: enrol the developer account before launch so the commission is 15% (the revenue model assumes it).
- [ ] Google Play: 15% on the first $1M of annual earnings and on subscriptions.
- [ ] In-app purchases only through StoreKit and Google Play Billing for digital goods; restore purchases button; server-side receipt validation (App Store Server API, Google Play Developer API) with refund notifications.
- [ ] Loot boxes: odds disclosed before purchase (Apple 3.1.1, Google Play paid random items policy).
- [ ] Kids categories (Apple Kids, Google Families): parental gate before purchases and external links, no behavioral ads, certified ad SDKs only, COPPA and GDPR-K compliant data handling, neutral age gate at first launch.
- [ ] Sign in with Apple required if any third-party login is offered; account deletion inside the app.
- [ ] App Store privacy labels and Google Play Data safety form: fill from DATA_INVENTORY.md (gameplay data, purchase history, device id for crash reports; nothing used for tracking).
