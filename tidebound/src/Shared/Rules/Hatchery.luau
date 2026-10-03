--[[ Egg hatching. All rolls happen on the server with the server's rng. ]]

local Odds = require(script.Parent.Odds)
local Drifters = require(script.Parent.Drifters)

local Hatchery = {}

function Hatchery.weights(cfg: any): { [string]: number }
	local w = {}
	for _, r in cfg.drifters.rarities do
		w[r.id] = r.hatchWeight
	end
	return w
end

-- Cached per config: computing the pity-adjusted rates walks a 2,500-state chain.
function Hatchery.odds(cfg: any)
	if not cfg.index.hatchOdds then
		local pity = cfg.drifters.pity
		cfg.index.hatchOdds = Odds.display(Hatchery.weights(cfg), pity.epicOrBetterEvery, pity.legendaryEvery)
	end
	return cfg.index.hatchOdds
end

-- Rolls species and trait for a rarity.
local function pickSpecies(cfg: any, rarity: string, rng: any): any
	local pool = cfg.index.speciesByRarity[rarity]
	return pool[rng:nextInteger(1, #pool)]
end

--[[
	Hatches one egg. opts.guaranteedSpeciesId skips the roll (tutorial egg) and does not touch pity.
	Returns (drifter, info) or (nil, errorCode).
]]
function Hatchery.hatch(cfg: any, save: any, rng: any, now: number, opts: any?): (any, any)
	if #save.drifters >= Drifters.storageCapacity(cfg, save) then
		return nil, "storage_full"
	end
	opts = opts or {}
	local speciesId, rarity, wasPity
	if opts.guaranteedSpeciesId then
		speciesId = opts.guaranteedSpeciesId
		rarity = cfg.index.species[speciesId].rarity
		wasPity = false
	else
		local pity = cfg.drifters.pity
		local counters = { sinceEpic = save.hatch.sinceEpic, sinceLegendary = save.hatch.sinceLegendary }
		rarity, wasPity = Odds.roll(Hatchery.weights(cfg), counters, pity.epicOrBetterEvery, pity.legendaryEvery, rng)
		save.hatch.sinceEpic = counters.sinceEpic
		save.hatch.sinceLegendary = counters.sinceLegendary
		speciesId = pickSpecies(cfg, rarity, rng).id
	end
	local traits = cfg.drifters.traits
	local traitId = traits[rng:nextInteger(1, #traits)].id
	local isNew = not save.collection[speciesId]
	local drifter = Drifters.create(cfg, save, speciesId, traitId, now)
	save.hatch.total += 1
	return drifter, { rarity = rarity, pity = wasPity, newSpecies = isNew, first = save.hatch.total == 1 }
end

return Hatchery
