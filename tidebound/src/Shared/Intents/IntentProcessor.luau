--[[
	The only way a player's save changes during the day. Clients send intents (what the player wants to do);
	the server validates each one (schema, ranges, ownership, cooldowns, game state) and applies it here.
	The client runs the same code for instant feedback on actions that involve no randomness,
	then adopts the server's state when the reply arrives.

	ctx = {
	  cfg, now, rng, userId,
	  mods,          -- Modifiers.current(...)
	  cycleIndex,    -- Cycle.at(cfg, now).cycleIndex
	  adsAllowed,    -- PolicyService + age eligibility; false when unknown
	}
	Returns { ok = boolean, err = string?, data = any, events = { { name, props } } }.
]]

local Validate = require(script.Parent.Parent.Util.Validate)
local Fishing = require(script.Parent.Parent.Rules.Fishing)
local Farming = require(script.Parent.Parent.Rules.Farming)
local Foraging = require(script.Parent.Parent.Rules.Foraging)
local Market = require(script.Parent.Parent.Rules.Market)
local Drifters = require(script.Parent.Parent.Rules.Drifters)
local Hatchery = require(script.Parent.Parent.Rules.Hatchery)
local Progression = require(script.Parent.Parent.Rules.Progression)
local TimeSim = require(script.Parent.Parent.Rules.TimeSim)
local Cycle = require(script.Parent.Parent.Rules.Cycle)
local Harbor = require(script.Parent.Parent.Rules.Harbor)
local Onboarding = require(script.Parent.Parent.Onboarding)
local Ledger = require(script.Parent.Parent.Store.Ledger)
local Pass = require(script.Parent.Parent.Store.Pass)
local Club = require(script.Parent.Parent.Store.Club)
local GemShop = require(script.Parent.Parent.Store.GemShop)
local Spending = require(script.Parent.Parent.Store.Spending)
local ConfigValidator = require(script.Parent.Parent.ConfigValidator)

local IntentProcessor = {}

-- Intents the client may predict locally (no randomness, no shared state).
IntentProcessor.PREDICTABLE = {
	plant = true,
	harvest = true,
	harvestAll = true,
	sellAll = true,
	setRole = true,
	setActive = true,
	feed = true,
	collectWorkers = true,
	equipRod = true,
	equipCosmetic = true,
	setSetting = true,
}

local function ok(data: any?, events: { any }?)
	return { ok = true, data = data, events = events or {} }
end

local function fail(err: string)
	return { ok = false, err = err, events = {} }
end

local function award(ctx: any, save: any, events: { any }, xp: number, passXp: number)
	for _, e in Progression.addXp(ctx.cfg, save, xp) do
		table.insert(events, e)
	end
	if passXp > 0 then
		local before = Pass.tier(ctx.cfg, save)
		Pass.addXp(ctx.cfg, save, passXp, ctx.now)
		local after = Pass.tier(ctx.cfg, save)
		if after > before then
			table.insert(events, { name = "pass_tier_reached", props = { tier = after } })
		end
	end
end

local function onboardingStep(save: any, step: string, now: number, events: { any })
	local e = Onboarding.complete(save, step, now)
	if e then
		table.insert(events, e)
	end
end

local handlers: { [string]: (ctx: any, save: any, args: any) -> any } = {}

-- ------------------------------------------------------------------ fishing

handlers.cast = function(ctx, save, _args)
	local data, err = Fishing.start(ctx.cfg, save, ctx.now, ctx.rng, ctx.mods)
	if not data then
		return fail(err)
	end
	return ok(data)
end

