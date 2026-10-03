"""Builds src/Localization/strings.csv (a Roblox LocalizationTable, English shipped).
UI strings live in UI below; names for content (fish, Drifters, cosmetics...) come from NAMES and config ids.
Run: python3 shared/tools/gen-strings.py"""
import csv, json, os
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")
cfg = {n: json.load(open(os.path.join(ROOT, "shared", "config", n + ".json"))) for n in ["day", "drifters", "harbor", "catalog", "compliance"]}

UI = {
    # HUD and panels
    "hud_fish": "Fish", "hud_farm": "Farm", "hud_market": "Market", "hud_drifters": "Drifters", "hud_inventory": "Bag",
    "hud_harbor": "Harbor", "hud_quests": "Quests", "hud_pass": "Pass", "hud_settings": "Settings", "hud_shop": "Shop",
    "currency_silver_short": "Silver",
    "phase_day": "Day - {time} left", "phase_dusk": "Dusk - night in {time}", "phase_night": "Night - {time} left", "phase_dawn": "Dawn - {time}",
    "phase_first_night": "First night in {time}",
    "season_banner": "{season} - {time} left",
    "panel_fishing": "Fishing", "panel_farm": "Farm", "panel_market": "Market", "panel_inventory": "Bag", "panel_drifters": "Drifters",
    "panel_collection": "Collection Book", "panel_hatch": "Hatching", "panel_odds": "Odds", "panel_harbor": "Harbor",
    "panel_quests": "Quests", "panel_pass": "Harbor Pass", "panel_shop": "Shop", "panel_spending": "Spending",
    "panel_settings": "Settings", "panel_privacy": "Your data", "panel_welcome": "Welcome back", "panel_night_result": "Dawn",
    "panel_people": "Players", "panel_squad": "Your squad",
    "loading": "Loading...", "continue": "Continue", "cancel": "Cancel", "ready": "ready", "on": "On", "off": "Off",
    "owned": "Owned", "equip": "Equip", "equipped": "Equipped", "equip_toggle": "Use / remove", "no_thanks": "No thanks",
    "reconnecting": "Reconnecting... your actions are saved and will go through.",
    "robux_amount": "R$ {robux}",
    # Fishing
    "fishing_rod": "Rod: {rod} (tier {tier})", "fishing_ready": "Cast when you're ready.", "fishing_cast": "Cast",
    "fishing_reel": "Reel!", "fishing_waiting": "Waiting for a bite...", "fishing_bite": "Bite! Tap in the green zone.",
    "fishing_too_soon": "Too soon - the fish swam off.", "fishing_escaped": "It got away. Cast again!",
    "fishing_missed": "Missed the zone. Try again!", "fishing_caught": "Caught a {fish} ({rarity})!",
    "fishing_caught_perfect": "Perfect! Caught a {fish} ({rarity}) - double XP.", "fishing_rods": "Rods",
    "fishing_wait": "{min}-{max}s bite", "buy_silver": "{price} Silver (lvl {level})",
    # Farm
    "farm_pick_seed": "Pick a seed, then tap an empty plot.", "farm_seed_cost": "{cost} Silver, {time}s",
    "farm_harvest_all": "Harvest everything ready", "farm_empty": "Empty\nTap to plant", "farm_ready": "{crop}\nReady!",
    "farm_growing": "{crop}\n{time}", "farm_buy_plot": "New plot: {price} Silver (lvl {level})",
    # Market and forage
    "market_demand_title": "Today's demand", "market_demand_up": "{category}: +{pct}% today", "market_demand_down": "{category}: -{pct}% today",
    "market_demand_flat": "{category}: normal price", "market_items": "{count} items to sell", "market_sell_all": "Sell all",
    "market_sold": "Sold for {silver} Silver", "market_workers": "Workers: {rate} Silver/min - {pending} waiting (max {cap})",
    "market_collect": "Collect Worker Silver", "market_ad_double": "Watch an ad to double that sale (once a day)",
    "category_fish": "Fish", "category_crops": "Crops", "category_materials": "Materials",
    "forage_gather": "Gather", "forage_got": "+{amount} {material}",
    "material_driftwood": "Driftwood", "material_shells": "Shells", "material_ironScrap": "Iron scrap",
    # Bag
    "inv_materials": "Materials", "inv_fish": "Fish", "inv_crops": "Crops", "inv_cosmetics": "Cosmetics", "inv_eggs": "Eggs: {count}",
    # Drifters
    "drifters_slots": "Active {active}/{slots} - Stored {stored}/{capacity}", "drifters_hatch_egg": "Hatch an egg ({eggs})",
    "drifters_buy_egg": "Buy and hatch an egg - {price} Silver", "drifters_odds": "Odds", "drifters_book": "Book",
    "drifters_storage_upgrade": "+{amount} storage for {price} Silver", "drifter_level": "Lv {level}",
    "drifter_stats": "Power {power} - Speed {speed} - Income {income} - Happy {happiness} - {trait}",
    "drifter_active": "Active", "drifter_stored": "Stored", "drifter_feed": "Feed",
    "role_worker": "Worker", "role_guardian": "Guardian",
    "hatch_assign": "Choose its job", "hatch_new_species": "New in your Collection Book!", "hatch_pity": "Your lucky egg arrived (pity).",
    "collection_progress": "{found} of {total} Drifters found", "collection_unknown": "???",
    "element_tide": "Tide", "element_ember": "Ember", "element_moss": "Moss", "element_frost": "Frost", "element_nil": "",
    "rarity_common": "Common", "rarity_uncommon": "Uncommon", "rarity_rare": "Rare", "rarity_epic": "Epic", "rarity_legendary": "Legendary",
    # Odds
    "odds_hatch_title": "Egg odds", "odds_crate_title": "Crate odds",
    "odds_hatch_pity": "Guaranteed Epic or better within {epic} hatches, and Legendary within {legendary}.",
    "odds_crate_pity": "Guaranteed Epic or better cosmetic within {n} crates.",
    "odds_rarity": "Rarity", "odds_base": "Each roll", "odds_overall": "Overall (with pity)",
    "odds_by_class": "Chance by item type", "odds_by_item": "Chance for each item",
    "odds_duplicates": "Duplicates turn into Gems.", "odds_explainer": "Odds come from the server and match every roll. Overall rates include the pity guarantee.",
    "class_drifterSkin": "Drifter skins", "class_decoration": "Decorations", "class_rodSkin": "Rod skins", "class_emote": "Emotes",
    # Harbor
    "harbor_intro": "Everyone in Tidebound builds the harbor together. Every tier helps all players.",
    "harbor_tier": "Tier {tier}/{max}", "harbor_next": "Next tier needs {driftwood} driftwood, {shells} shells, {iron} iron scrap (shared).",
    "harbor_give": "Give {amount} {material}", "harbor_thanks": "Thanks! The harbor grows.",
    "building_lighthouse": "Lighthouse", "building_market": "Market", "building_docks": "Docks", "building_seawall": "Seawall", "building_workshop": "Workshop",
    "perk_lighthouseHpPct": "Lighthouse +{value}% health at night", "perk_sellPricePct": "+{value}% market prices",
    "perk_fishWaitPct": "Bites come {value}% faster", "perk_seawallHpPct": "Seawall +{value}% health at night", "perk_repairPct": "Repairs +{value}%",
    # Quests and pass
    "quests_daily": "Today", "quests_weekly": "This week", "quest_progress": "{progress}/{target} - {silver} Silver",
    "quest_claim": "Claim", "quest_claimed": "Claimed", "quests_streak": "Login streak: {days} days - Night streak: {nights}",
    "quests_level": "Level {level} - {xp}/{next} XP",
    "pass_status": "Tier {tier}/{tiers} - {xp}/{per} XP - ends in {time}", "pass_unlock_paid": "See the paid track in the shop",
    "pass_tier": "Tier {tier}", "reward_silver": "{n} Silver", "reward_pearls": "{n} Pearls", "reward_gems": "{n} Gems", "reward_eggs": "{n} egg",
    # Shop
    "shop_locked": "The shop opens after your first night.", "shop_spending": "Spending summary and limit",
    "shop_gems": "Gems (for cosmetics and convenience)", "shop_gems_bonus": "+{pct}% bonus Gems", "shop_gems_base": "Base value",
    "shop_price_robux": "R$ {robux}", "shop_price_subscription": "US${usd}/month (shown in your currency next)",
    "shop_price_gems": "{gems} Gems", "shop_prompt_opened": "Confirm on the Roblox screen.", "shop_view_odds": "See all odds",
    "shop_random_restricted": "Crates are not available in your region.", "shop_gem_items": "Spend Gems",
    "starter_pack": "Starter Pack", "starter_pack_body": "One egg, the Sailor skin and the Lantern rod skin. Once per account. Cosmetic items plus one ordinary egg (same odds as any egg).",
    "starter_offer_intro": "You made it through your first night! A one-time welcome pack is in the shop, if you'd like it.",
    "cosmetic_crate": "Tidecomb Crate", "cosmetic_crate_body": "One random cosmetic. Epic or better guaranteed within {n} crates. No gameplay items.",
    "harbor_pass": "Harbor Pass", "harbor_pass_body": "Unlocks the paid track for this 4-week block: cosmetics and Gems. Pass XP is the same for everyone.",
    "harbor_club": "Harbor Club", "harbor_club_body": "Monthly: {gems} Gems a day, +{storage} Drifter storage (same cap free players reach), auto-collect, one cosmetic each month. Cancel anytime in Roblox settings.",
    "harbor_club_member": "You're a Harbor Club member", "club_claim_daily": "Claim today's {gems} Gems", "club_claim_monthly": "Claim this month's cosmetic",
    "storage_pass": "Storage and Auto-collect Pass", "storage_pass_body": "Auto-collects Worker Silver and ripe crops, and adds Drifter storage up to the same cap free players reach.",
    "crate_result": "You got {item} ({rarity})!", "purchase_thanks": "Thank you! Your items are ready.",
    # Spending
    "spending_this_month": "This month: R$ {robux}", "spending_limit": "Your monthly limit: R$ {robux}", "spending_no_limit": "No monthly limit set",
    "spending_pending": "Changing to {target} in {time}", "spending_set_limit": "Set a monthly limit", "spending_no_limit_button": "No limit",
    "spending_roblox_controls": "Raising a limit takes 24 hours. Parents can also set spending limits in Roblox Parental Controls.",
    "spending_history": "By month", "spending_recent": "Recent purchases", "spending_reversed": "refunded", "spending_gems_spent": "Gems spent in total: {gems}",
    # Settings and privacy
    "settings_accessibility": "Accessibility", "settings_text_size": "Text size {pct}%", "settings_haptics": "Vibration",
    "settings_reduced_motion": "Reduce motion", "settings_music": "Music {pct}%", "settings_notifications": "Notifications",
    "settings_notifications_note": "At most 2 a day, never at night. Turn each kind on or off.",
    "settings_allow_notifications": "Allow Tidebound notifications", "settings_notifications_unavailable": "Notifications aren't available on this account.",
    "notif_crops_ready": "Crops ready", "notif_worker_income_full": "Worker income full", "notif_night_starting": "Night starting", "notif_season_changed": "New season",
    "settings_night": "Night", "settings_smuggler": "Volunteer to be the Smuggler",
    "settings_blocked": "Blocked players", "settings_blocked_none": "Nobody blocked.", "unblock": "Unblock", "block": "Block",
    "settings_privacy": "Your data", "settings_privacy_note": "Tidebound stores only game progress. See exactly what we keep, or delete it.",
    "settings_export": "See my data", "settings_delete": "Delete my Tidebound data",
    "privacy_export_note": "Everything Tidebound stores about you:", "privacy_delete_warning": "This deletes all your Tidebound progress. It cannot be undone.",
    "privacy_delete_code": "Type {code} to confirm", "privacy_delete_placeholder": "Code", "privacy_delete_confirm": "Delete forever",
    "people_alone": "Nobody else is here right now.", "report_sent": "Thanks. Our team will review it.",
    # Onboarding and welcome
    "guide_welcome": "Welcome to Tidebound! Let's catch your first fish.", "guide_start": "Let's go",
    "guide_cast": "Open Fish, cast, and tap when the marker is in the green zone.",
    "guide_sell": "Nice catch! Sell it at the Market.", "guide_hatch": "You have 100 Silver. Hatch your first Drifter egg!",
    "guide_role": "Pick a job: Workers earn Silver by day; Guardians defend at night. You can switch later.",
    "guide_countdown": "The tide rises in {time}. Explore, farm and fish until then!", "guide_skip": "Skip",
    "welcome_away": "You were away {time}. Your Workers earned {silver} Silver.", "welcome_autocollect": "Auto-collected {silver} Silver.",
    "welcome_streak": "Login day {day} - streak {streak}!",
    # Night
    "night_intro": "The tide rises... {time}", "night_break": "Calm water - wave {wave}/{waves} done. {time}",
    "night_wave": "Wave {wave}/{waves} ({element}) - {time}", "night_info": "Iron scrap: {iron} - Ability: {ability}",
    "night_stunned": "Washed back!", "night_squad": "Squad", "night_squad_formed": "Your squad of {count} is ready. Night falls soon.",
    "night_attack": "Hit", "night_charge": "Charge", "night_ability": "Ability", "night_repair": "Repair", "night_inspect": "Inspect",
    "structure_lighthouse": "Lighthouse", "structure_seawall": "Seawall", "structure_dock": "Dock",
    "stage_0": "Intact", "stage_1": "Cracked", "stage_2": "Crumbling", "stage_3": "Destroyed",
    "the_undertow": "The Undertow", "boss_phase": "Phase {phase}", "boss_shielded": "Shielded - everyone hit a weak point!",
    "boss_stunned": "Stunned - attack now!", "boss_window": "{time}s",
    "smuggler_chosen": "You're the Smuggler! Carry 5 crates to your hidden boat.", "smuggler_you": "Crates {delivered}/{total} - {time}",
    "smuggler_carrying": "(carrying)", "smuggler_among_us": "A Smuggler is among you. Inspect once per wave.",
    "smuggler_result_success": "The Smuggler got away!", "smuggler_result_caught": "The Smuggler was caught!", "smuggler_result_timeout": "The Smuggler ran out of time.",
    "result_survived": "The harbor held! {waves} waves survived.", "result_failed": "The tide won this time ({waves} waves).",
    "result_left": "You left after {waves} waves - your rewards are saved.",
    "result_boss": "You defeated The Undertow!", "result_silver": "+{silver} Silver", "result_pearls": "+{pearls} Pearls",
    "result_materials": "+{driftwood} driftwood, +{shells} shells, +{iron} iron scrap",
    "result_share": "Your share {pct}% - repaired {repair}", "result_streak": "Night streak {streak}: +{bonus}% rewards",
    "result_failed_note": "You keep 25% of the rewards and everything you own. Try again tomorrow night!",
}
ERRORS = {
    "ads_disabled": "That isn't available.", "ads_not_allowed": "That isn't available.", "already_casting": "Your line is already out.",
    "already_claimed": "Already claimed.", "already_owned": "You already own this.", "already_used_today": "Already used today.",
    "bad_args": "Something went wrong.", "bad_intent": "Something went wrong.", "bad_limit": "Pick one of the limits.", "bad_materials": "Something went wrong.",
    "bad_plot": "Something went wrong.", "bad_role": "Something went wrong.", "bad_seq": "Something went wrong.", "bad_tap": "Something went wrong.",
    "bad_tier": "Something went wrong.", "bad_track": "Something went wrong.", "confirmation_failed": "The code didn't match.",
    "gem_debt": "Gems from a refunded purchase must be repaid first.", "harbor_busy": "The harbor is busy. Try again.",
    "level_too_low": "Reach a higher level first.", "max_plots": "All plots unlocked.", "no_cast": "Cast first.",
    "no_free_slot": "No free active slot.", "no_recent_sale": "Sell something first.", "no_reward": "Nothing here.", "not_allowed": "Not allowed.",
    "not_complete": "Not finished yet.", "not_configured": "This item isn't on sale yet.", "not_enough_gems": "Not enough Gems.",
    "not_enough_materials": "Not enough materials.", "not_enough_silver": "Not enough Silver.", "not_loaded": "Still loading...",
    "not_owned": "You don't have that.", "not_ready": "Not ready yet.", "not_subscribed": "For Harbor Club members.",
    "nothing_ready": "Nothing is ready.", "nothing_to_collect": "Nothing to collect yet.", "nothing_to_contribute": "Choose some materials.",
    "nothing_to_sell": "Nothing to sell.", "pass_not_owned": "Unlock the paid track first.", "plot_busy": "Something is growing there.",
    "plot_empty": "Plant something first.", "random_items_restricted": "Not available in your region.", "role_locked": "Roles are locked.",
    "role_switch_cooldown": "You can switch this Drifter's role again next cycle.", "server_only": "Something went wrong.",
    "silver_debt": "Repay refunded Silver first.", "slow_down": "Slow down a little.", "spend_limit": "That would go over your monthly limit.",
    "storage_full": "Drifter storage is full.", "storage_maxed": "Storage is at the maximum.", "store_locked": "The shop opens after your first night.",
    "tier_locked": "Reach that tier first.", "too_early": "Too early.", "too_many_decorations": "Too many decorations placed.",
    "too_much_at_once": "That's a lot! Give a bit less at once.", "unknown_action": "Something went wrong.", "unknown_building": "Something went wrong.",
    "unknown_command": "Unknown command.", "unknown_crop": "Something went wrong.", "unknown_intent": "Something went wrong.",
    "unknown_item": "Something went wrong.", "unknown_node": "Something went wrong.", "unknown_product": "Something went wrong.",
    "unknown_quest": "Something went wrong.", "unknown_rod": "Something went wrong.", "network": "Connection problem. Try again.",
    "no_food": "Catch a fish or harvest a crop to feed your Drifters.",
    "already_reversed": "Already refunded.", "unknown_purchase": "Purchase not found.", "record_expired": "Purchase record is too old.",
}
NAMES = {
    "fish_golden_snapper": "Golden Harbor Snapper",
    "rod_driftwood": "Driftwood Rod", "rod_reed": "Reed Rod", "rod_bronze": "Bronze Rod", "rod_tidesteel": "Tidesteel Rod",
    "crop_sea_lettuce": "Sea Lettuce", "crop_kelp_bean": "Kelp Bean", "crop_glow_berry": "Glow Berry", "crop_tide_pumpkin": "Tide Pumpkin",
    "gems_handful": "Handful of Gems ({gems})", "gems_pouch": "Pouch of Gems ({gems})", "gems_chest": "Chest of Gems ({gems})",
    "gems_hoard": "Hoard of Gems ({gems})", "gems_vault": "Vault of Gems ({gems})", "starter_pack": "Starter Pack", "cosmetic_crate": "Tidecomb Crate",
    "harbor_pass": "Harbor Pass", "harbor_club": "Harbor Club", "storage_pass": "Storage Pass", "gem_crate": "Tidecomb Crate",
    "storage_pack_20": "+20 Drifter storage",
    "season_kelp_bloom": "Kelp Bloom", "season_ember_tide": "Ember Tide", "season_frostmoon": "Frostmoon", "season_pearl_drift": "Pearl Drift",
    "season_stormwatch": "Stormwatch", "season_lantern_festival": "Lantern Festival",
    "q_catch_fish": "Catch {target} fish", "q_harvest": "Harvest {target} crops", "q_forage": "Gather {target} times on the shore",
    "q_sell": "Earn {target} Silver at the market", "q_hatch": "Hatch an egg", "q_survive_night": "Survive a night",
    "q_repair": "Repair {target} health at night", "q_feed": "Feed your Drifters {target} times", "q_contribute": "Give {target} materials to the harbor",
    "w_survive_nights": "Survive {target} nights this week",
    "qp_hello": "Hello!", "qp_thanks": "Thanks!", "qp_good_job": "Good job!", "qp_help_lighthouse": "Help at the lighthouse!",
    "qp_help_seawall": "Help at the seawall!", "qp_help_dock": "Help at the dock!", "qp_repairing": "I'm repairing.", "qp_on_my_way": "On my way!",
    "qp_boss_weak_point": "Hit a weak point!", "qp_ready": "Ready!", "qp_wait": "Wait!", "qp_nice_catch": "Nice catch!", "qp_lets_go": "Let's go!",
    "qp_well_played": "Well played!", "qp_goodnight": "Good night!", "qp_follow_me": "Follow me!",
    "report_unkind_name": "Unkind name", "report_cheating": "Cheating", "report_griefing": "Spoiling the game", "report_other": "Something else",
}

