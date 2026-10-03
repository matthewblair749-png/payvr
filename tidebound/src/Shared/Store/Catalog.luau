--[[
	Resolves what a specific player is offered and charged: base catalog plus their A/B price variant.
	Robux reference prices follow the rule Robux = USD / usdPerRobux (0.01 by default).
	The client shows the live Robux price from MarketplaceService, which is what Roblox charges.
]]

local Hash = require(script.Parent.Parent.Util.Hash)
local Odds = require(script.Parent.Parent.Rules.Odds)

local Catalog = {}

function Catalog.robux(cfg: any, priceTier: string): number
	local usd = cfg.catalog.priceTiers[priceTier].usd
	return math.floor(usd / cfg.catalog.roblox.usdPerRobux + 0.5)
end

function Catalog.usd(cfg: any, priceTier: string): number
	return cfg.catalog.priceTiers[priceTier].usd
end

-- Deterministic variant assignment: the same player always lands in the same bucket.
function Catalog.variant(_cfg: any, userId: number, experiment: any): any
	if not experiment.enabled then
		for _, v in experiment.variants do
			if v.id == "control" then
				return v
			end
		end
	end
	local total = 0
	for _, v in experiment.variants do
		total += v.weight
	end
	local roll = Hash.unit(tostring(userId) .. ":" .. experiment.id) * total
	for _, v in experiment.variants do
		if roll < v.weight then
			return v
		end
		roll -= v.weight
	end
	return experiment.variants[#experiment.variants]
end

local function experimentFor(cfg: any, field: string, id: string): any
	for _, x in cfg.catalog.experiments do
		if x[field] == id then
			return x
		end
	end
	return nil
end

local function productView(cfg: any, p: any, variant: any?, experiment: any?): any
	local priceTier = (variant and variant.priceTier) or p.priceTier
	return {
		id = p.id,
		kind = p.kind,
		type = p.type,
		robloxType = p.robloxType,
		robloxId = (variant and variant.robloxId) or p.robloxId,
		priceTier = priceTier,
		usd = Catalog.usd(cfg, priceTier),
		robux = Catalog.robux(cfg, priceTier),
		gems = (variant and variant.gems) or p.gems,
		crateId = p.crateId,
		periodDays = p.periodDays,
		grants = p.grants,
		experimentId = experiment and experiment.id or nil,
		variantId = variant and variant.id or nil,
	}
end

function Catalog.product(cfg: any, productId: string, userId: number): any
	local p = cfg.index.products[productId]
	if not p then
		return nil
	end
	local x = experimentFor(cfg, "productId", productId)
	local v = x and Catalog.variant(cfg, userId, x) or nil
	return productView(cfg, p, v, x)
end

function Catalog.gemItem(cfg: any, itemId: string, userId: number): any
	local g = cfg.index.gemItems[itemId]
	if not g then
		return nil
	end
	local x = experimentFor(cfg, "gemItemId", itemId)
	local v = x and Catalog.variant(cfg, userId, x) or nil
	return {
		id = g.id,
		kind = g.kind,
		gems = (v and v.gems) or g.gems,
		crateId = g.crateId,
		cosmeticClass = g.cosmeticClass,
		storageBonus = g.storageBonus,
		experimentId = x and x.id or nil,
		variantId = v and v.id or nil,
	}
end

--[[
	Maps a Roblox id from a receipt back to a product. A receipt for a variant's id grants that variant,
	whatever bucket the player is in now, because that is what Roblox charged.
]]
function Catalog.fromRobloxId(cfg: any, robloxType: string, robloxId: number): any
	if not robloxId or robloxId == 0 then
		return nil
	end
	for _, p in cfg.catalog.products do
		if p.robloxType == robloxType then
			if p.robloxId == robloxId then
				local x = experimentFor(cfg, "productId", p.id)
				local control = nil
				if x then
					for _, v in x.variants do
						if v.id == "control" then
							control = v
						end
					end
				end
				return productView(cfg, p, control, x)
			end
			local x = experimentFor(cfg, "productId", p.id)
			if x then
				for _, v in x.variants do
					if v.robloxId == robloxId then
						return productView(cfg, p, v, x)
					end
				end
			end
		end
	end
	return nil
end

-- Every Roblox id the server must listen for, by type.
function Catalog.robloxIds(cfg: any, robloxType: string): { number }
	local ids = {}
	for _, p in cfg.catalog.products do
		if p.robloxType == robloxType then
			if p.robloxId ~= 0 then
				table.insert(ids, p.robloxId)
			end
			local x = experimentFor(cfg, "productId", p.id)
			if x then
				for _, v in x.variants do
					if v.robloxId and v.robloxId ~= 0 then
						table.insert(ids, v.robloxId)
					end
				end
			end
		end
	end
	return ids
end

function Catalog.crateOdds(cfg: any, crateId: string)
	local crate = cfg.index.crates[crateId]
	local display = Odds.display(crate.rarityWeights, crate.pityEpicOrBetterEvery, nil)
	local perRarity = {}
	for _, item in crate.items do
		perRarity[item.rarity] = (perRarity[item.rarity] or 0) + 1
	end
	local classes, items = {}, {}
	for _, row in display.rows do
		for _, item in crate.items do
			if item.rarity == row.rarity then
				local share = row.overall / perRarity[row.rarity]
				items[item.id] = share
				classes[item.cosmeticClass] = (classes[item.cosmeticClass] or 0) + share
			end
		end
	end
	display.classes = classes
	display.items = items
	return display
end

-- The catalog the client renders. Prices and odds come from here, never from client constants.
function Catalog.clientView(cfg: any, userId: number): any
	local products = {}
	for _, p in cfg.catalog.products do
		table.insert(products, Catalog.product(cfg, p.id, userId))
	end
	local gemItems = {}
	for _, g in cfg.catalog.gemItems do
		table.insert(gemItems, Catalog.gemItem(cfg, g.id, userId))
	end
	local crates = {}
	for _, c in cfg.catalog.crates do
		crates[c.id] = { odds = Catalog.crateOdds(cfg, c.id), items = c.items, duplicateGems = c.duplicateGems }
	end
	return {
		version = cfg.version,
		products = products,
		gemItems = gemItems,
		crates = crates,
		harborPass = cfg.catalog.harborPass,
		harborClub = cfg.catalog.harborClub,
		spendControls = cfg.catalog.spendControls,
		rewardedAds = cfg.catalog.rewardedAds,
	}
end

return Catalog
