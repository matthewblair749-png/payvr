"""Generates shared/schemas/*.schema.json. Edit this file, then run: python3 shared/tools/gen-schemas.py"""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "schemas")
S = "https://json-schema.org/draft/2020-12/schema"
num = {"type": "number"}; pos = {"type": "number", "exclusiveMinimum": 0}; nn = {"type": "number", "minimum": 0}
int0 = {"type": "integer", "minimum": 0}; int1 = {"type": "integer", "minimum": 1}; s = {"type": "string", "minLength": 1}
frac = {"type": "number", "minimum": 0, "maximum": 1}; boolean = {"type": "boolean"}
RAR = ["common", "uncommon", "rare", "epic", "legendary"]
rar = {"enum": RAR}; el = {"enum": ["tide", "ember", "moss", "frost"]}; mat = {"enum": ["driftwood", "shells", "ironScrap"]}

def obj(props, req=None):
    return {"type": "object", "properties": props, "required": list(props) if req is None else req, "additionalProperties": False}

def arr(item, mn=0, mx=None):
    a = {"type": "array", "items": item, "minItems": mn}
    if mx is not None: a["maxItems"] = mx
    return a

rar_weights = obj({k: nn for k in RAR})
materials = {"type": "object", "propertyNames": mat, "additionalProperties": int0}
reward = obj({"tier": int1, "silver": int0, "pearls": int0, "gems": int0, "eggs": int0, "materials": materials, "cosmetics": arr(s)}, ["tier"])

schemas = {}
schemas["cycle"] = obj({"daySeconds": int1, "duskSeconds": int0, "nightSeconds": int1, "dawnSeconds": int0,
    "cycleEpochUtc": {"type": "string", "format": "date-time"}, "firstDaySeconds": int1, "nightJoinLateSeconds": int0,
    "offlineCapHours": {"type": "number", "minimum": 0, "maximum": 72}, "failedNightRewardMultiplier": frac,
    "streakBonusPerNight": frac, "streakBonusCap": frac, "roleSwitchesPerCycle": int0})
rod = obj({"id": s, "tier": {"type": "integer", "minimum": 1, "maximum": 4}, "minWaitSeconds": pos, "maxWaitSeconds": pos,
    "zoneHalfWidthSeconds": pos, "priceSilver": int0, "levelRequired": int1})
fish = obj({"id": s, "tier": int1, "rarity": rar, "value": int1})
schemas["day"] = obj({
    "fishing": obj({"minigameSeconds": pos, "perfectHalfWidthSeconds": pos, "perfectXpMultiplier": {"type": "number", "minimum": 1},
        "latencyToleranceSeconds": nn, "abandonAfterSeconds": pos, "rarityWeights": rar_weights, "rods": arr(rod, 4, 4),
        "fish": arr(fish, 20, 20), "onboardingFish": fish}),
    "farming": obj({"startPlots": int1, "maxPlots": int1, "extraPlotPrices": arr(int0), "extraPlotLevels": arr(int1),
        "crops": arr(obj({"id": s, "growSeconds": int1, "seedCost": int0, "sellValue": int0, "levelRequired": int1}), 1)}),
    "foraging": obj({"respawnSeconds": int1, "nodes": arr(obj({"id": s, "material": mat, "yieldMin": int0, "yieldMax": int0}), 1),
        "materialSellValues": obj({"driftwood": int0, "shells": int0, "ironScrap": int0})}),
    "market": obj({"demandSwing": {"type": "number", "minimum": 0, "maximum": 0.5}, "categories": arr({"enum": ["fish", "crops", "materials"]}, 1),
        "sellMaterialsInSellAll": boolean})})