handlers.reel = function(ctx, save, args)
	if not Validate.int(args.castId, 1, 1e12) or not Validate.number(args.tap, 0, 10) then
		return fail("bad_args")
	end
	local result, err = Fishing.resolve(ctx.cfg, save, args.castId, args.tap, ctx.now)
	if not result then
		return fail(err)
	end
	local events = {}
	if result.caught then
		Progression.record(ctx.cfg, save, "fishCaught", 1, ctx.now)
		local xp = ctx.cfg.economy.xpRewards.fishCaught
		if result.perfect then
			xp *= ctx.cfg.day.fishing.perfectXpMultiplier
		end
		award(ctx, save, events, xp, 1)
		if result.onboarding then
			onboardingStep(save, "first_cast", ctx.now, events)
		end
	end
	return ok(result, events)
end

handlers.buyRod = function(ctx, save, args)
	if not Validate.int(args.tier, 1, 4) then
		return fail("bad_args")
	end
	local err = Fishing.buyRod(ctx.cfg, save, args.tier)
	return if err then fail(err) else ok()
end

handlers.equipRod = function(_ctx, save, args)
	if not Validate.int(args.tier, 1, 4) then
		return fail("bad_args")
	end
	local err = Fishing.equipRod(save, args.tier)
	return if err then fail(err) else ok()
end

-- ------------------------------------------------------------------ farming and foraging

handlers.plant = function(ctx, save, args)
	if not Validate.int(args.plot, 1, ctx.cfg.day.farming.maxPlots) or not Validate.id(args.crop) then
		return fail("bad_args")
	end
	local err = Farming.plant(ctx.cfg, save, args.plot, args.crop, ctx.now)
	return if err then fail(err) else ok()
end

handlers.harvest = function(ctx, save, args)
	if not Validate.int(args.plot, 1, ctx.cfg.day.farming.maxPlots) then
		return fail("bad_args")
	end
	local cropId, err = Farming.harvest(ctx.cfg, save, args.plot, ctx.now, ctx.mods)
	if not cropId then
		return fail(err)
	end
	local events = {}
	Progression.record(ctx.cfg, save, "cropHarvested", 1, ctx.now)
	award(ctx, save, events, ctx.cfg.economy.xpRewards.cropHarvested, 1)
	return ok({ cropId = cropId }, events)
end

handlers.harvestAll = function(ctx, save, _args)
	local count = 0
	for i in save.plots do
		local cropId = Farming.harvest(ctx.cfg, save, i, ctx.now, ctx.mods)
		if cropId then
			count += 1
		end
	end
	if count == 0 then
		return fail("nothing_ready")
	end
	local events = {}
	Progression.record(ctx.cfg, save, "cropHarvested", count, ctx.now)
	award(ctx, save, events, ctx.cfg.economy.xpRewards.cropHarvested * count, count)
	return ok({ count = count }, events)
end

