--[[ Spending Gems. Everything here is cosmetic or convenience; prices come from the catalog and the player's variant. ]]

local Catalog = require(script.Parent.Catalog)
local Ledger = require(script.Parent.Ledger)
local Crates = require(script.Parent.Crates)
local Drifters = require(script.Parent.Parent.Rules.Drifters)

local GemShop = {}

-- Returns (result) or (nil, errorCode).
function GemShop.buy(cfg: any, save: any, itemId: string, userId: number, rng: any): (any, string?)
	local item = Catalog.gemItem(cfg, itemId, userId)
	if not item then
		return nil, "unknown_item"
	end
	if (save.debt.gems or 0) > 0 then
		return nil, "gem_debt"
	end
	if save.currencies.gems < item.gems then
		return nil, "not_enough_gems"
	end
	local entries, crate
	if item.kind == "cosmetic" then
		if (save.cosmetics[item.id] or 0) > 0 then
			return nil, "already_owned"
		end
		entries = { { t = "cosmetic", id = item.id } }
	elseif item.kind == "storage" then
		local s = cfg.economy.storage
		if Drifters.storageCapacity(cfg, save) >= s.cap then
			return nil, "storage_maxed"
		end
		entries = { { t = "gemStorage", n = item.storageBonus } }
	elseif item.kind == "crate" then
		crate, entries = Crates.roll(cfg, save, item.crateId, rng)
	else
		return nil, "unknown_item"
	end
	save.currencies.gems -= item.gems
	save.stats.gemsSpent = (save.stats.gemsSpent or 0) + item.gems
	Ledger.apply(save, entries)
	local events = {
		{ name = "gems_spent", props = { itemId = item.id, gems = item.gems, variantId = item.variantId or "control", experimentId = item.experimentId } },
	}
	if crate then
		table.insert(events, { name = "crate_opened", props = { crateId = crate.crateId, itemId = crate.itemId, rarity = crate.rarity, paid = "gems", pity = crate.pity } })
	end
	return { item = item, crate = crate, events = events }, nil
end

return GemShop