schemas["economy"] = obj({"startingSilver": int0, "eggPriceSilver": int1,
    "playerLevel": obj({"maxLevel": int1, "xpBase": pos, "xpLinear": nn, "xpExponent": pos}),
    "xpRewards": {"type": "object", "additionalProperties": int0},
    "activeSlotUnlocks": arr(obj({"level": int1, "slots": int1}), 1),
    "storage": obj({"base": int1, "cap": int1, "upgradeAmount": int1, "upgradePricesSilver": arr(int0)}),
    "happiness": obj({"start": {"type": "integer", "minimum": 0, "maximum": 100}, "decayPerHour": nn, "feedGain": nn,
        "outputMinMultiplier": pos, "outputMaxMultiplier": pos}),
    "drifterLevel": obj({"maxLevel": int1, "xpBase": pos, "xpExponent": pos, "statGrowthPerLevel": nn, "feedXpPerSilverValue": nn}),
    "worker": obj({"silverPerIncomePointPerMinute": nn, "pendingCapHours": pos}),
    "catchUp": obj({"underTotalHours": nn, "nightPowerBonus": frac}),
    "milestonePearls": arr(obj({"level": int1, "pearls": int0}))})
schemas["drifters"] = obj({"elements": arr(el, 4, 4), "elementBeats": obj({k: el for k in ["tide", "ember", "moss", "frost"]}),
    "advantageMultiplier": pos, "disadvantageMultiplier": pos,
    "rarities": arr(obj({"id": rar, "hatchWeight": nn, "statMultiplier": pos, "shape": s, "color": {"type": "string", "pattern": "^#[0-9A-Fa-f]{6}$"}}), 5, 5),
    "pity": obj({"epicOrBetterEvery": int1, "legendaryEvery": int1}), "maxActiveSlots": int1, "storageMax": int1,
    "species": arr(obj({"id": s, "element": el, "rarity": rar, "power": pos, "speed": pos, "income": pos}), 20),
    "onboardingSpeciesId": s,
    "traits": arr(obj({"id": s, "incomePct": num, "powerPct": num, "speedPct": num, "happinessDecayPct": num, "repairPct": num, "xpPct": num}, ["id"]), 12)})
struct = obj({"id": {"enum": ["lighthouse", "seawall", "dock"]}, "maxHp": int1, "x": num, "y": num, "radius": pos, "losesNight": boolean, "repairable": boolean})
enemy = obj({"id": {"enum": ["crawler", "brute", "spitter"]}, "hp": pos, "speed": pos, "damage": nn, "attackInterval": pos, "range": pos,
    "radius": pos, "firstWave": int1, "spawnShare": frac, "targets": arr({"enum": ["lighthouse", "seawall", "dock"]}, 1)})