def title(identifier):
    for prefix in ["fish_", "drf_", "trait_", "skin_", "deco_", "rodskin_", "emote_", "crop_", "rod_"]:
        if identifier.startswith(prefix):
            identifier = identifier[len(prefix):]
    return " ".join(w.capitalize() for w in identifier.split("_"))

rows = dict(UI)
for k, v in ERRORS.items():
    rows["err_" + k] = v
content = set()
for f in cfg["day"]["fishing"]["fish"]: content.add(f["id"])
for s in cfg["drifters"]["species"]: content.add(s["id"])
for t in cfg["drifters"]["traits"]: content.add(t["id"])
for p in cfg["catalog"]["products"]: content.add(p["id"])
for g in cfg["catalog"]["gemItems"]: content.add(g["id"])
for c in cfg["catalog"]["crates"]:
    for i in c["items"]: content.add(i["id"])
for track in ["freeTrack", "paidTrack"]:
    for r in cfg["catalog"]["harborPass"][track]:
        for c in r.get("cosmetics", []): content.add(c)
for c in cfg["catalog"]["harborClub"]["monthlyCosmetics"]: content.add(c)
for p in cfg["catalog"]["products"]:
    for c in p.get("grants", {}).get("cosmetics", []): content.add(c)
for s in cfg["harbor"]["seasons"]["list"]: content.add(s["id"])
for q in cfg["harbor"]["quests"]["pool"]: content.add(q["id"])
content.add(cfg["harbor"]["quests"]["weekly"]["id"])
for x in cfg["compliance"]["quickPhrases"] + cfg["compliance"]["emotes"] + cfg["compliance"]["reportReasons"]: content.add(x)
for r in cfg["day"]["fishing"]["rods"]: content.add(r["id"])
for c in cfg["day"]["farming"]["crops"]: content.add(c["id"])
content.add(cfg["day"]["fishing"]["onboardingFish"]["id"])
for k in sorted(content):
    rows.setdefault(k, NAMES.get(k, title(k)))

out = os.path.join(ROOT, "src", "Localization", "strings.csv")
with open(out, "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["Key", "Source", "Context", "Example", "en"])
    for k in sorted(rows):
        w.writerow([k, rows[k], "", "", rows[k]])
print("wrote", len(rows), "strings to", os.path.relpath(out, ROOT))
