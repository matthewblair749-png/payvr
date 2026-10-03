--[[
	Fishing: cast, wait 3 to 8 seconds (by rod), then a 1.2 second tap-timing minigame.
	The server picks the bite time, the catch zone and the fish when the cast starts.
	The client reports where in the window the player tapped; the server checks that against its own clock.
]]

local Rng = require(script.Parent.Parent.Util.Rng)
local Odds = require(script.Parent.Odds)

local Fishing = {}

local function isOnboardingCast(save: any): boolean
	return not save.onboarding.done and (save.stats.fishCaught or 0) == 0
end

function Fishing.start(cfg: any, save: any, now: number, rng: any, mods: any): (any, string?)
	local f = cfg.day.fishing
	if save.cast and now < save.cast.biteAt + f.minigameSeconds + f.abandonAfterSeconds then
		return nil, "already_casting"
	end
	local rod = cfg.index.rodsByTier[save.rods.equipped]
	local onboarding = isOnboardingCast(save)
	local wait = rng:nextNumber() * (rod.maxWaitSeconds - rod.minWaitSeconds) + rod.minWaitSeconds
	wait *= math.max(0.25, 1 + (mods.fishWaitPct or 0) / 100)
	local half = rod.zoneHalfWidthSeconds
	local fishId
	if onboarding then
		-- The first cast always succeeds: the zone covers the whole window.
		half = f.minigameSeconds / 2
		fishId = f.onboardingFish.id
		wait = math.min(wait, 3)
	else
		local rarity = Rng.pickWeighted(rng, Odds.ORDER, f.rarityWeights)
		for _, fish in f.fish do
			if fish.tier == rod.tier and fish.rarity == rarity then
				fishId = fish.id
			end
		end
	end
	local zoneCenter = half + rng:nextNumber() * (f.minigameSeconds - 2 * half)
	save.castSeq = (save.castSeq or 0) + 1
	save.cast = {
		id = save.castSeq,
		rodTier = rod.tier,
		startedAt = now,
		biteAt = now + wait,
		zoneCenter = zoneCenter,
		zoneHalfWidth = half,
		fishId = fishId,
		onboarding = onboarding,
	}
	-- The fish stays secret until the catch; the client only needs timing.
	return {
		castId = save.cast.id,
		biteAt = save.cast.biteAt,
		zoneCenter = zoneCenter,
		zoneHalfWidth = half,
		minigameSeconds = f.minigameSeconds,
		onboarding = onboarding,
	}, nil
end

--[[
	Resolves a cast. tapOffset is seconds from the start of the minigame window to the tap.
	Rejects taps that arrive before the bite or impossibly late. Returns (result) or (nil, errorCode).
]]
function Fishing.resolve(cfg: any, save: any, castId: number, tapOffset: number, now: number): (any, string?)
	local f = cfg.day.fishing
	local cast = save.cast
	if not cast or cast.id ~= castId then
		return nil, "no_cast"
	end
	if type(tapOffset) ~= "number" or tapOffset ~= tapOffset or tapOffset < 0 or tapOffset > f.minigameSeconds then
		return nil, "bad_tap"
	end
	local sinceBite = now - cast.biteAt
	-- The tap cannot have happened later than the moment it arrived (small allowance for clock sync).
	if sinceBite < tapOffset - 0.25 then
		return nil, "too_early"
	end
	save.cast = nil
	if sinceBite > f.minigameSeconds + f.latencyToleranceSeconds then
		return { caught = false, reason = "too_late" }, nil
	end
	local distance = math.abs(tapOffset - cast.zoneCenter)
	if distance > cast.zoneHalfWidth then
		return { caught = false, reason = "missed" }, nil
	end
	local fish = cfg.index.fish[cast.fishId]
	save.fish[fish.id] = (save.fish[fish.id] or 0) + 1
	local perfect = distance <= f.perfectHalfWidthSeconds
	return { caught = true, fishId = fish.id, rarity = fish.rarity, perfect = perfect, onboarding = cast.onboarding }, nil
end

function Fishing.buyRod(cfg: any, save: any, tier: number): string?
	local rod = cfg.index.rodsByTier[tier]
	if not rod then
		return "unknown_rod"
	end
	if table.find(save.rods.owned, tier) then
		return "already_owned"
	end
	if save.progress.level < rod.levelRequired then
		return "level_too_low"
	end
	if save.currencies.silver < rod.priceSilver then
		return "not_enough_silver"
	end
	save.currencies.silver -= rod.priceSilver
	table.insert(save.rods.owned, tier)
	save.rods.equipped = tier
	return nil
end

function Fishing.equipRod(save: any, tier: number): string?
	if not table.find(save.rods.owned, tier) then
		return "not_owned"
	end
	save.rods.equipped = tier
	return nil
end

return Fishing