ability = obj({"radius": pos, "damageMultiplier": nn, "knockback": nn, "slowPct": {"type": "number", "minimum": 0, "maximum": 90}, "slowSeconds": nn, "healStructure": nn})
schemas["night"] = obj({"tickRate": {"type": "integer", "minimum": 5, "maximum": 60}, "introSeconds": nn, "waveCount": {"type": "integer", "minimum": 1, "maximum": 12},
    "waveSeconds": pos, "breakSeconds": nn, "maxSquadSize": {"type": "integer", "minimum": 1, "maximum": 5}, "maxSquadsPerRoom": {"type": "integer", "minimum": 1, "maximum": 4},
    "enemyCountBase": nn, "enemyCountGrowth": nn, "enemyCountPerSquadMember": nn, "enemyHealthGrowthPerWave": nn, "spawnSpreadSeconds": nn,
    "sector": obj({"width": pos, "height": pos, "spawnY": num, "seawallY": num, "playerMaxY": num}),
    "structures": arr(struct, 3, 3), "damageStageThresholds": arr(frac, 2, 2),
    "repair": obj({"range": pos, "intervalSeconds": pos, "hpPerInterval": pos, "ironScrapPerInterval": int0}),
    "enemies": arr(enemy, 3, 3),
    "player": obj({k: nn for k in ["moveSpeed", "speedPerSpeedPoint", "basePower", "supportGuardianShare", "attackRange", "attackArcDegrees",
        "attackCooldown", "chargeSeconds", "chargedRadius", "chargedMultiplier", "abilityCooldown", "stunSeconds", "knockback"]}),
    "abilities": obj({k: ability for k in ["tide", "ember", "moss", "frost"]}),
    "boss": obj({"id": s, "enabled": boolean, "wave": int1, "baseHp": pos, "hpPerSquadMember": nn, "x": num, "y": num, "radius": pos,
        "phaseThresholds": arr(frac, 2, 2), "telegraphRadius": pos, "telegraphWarningSeconds": pos, "telegraphIntervalSeconds": arr(pos, 3, 3),
        "telegraphCount": arr(int1, 3, 3), "telegraphStructureDamage": nn, "shieldDamageTaken": frac, "weakPointWindowSeconds": pos,
        "weakPointRetrySeconds": nn, "weakPointHitRange": pos, "stunSeconds": nn, "stunnedDamageTaken": pos}),
    "rewards": obj({"silverPerWave": int0, "materialsPerWave": materials, "passXpPerWave": int0, "bossSilver": int0, "bossPearls": int0,
        "contribution": obj({"damagePoint": nn, "repairHpPoint": nn, "weakPointHit": nn}), "contributionWeight": frac, "minShare": nn, "maxShare": pos}),
    "onboardingNight": obj({"waveCount": int1, "boss": boolean, "enemyHealthMultiplier": pos, "enemyCountMultiplier": pos}),
    "smuggler": obj({"enabled": boolean, "minOptIns": {"type": "integer", "minimum": 2}, "crates": int1, "timeLimitSeconds": pos, "pickupRange": pos,
        "deliverRange": pos, "inspectChannelSeconds": pos, "inspectRange": pos, "inspectBreakRange": pos, "smugglerSuccessSilver": int0, "catchSilver": int0}),
    "quickChatPerSecond": pos})
schemas["harbor"] = obj({
    "assetPackageId": int0,
    "buildings": arr(obj({"id": {"enum": ["lighthouse", "market", "docks", "seawall", "workshop"]}, "perk": s, "perPerTier": num}), 5, 5),
    "maxTier": int1, "tierCosts": arr(obj({"toTier": int1, "driftwood": int0, "shells": int0, "ironScrap": int0})),
    "maxContributionPerRequest": int1,
    "seasons": obj({"anchorUtcDate": {"type": "string", "format": "date"}, "lengthDays": int1,
        "list": arr(obj({"id": s, "modifiers": {"type": "object", "additionalProperties": num}}), 1)}),
    "quests": obj({"dailyCount": int1,
        "pool": arr(obj({"id": s, "type": s, "target": int1, "silver": int0, "passXp": int0, "pearls": int0}, ["id", "type", "target"]), 1),
        "weekly": obj({"id": s, "type": s, "target": int1, "silver": int0, "passXp": int0, "pearls": int0}, ["id", "type", "target"])}),
    "loginStreak": arr(obj({"day": int1, "silver": int0, "pearls": int0}, ["day"]), 1),
    "notifications": obj({"maxPerDay": int0, "quietStartHour": {"type": "integer", "minimum": 0, "maximum": 23},
        "quietEndHour": {"type": "integer", "minimum": 0, "maximum": 23},
        "types": arr(obj({"id": {"enum": ["crops_ready", "worker_income_full", "night_starting", "season_changed"]}, "priority": int1}), 4, 4)})})
product = obj({"id": s, "kind": {"enum": ["gems", "starterPack", "crate", "pass", "subscription", "storagePass"]},
    "type": {"enum": ["consumable", "nonConsumable", "subscription"]},
    "robloxType": {"enum": ["developerProduct", "gamePass", "subscription"]}, "robloxId": {"anyOf": [int0, {"type": "string", "pattern": "^EXP-[0-9]+$"}]},
    "priceTier": s, "gems": int1, "crateId": s, "periodDays": int1,
    "grants": obj({"eggs": int0, "cosmetics": arr(s), "storageBonus": int0, "autoCollect": boolean}, [])},
    ["id", "kind", "type", "robloxType", "robloxId", "priceTier"])
