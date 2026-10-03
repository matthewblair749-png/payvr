--[[
	Semantic config checks that JSON Schema cannot express: cross references, counts,
	and the fairness rules (nothing sold for Robux may grant power, drop rates, or soft currency).
	CI checks the shapes with JSON Schema (shared/schemas); live servers run this on every remote config push.
]]

local ConfigValidator = {}

local RARITIES = { "common", "uncommon", "rare", "epic", "legendary" }
local COSMETIC_PREFIXES = { "skin_", "deco_", "rodskin_", "emote_" }
local MATERIALS = { driftwood = true, shells = true, ironScrap = true }

function ConfigValidator.isCosmeticId(id: any): boolean
	if type(id) ~= "string" then
		return false
	end
	for _, prefix in COSMETIC_PREFIXES do
		if string.sub(id, 1, #prefix) == prefix then
			return true
		end
	end
	return false
end

local function uniqueIds(list: { any }, label: string, errors: { string })
	local seen = {}
	for _, item in list do
		if seen[item.id] then
			table.insert(errors, "duplicate " .. label .. " id " .. tostring(item.id))
		end
		seen[item.id] = true
	end
end

local function rarityRank(r: string): number
	return table.find(RARITIES, r) or 0
end

function ConfigValidator.validate(c: any): { string }
	local e: { string } = {}
	local function check(cond: any, msg: string)
		if not cond then
			table.insert(e, msg)
		end
	end

	-- cycle
	check(c.cycle.streakBonusCap >= c.cycle.streakBonusPerNight, "cycle.streakBonusCap must be >= streakBonusPerNight")
	check(c.cycle.daySeconds > 0 and c.cycle.nightSeconds > 0, "cycle day and night must be positive")

	-- day
	local fishing = c.day.fishing
	local tiers = {}
	for _, rod in fishing.rods do
		check(rod.minWaitSeconds <= rod.maxWaitSeconds, "rod " .. rod.id .. " has minWait > maxWait")
		check(rod.zoneHalfWidthSeconds * 2 <= fishing.minigameSeconds, "rod " .. rod.id .. " zone is wider than the minigame")
		check(not tiers[rod.tier], "rod tiers must be unique")
		tiers[rod.tier] = true
	end
	for tier in tiers do
		for _, rarity in RARITIES do
			local n = 0
			for _, f in fishing.fish do
				if f.tier == tier and f.rarity == rarity then
					n += 1
				end
			end
			check(n == 1, ("fish table needs exactly one %s fish for tier %d"):format(rarity, tier))
		end
	end
	uniqueIds(fishing.fish, "fish", e)
	local farming = c.day.farming
	local extra = farming.maxPlots - farming.startPlots
	check(extra >= 0, "farming.maxPlots must be >= startPlots")
	check(#farming.extraPlotPrices == extra, "farming.extraPlotPrices needs " .. extra .. " entries")
	check(#farming.extraPlotLevels == extra, "farming.extraPlotLevels needs " .. extra .. " entries")
	uniqueIds(farming.crops, "crop", e)
	for _, n in c.day.foraging.nodes do
		check(n.yieldMin <= n.yieldMax, "forage node " .. n.id .. " has yieldMin > yieldMax")
		check(MATERIALS[n.material], "forage node " .. n.id .. " has unknown material")
	end
	uniqueIds(c.day.foraging.nodes, "forage node", e)

	-- economy
	local econ = c.economy
	local prevLevel, prevSlots = 0, 0
	for _, u in econ.activeSlotUnlocks do
		check(u.level > prevLevel and u.slots > prevSlots, "activeSlotUnlocks must increase in level and slots")
		prevLevel, prevSlots = u.level, u.slots
	end
	check(econ.activeSlotUnlocks[1] and econ.activeSlotUnlocks[1].level == 1, "activeSlotUnlocks must start at level 1")
	check(prevSlots <= c.drifters.maxActiveSlots, "activeSlotUnlocks exceed drifters.maxActiveSlots")
	check(econ.storage.cap <= c.drifters.storageMax, "economy.storage.cap exceeds drifters.storageMax")
	check(
		econ.storage.base + econ.storage.upgradeAmount * #econ.storage.upgradePricesSilver >= econ.storage.cap,
		"free storage upgrades must be able to reach the storage cap"
	)
	check(econ.happiness.outputMinMultiplier <= econ.happiness.outputMaxMultiplier, "happiness output min > max")

	-- drifters
	local d = c.drifters
	local beaten = {}
	for _, el in d.elements do
		check(d.elementBeats[el] ~= nil, "elementBeats missing " .. el)
		if d.elementBeats[el] then
			beaten[d.elementBeats[el]] = true
		end
		local n = 0
		for _, s in d.species do
			if s.element == el then
				n += 1
			end
		end
		check(n == 5, "need 5 starter species for element " .. el)
	end
	local beatenCount = 0
	for _ in beaten do
		beatenCount += 1
	end
	check(beatenCount == #d.elements, "elementBeats must form a cycle")
	local shapes, weightSum = {}, 0
	for _, r in d.rarities do
		check(not shapes[r.shape], "each rarity needs a distinct shape for colorblind players")
		shapes[r.shape] = true
		weightSum += r.hatchWeight
	end
	check(weightSum > 0, "hatch weights sum to zero")
	for _, r in RARITIES do
		local found = false
		for _, s in d.species do
			found = found or s.rarity == r
		end
		check(found, "no species with rarity " .. r)
	end
	check(d.pity.epicOrBetterEvery < d.pity.legendaryEvery, "epic pity must trigger before legendary pity")
	uniqueIds(d.species, "species", e)
	uniqueIds(d.traits, "trait", e)
	check(#d.traits == 12, "need 12 traits")
	local onboarding
	for _, s in d.species do
		if s.id == d.onboardingSpeciesId then
			onboarding = s
		end
	end
	check(onboarding and onboarding.rarity == "common", "onboardingSpeciesId must be a common species")

	-- night
	local n = c.night
	local lighthouse
	for _, s in n.structures do
		if s.id == "lighthouse" then
			lighthouse = s
		end
	end
	check(lighthouse and lighthouse.losesNight, "the lighthouse must be the lose condition")
	local share, wave1 = 0, false
	for _, en in n.enemies do
		share += en.spawnShare
		wave1 = wave1 or en.firstWave == 1
	end
	check(math.abs(share - 1) < 1e-6, "enemy spawnShare must sum to 1")
	check(wave1, "at least one enemy type must appear in wave 1")
	check(n.boss.wave <= n.waveCount, "boss wave exceeds waveCount")
	check(n.damageStageThresholds[1] > n.damageStageThresholds[2], "damageStageThresholds must be descending")
	check(n.boss.phaseThresholds[1] > n.boss.phaseThresholds[2], "boss phaseThresholds must be descending")
	check(n.rewards.minShare <= 1 and n.rewards.maxShare >= 1, "reward share bounds must include 1")
	check(n.onboardingNight.waveCount <= n.waveCount, "onboarding night has more waves than a full night")

	-- harbor
	local h = c.harbor
	check(#h.tierCosts == h.maxTier - 1, "harbor.tierCosts needs maxTier - 1 entries")
	for i, cost in h.tierCosts do
		check(cost.toTier == i + 1, "harbor.tierCosts must be ordered toTier 2..maxTier")
	end
	check(#h.quests.pool >= h.quests.dailyCount, "quest pool smaller than dailyCount")

	-- catalog and fairness
	local cat = c.catalog
	local products, crates, gemItems = {}, {}, {}
	for _, cr in cat.crates do
		crates[cr.id] = cr
	end
	for _, g in cat.gemItems do
		gemItems[g.id] = g
	end
	uniqueIds(cat.products, "product", e)
	for _, p in cat.products do
		products[p.id] = p
		check(cat.priceTiers[p.priceTier] ~= nil, "product " .. p.id .. " uses unknown price tier")
		if p.kind == "gems" then
			check((p.gems or 0) > 0, "gem bundle " .. p.id .. " grants no gems")
			check(p.type == "consumable" and p.robloxType == "developerProduct", "gem bundle " .. p.id .. " must be a consumable developer product")
		elseif p.kind == "crate" then
			check(crates[p.crateId] ~= nil, "product " .. p.id .. " references unknown crate")
		elseif p.kind == "subscription" then
			check(p.robloxType == "subscription" and (p.periodDays or 0) > 0, "subscription " .. p.id .. " needs robloxType subscription and periodDays")
		elseif p.kind == "starterPack" or p.kind == "storagePass" then
			check(p.type == "nonConsumable", p.id .. " must be non-consumable")
		end
		if p.grants and p.grants.cosmetics then
			for _, cos in p.grants.cosmetics do
				check(ConfigValidator.isCosmeticId(cos), "product " .. p.id .. " grants non-cosmetic " .. tostring(cos))
			end
		end
	end
	for _, g in cat.gemItems do
		if g.kind == "cosmetic" then
			check(ConfigValidator.isCosmeticId(g.id), "gem item " .. g.id .. " is not a cosmetic id")
		elseif g.kind == "crate" then
			check(crates[g.crateId] ~= nil, "gem item " .. g.id .. " references unknown crate")
		elseif g.kind == "storage" then
			check((g.storageBonus or 0) > 0, "gem item " .. g.id .. " grants no storage")
		end
	end
	for _, cr in cat.crates do
		local hasEpic = false
		for _, r in RARITIES do
			local w = cr.rarityWeights[r] or 0
			local has = false
			for _, item in cr.items do
				has = has or item.rarity == r
			end
			if w > 0 then
				check(has, "crate " .. cr.id .. " has weight for " .. r .. " but no items")
			end
		end
		for _, item in cr.items do
			check(ConfigValidator.isCosmeticId(item.id), "crate " .. cr.id .. " contains non-cosmetic " .. item.id)
			hasEpic = hasEpic or rarityRank(item.rarity) >= rarityRank("epic")
		end
		check(hasEpic, "crate " .. cr.id .. " pity needs epic or legendary items")
	end
	for _, reward in cat.harborPass.paidTrack do
		check(
			(reward.silver or 0) == 0 and (reward.pearls or 0) == 0 and (reward.eggs or 0) == 0 and reward.materials == nil,
			"paid pass tier " .. reward.tier .. " grants gameplay rewards; the paid track must be cosmetics or gems only"
		)
		for _, cos in reward.cosmetics or {} do
			check(ConfigValidator.isCosmeticId(cos), "paid pass tier " .. reward.tier .. " grants non-cosmetic " .. cos)
		end
	end
	for _, track in { cat.harborPass.freeTrack, cat.harborPass.paidTrack } do
		for _, reward in track do
			check(reward.tier >= 1 and reward.tier <= cat.harborPass.tiers, "pass reward tier " .. reward.tier .. " out of range")
		end
	end
	for _, cos in cat.harborClub.monthlyCosmetics do
		check(ConfigValidator.isCosmeticId(cos), "club monthly reward " .. cos .. " is not cosmetic")
	end
	for _, x in cat.experiments do
		check((x.productId == nil) ~= (x.gemItemId == nil), "experiment " .. x.id .. " needs exactly one of productId or gemItemId")
		check(x.productId == nil or products[x.productId] ~= nil, "experiment " .. x.id .. " references unknown product")
		check(x.gemItemId == nil or gemItems[x.gemItemId] ~= nil, "experiment " .. x.id .. " references unknown gem item")
		local hasControl, w = false, 0
		for _, v in x.variants do
			hasControl = hasControl or v.id == "control"
			w += v.weight
			check(v.priceTier == nil or cat.priceTiers[v.priceTier] ~= nil, "experiment " .. x.id .. " variant " .. v.id .. " uses unknown price tier")
		end
		check(hasControl, "experiment " .. x.id .. " needs a control variant")
		check(w > 0, "experiment " .. x.id .. " weights sum to zero")
	end
	for key in cat.planning.buyRates do
		check(products[key] ~= nil, "planning.buyRates references unknown product " .. key)
	end
	local mix = cat.platformFees.platformMix
	check(math.abs(mix.ios + mix.googlePlay - 1) < 1e-6, "platformMix must sum to 1")

	-- compliance
	local seen = {}
	for _, qp in c.compliance.quickPhrases do
		check(not seen[qp], "duplicate quick phrase " .. qp)
		seen[qp] = true
	end

	return e
end

return ConfigValidator