handlers.buyPlot = function(ctx, save, _args)
	local err = Farming.buyPlot(ctx.cfg, save)
	return if err then fail(err) else ok({ plots = #save.plots })
end

handlers.forage = function(ctx, save, args)
	if not Validate.id(args.node) then
		return fail("bad_args")
	end
	local material, amountOrErr = Foraging.harvest(ctx.cfg, save, args.node, ctx.now, ctx.rng, ctx.mods)
	if not material then
		return fail(amountOrErr)
	end
	local events = {}
	Progression.record(ctx.cfg, save, "forage", 1, ctx.now)
	award(ctx, save, events, ctx.cfg.economy.xpRewards.forage, 1)
	return ok({ material = material, amount = amountOrErr }, events)
end

-- ------------------------------------------------------------------ market

handlers.sellAll = function(ctx, save, _args)
	local result = Market.sellAll(ctx.cfg, save, ctx.now, ctx.mods)
	if result.silver <= 0 then
		return fail("nothing_to_sell")
	end
	Ledger.addCurrency(save, "silver", result.silver)
	local events = {}
	Progression.record(ctx.cfg, save, "silverFromSales", result.silver, ctx.now)
	if (save.stats.fishCaught or 0) > 0 then
		onboardingStep(save, "sell_fish", ctx.now, events)
	end
	return ok(result, events)
end

handlers.adDoubleSale = function(ctx, save, _args)
	local err = Market.canDoubleWithAd(ctx.cfg, save, ctx.now, ctx.adsAllowed == true)
	if err then
		return fail(err)
	end
	-- Called by the server only after Roblox reports the rewarded ad was watched.
	local Time = require(script.Parent.Parent.Util.Time)
	save.market.adDateKey = Time.dateKey(ctx.now)
	local bonus = save.market.lastSaleValue
	Ledger.addCurrency(save, "silver", bonus)
	return ok({ silver = bonus }, { { name = "rewarded_ad_completed", props = { placement = "double_market_sale", silver = bonus } } })
end

-- ------------------------------------------------------------------ drifters

handlers.hatch = function(ctx, save, _args)
	local cfg = ctx.cfg
	local usedEgg = save.hatch.eggs > 0
	if not usedEgg and save.currencies.silver < cfg.economy.eggPriceSilver then
		return fail("not_enough_silver")
	end
	if not usedEgg and (save.debt.silver or 0) > 0 then
		return fail("silver_debt")
	end
	local opts = nil
	if Onboarding.active(save) and save.hatch.total == 0 then
		opts = { guaranteedSpeciesId = cfg.drifters.onboardingSpeciesId }
	end
	local drifter, info = Hatchery.hatch(cfg, save, ctx.rng, ctx.now, opts)
	if not drifter then
		return fail(info)
	end
	if usedEgg then
		save.hatch.eggs -= 1
	else
		save.currencies.silver -= cfg.economy.eggPriceSilver
	end
	local events = {}
	Progression.record(cfg, save, "hatch", 1, ctx.now)
	award(ctx, save, events, cfg.economy.xpRewards.hatch, 5)
	if info.first then
		table.insert(events, { name = "first_hatch", props = { speciesId = drifter.speciesId, rarity = info.rarity, seconds = math.floor(ctx.now - save.createdAt) } })
	end
	table.insert(events, { name = "drifter_hatched", props = { speciesId = drifter.speciesId, rarity = info.rarity, pity = info.pity, usedEgg = usedEgg } })
	onboardingStep(save, "hatch_egg", ctx.now, events)
	return ok({ drifter = drifter, rarity = info.rarity, pity = info.pity, newSpecies = info.newSpecies }, events)
end

handlers.setRole = function(ctx, save, args)
	if not Validate.id(args.drifter) or not Validate.oneOf(args.role, { "worker", "guardian" }) then
		return fail("bad_args")
	end
	local err = Drifters.setRole(ctx.cfg, save, args.drifter, args.role, ctx.cycleIndex)
	if err then
		return fail(err)
	end
	local events = {}
	if Onboarding.active(save) and save.onboarding.step == Onboarding.index("hatch_egg") then
		onboardingStep(save, "assign_role", ctx.now, events)
		-- The gentle countdown to the reduced first night starts now.
		save.onboarding.done = true
		save.onboarding.firstNightAt = Cycle.firstNightAt(ctx.cfg, ctx.now)
		onboardingStep(save, "countdown", ctx.now, events)
	end
	return ok(nil, events)
end

handlers.setActive = function(ctx, save, args)
	if not Validate.id(args.drifter) or not Validate.bool(args.active) then
		return fail("bad_args")
	end
	local err = Drifters.setActive(ctx.cfg, save, args.drifter, args.active)
	return if err then fail(err) else ok()
end

handlers.feed = function(ctx, save, args)
	if not Validate.id(args.drifter) or not Validate.id(args.item) then
		return fail("bad_args")
	end
	local d = Drifters.find(save, args.drifter)
	if not d then
		return fail("not_owned")
	end
	local value
	if (save.fish[args.item] or 0) > 0 then
		value = ctx.cfg.index.fish[args.item].value
		save.fish[args.item] -= 1
	elseif (save.crops[args.item] or 0) > 0 then
		value = ctx.cfg.index.crops[args.item].sellValue
		save.crops[args.item] -= 1
	else
		return fail("not_owned")
	end
	local levels = Drifters.feed(ctx.cfg, d, value)
	Progression.record(ctx.cfg, save, "feed", 1, ctx.now)
	return ok({ levels = levels, level = d.level, happiness = d.happiness })
end

handlers.collectWorkers = function(_ctx, save, _args)
	local amount = TimeSim.collect(save)
	if amount <= 0 then
		return fail("nothing_to_collect")
	end
	return ok({ silver = amount })
end

handlers.upgradeStorage = function(ctx, save, _args)
	local s = ctx.cfg.economy.storage
	local i = save.storageUpgrades + 1
	if i > #s.upgradePricesSilver or Drifters.storageCapacity(ctx.cfg, save) >= s.cap then
		return fail("storage_maxed")
	end
	if save.currencies.silver < s.upgradePricesSilver[i] then
		return fail("not_enough_silver")
	end
	save.currencies.silver -= s.upgradePricesSilver[i]
	save.storageUpgrades = i
	return ok({ capacity = Drifters.storageCapacity(ctx.cfg, save) })
end

-- ------------------------------------------------------------------ progression and rewards

handlers.claimQuest = function(ctx, save, args)
	if not Validate.id(args.quest) then
		return fail("bad_args")
	end
	local entries, passXpOrErr = Progression.claimQuest(ctx.cfg, save, args.quest, ctx.now)
	if not entries then
		return fail(passXpOrErr)
	end
	Ledger.apply(save, entries)
	local events = { { name = "quest_completed", props = { questId = args.quest } } }
	award(ctx, save, events, ctx.cfg.economy.xpRewards.questCompleted, passXpOrErr)
	return ok({ entries = entries }, events)
end

handlers.claimPass = function(ctx, save, args)
	if not Validate.oneOf(args.track, { "free", "paid" }) or not Validate.int(args.tier, 1, 100) then
		return fail("bad_args")
	end
	local entries, purchaseIdOrErr = Pass.claim(ctx.cfg, save, args.track, args.tier, ctx.now)
	if not entries then
		return fail(purchaseIdOrErr)
	end
	Ledger.apply(save, entries)
	if args.track == "paid" and type(purchaseIdOrErr) == "string" then
		Ledger.attach(save, purchaseIdOrErr, entries)
	end
	return ok({ entries = entries }, { { name = "pass_tier_claimed", props = { track = args.track, tier = args.tier, blockId = save.pass.blockId } } })
end

handlers.claimClubDaily = function(ctx, save, _args)
	local entries, err = Club.claimDaily(ctx.cfg, save, ctx.now)
	if not entries then
		return fail(err)
	end
	Ledger.apply(save, entries)
	return ok({ entries = entries })
end

handlers.claimClubMonthly = function(ctx, save, _args)
	local entries, err = Club.claimMonthly(ctx.cfg, save, ctx.now)
	if not entries then
		return fail(err)
	end
	Ledger.apply(save, entries)
	return ok({ entries = entries })
end

handlers.buyGemItem = function(ctx, save, args)
	if not Validate.id(args.item) then
		return fail("bad_args")
	end
	local result, err = GemShop.buy(ctx.cfg, save, args.item, ctx.userId, ctx.rng)
	if not result then
		return fail(err)
	end
	return ok({ item = result.item, crate = result.crate }, result.events)
end

handlers.equipCosmetic = function(_ctx, save, args)
	if not Validate.id(args.cosmetic) or not ConfigValidator.isCosmeticId(args.cosmetic) then
		return fail("bad_args")
	end
	local id = args.cosmetic
	if (save.cosmetics[id] or 0) <= 0 then
		return fail("not_owned")
	end
	if string.sub(id, 1, 5) == "skin_" then
		if not Validate.id(args.drifter) then
			return fail("bad_args")
		end
		local d = Drifters.find(save, args.drifter)
		if not d then
			return fail("not_owned")
		end
		d.skinId = if d.skinId == id then nil else id
	elseif string.sub(id, 1, 8) == "rodskin_" then
		save.equipped.rodSkin = if save.equipped.rodSkin == id then nil else id
	elseif string.sub(id, 1, 5) == "deco_" then
		local list = save.equipped.decorations
		local i = table.find(list, id)
		if i then
			table.remove(list, i)
		elseif #list < 12 then
			table.insert(list, id)
		else
			return fail("too_many_decorations")
		end
	end
	return ok()
end

-- ------------------------------------------------------------------ harbor (shared state applied by HarborService)

handlers.contribute = function(ctx, save, args)
	if not Validate.id(args.building) or not Validate.plainTable(args.materials, 3) then
		return fail("bad_args")
	end
	local contribution, err = Harbor.takeFromPlayer(ctx.cfg, save, args.building, args.materials)
	if not contribution then
		return fail(err)
	end
	Progression.record(ctx.cfg, save, "contribute", contribution.total, ctx.now)
	return ok({ contribution = contribution })
end

-- ------------------------------------------------------------------ settings, spending, social, onboarding

local SETTINGS = {
	textScale = function(v)
		return Validate.number(v, 0.8, 1.6)
	end,
	haptics = Validate.bool,
	reducedMotion = Validate.bool,
	music = function(v)
		return Validate.number(v, 0, 1)
	end,
	sfx = function(v)
		return Validate.number(v, 0, 1)
	end,
	smugglerOptIn = Validate.bool,
}

handlers.setSetting = function(_ctx, save, args)
	if args.key == "notification" then
		if not Validate.oneOf(args.type, { "crops_ready", "worker_income_full", "night_starting", "season_changed" }) or not Validate.bool(args.value) then
			return fail("bad_args")
		end
		save.settings.notifications[args.type] = args.value
		return ok()
	end
	local check = SETTINGS[args.key]
	if not check or not check(args.value) then
		return fail("bad_args")
	end
	save.settings[args.key] = args.value
	return ok()
end

handlers.setSpendLimit = function(ctx, save, args)
	if args.robux ~= nil and not Validate.int(args.robux, 0, 1e7) then
		return fail("bad_args")
	end
	local err, appliesAt = Spending.setLimit(ctx.cfg, save, args.robux, ctx.now)
	if err then
		return fail(err)
	end
	return ok({ appliesAt = appliesAt })
end

handlers.block = function(_ctx, save, args)
	if not Validate.int(args.userId, 1, 1e15) then
		return fail("bad_args")
	end
	if not table.find(save.social.blocked, args.userId) then
		if #save.social.blocked >= 200 then
			table.remove(save.social.blocked, 1)
		end
		table.insert(save.social.blocked, args.userId)
	end
	return ok()
end

handlers.unblock = function(_ctx, save, args)
	local i = table.find(save.social.blocked, args.userId)
	if i then
		table.remove(save.social.blocked, i)
	end
	return ok()
end

handlers.onboarding = function(ctx, save, args)
	if args.action == "start" then
		local events = {}
		onboardingStep(save, "welcome", ctx.now, events)
		return ok(nil, events)
	elseif args.action == "skip" then
		local e = Onboarding.skip(save, ctx.now)
		return ok(nil, if e then { e } else {})
	end
	return fail("bad_args")
end

-- ------------------------------------------------------------------ entry point

function IntentProcessor.apply(ctx: any, save: any, intent: any): any
	if type(intent) ~= "table" or not Validate.id(intent.type) then
		return fail("bad_intent")
	end
	local handler = handlers[intent.type]
	if not handler then
		return fail("unknown_intent")
	end
	local args = intent.args
	if args == nil then
		args = {}
	end
	if type(args) ~= "table" or getmetatable(args) ~= nil then
		return fail("bad_args")
	end
	return handler(ctx, save, args)
end

function IntentProcessor.has(intentType: string): boolean
	return handlers[intentType] ~= nil
end

return IntentProcessor