variant = obj({"id": s, "weight": nn, "robloxId": {"anyOf": [int0, {"type": "string", "pattern": "^EXP-[0-9]+$"}]}, "priceTier": s, "gems": int1}, ["id", "weight"])
schemas["catalog"] = obj({"catalogVersion": int1,
    "priceTiers": {"type": "object", "additionalProperties": obj({"usd": pos})},
    "products": arr(product, 1),
    "gemItems": arr(obj({"id": s, "gems": int1, "kind": {"enum": ["crate", "cosmetic", "storage"]}, "crateId": s, "cosmeticClass": s, "storageBonus": int1},
        ["id", "gems", "kind"]), 1),
    "crates": arr(obj({"id": s, "rarityWeights": rar_weights, "pityEpicOrBetterEvery": int1, "duplicateGems": obj({k: int0 for k in RAR}),
        "items": arr(obj({"id": s, "rarity": rar, "cosmeticClass": {"enum": ["drifterSkin", "decoration", "rodSkin", "emote"]}}), 1)}), 1),
    "harborPass": obj({"blockDays": int1, "anchorUtcDate": {"type": "string", "format": "date"}, "tiers": int1, "xpPerTier": int1,
        "freeTrack": arr(reward), "paidTrack": arr(reward)}),
    "harborClub": obj({"dailyGems": int0, "storageBonus": int0, "autoCollect": boolean, "monthlyCosmetics": arr(s, 1)}),
    "experiments": arr(obj({"id": s, "enabled": boolean, "productId": s, "gemItemId": s, "variants": arr(variant, 2)}, ["id", "enabled", "variants"])),
    "spendControls": obj({"limitOptionsRobux": arr(int0, 1), "defaultLimitRobux": {"anyOf": [int0, {"type": "null"}]}}),
    "rewardedAds": obj({"enabled": boolean, "placement": {"const": "double_market_sale"}, "perDay": {"type": "integer", "minimum": 0, "maximum": 1}, "robloxRewardProductId": int0}),
    "platformFees": obj({"ios": obj({"commissionRate": frac, "smallBusinessProgram": boolean}),
        "googlePlay": obj({"rateUnderThreshold": frac, "thresholdUsdPerYear": nn, "rateOverThreshold": frac, "subscriptionRate": frac}),
        "platformMix": obj({"ios": frac, "googlePlay": frac})}),
    "roblox": obj({"usdPerRobux": pos, "platformFee": frac, "devExUsdPerRobux": pos, "subscriptionKeepRate": frac, "companionBackendMonthlyUsd": nn, "marketingMonthlyUsd": nn}),
    "standalone": obj({"backendCostMonthlyUsd": nn}),
    "planning": obj({"dailyPlayers": nn, "marketingMonthlyUsd": nn, "premiumPayoutsPerDailyPlayerMonthlyUsd": nn,
        "buyRates": {"type": "object", "additionalProperties": frac}})})
schemas["compliance"] = obj({"quickPhrases": arr(s, 1), "emotes": arr(s, 1), "reportReasons": arr(s, 1),
    "disableFreeTextChat": {"const": True}, "respectPaidRandomItemsPolicy": {"const": True},
    "rateLimits": obj({"intentsPerSecond": pos, "intentBurst": int1, "purchasePromptsPerMinute": int1, "violationsBeforeKick": int1})})

for name, schema in schemas.items():
    doc = {"$schema": S, "$id": f"https://tidebound.game/schemas/{name}.schema.json", "title": f"Tidebound {name} config", **schema}
    with open(os.path.join(OUT, f"{name}.schema.json"), "w") as f:
        json.dump(doc, f, indent=2)
        f.write("\n")
print("wrote", len(schemas), "schemas")
