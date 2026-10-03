--[[ Cosmetic crate rolls. Crates only ever contain cosmetics (enforced by ConfigValidator). ]]

local Odds = require(script.Parent.Parent.Rules.Odds)
local Catalog = require(script.Parent.Catalog)

local Crates = {}

function Crates.odds(cfg: any, crateId: string)
	cfg.index.crateOddsCache = cfg.index.crateOddsCache or {}
	local cached = cfg.index.crateOddsCache[crateId]
	if not cached then
		cached = Catalog.crateOdds(cfg, crateId)
		cfg.index.crateOddsCache[crateId] = cached
	end
	return cached
end

--[[
	Opens one crate and returns the ledger entries to apply plus the result.
	Duplicates convert to Gems at the crate's duplicate rate.
]]
function Crates.roll(cfg: any, save: any, crateId: string, rng: any): (any, { any })
	local crate = cfg.index.crates[crateId]
	local counters = { sinceEpic = save.cratePity[crateId] or 0, sinceLegendary = 0 }
	local rarity, wasPity = Odds.roll(crate.rarityWeights, counters, crate.pityEpicOrBetterEvery, nil, rng)
	save.cratePity[crateId] = counters.sinceEpic
	local pool = {}
	for _, item in crate.items do
		if item.rarity == rarity then
			table.insert(pool, item)
		end
	end
	local item = pool[rng:nextInteger(1, #pool)]
	local duplicate = (save.cosmetics[item.id] or 0) > 0
	local entries
	local dupGems = 0
	if duplicate then
		dupGems = crate.duplicateGems[rarity] or 0
		entries = { { t = "currency", k = "gems", n = dupGems } }
	else
		entries = { { t = "cosmetic", id = item.id } }
	end
	return {
		crateId = crateId,
		itemId = item.id,
		rarity = rarity,
		cosmeticClass = item.cosmeticClass,
		pity = wasPity,
		duplicate = duplicate,
		duplicateGems = dupGems,
	}, entries
end

-- Convenience for tests and Gem purchases: roll and apply in one step.
function Crates.open(cfg: any, save: any, crateId: string, rng: any): any
	local Ledger = require(script.Parent.Ledger)
	local result, entries = Crates.roll(cfg, save, crateId, rng)
	Ledger.apply(save, entries)
	return result
end

return Crates
