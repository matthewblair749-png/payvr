--[[ Market selling with a daily demand modifier per category (shown in the UI). ]]

local Hash = require(script.Parent.Parent.Util.Hash)
local Time = require(script.Parent.Parent.Util.Time)

local Market = {}

-- Multiplier in [1 - swing, 1 + swing], the same for every player on a UTC date.
function Market.demand(cfg: any, now: number, category: string): number
	local swing = cfg.day.market.demandSwing
	local u = Hash.unit("market:" .. Time.dateKey(now) .. ":" .. category)
	return math.floor((1 + swing * (2 * u - 1)) * 1000 + 0.5) / 1000
end

function Market.demandTable(cfg: any, now: number): { [string]: number }
	local out = {}
	for _, c in cfg.day.market.categories do
		out[c] = Market.demand(cfg, now, c)
	end
	return out
end

function Market.price(cfg: any, baseValue: number, category: string, now: number, mods: any): number
	return math.max(1, math.floor(baseValue * Market.demand(cfg, now, category) * (1 + (mods.sellPricePct or 0) / 100) + 0.5))
end

-- Sells all fish and crops (and materials if configured). Returns { silver, sold = { [id] = count } }.
function Market.sellAll(cfg: any, save: any, now: number, mods: any): any
	local total = 0
	local sold = {}
	for id, count in save.fish do
		if count > 0 then
			local fish = cfg.index.fish[id]
			local value = fish.value * (1 + (mods.fishValuePct or 0) / 100)
			total += Market.price(cfg, value, "fish", now, mods) * count
			sold[id] = count
		end
	end
	for id, count in save.crops do
		if count > 0 then
			total += Market.price(cfg, cfg.index.crops[id].sellValue, "crops", now, mods) * count
			sold[id] = count
		end
	end
	table.clear(save.fish)
	table.clear(save.crops)
	if cfg.day.market.sellMaterialsInSellAll then
		for m, count in save.materials do
			if count > 0 then
				total += Market.price(cfg, cfg.day.foraging.materialSellValues[m], "materials", now, mods) * count
				sold[m] = count
				save.materials[m] = 0
			end
		end
	end
	save.market.lastSaleValue = total
	save.market.lastSaleAt = now
	return { silver = total, sold = sold }
end

--[[
	Rewarded ad placement (off by default): doubles the last sale once per UTC day.
	Callers must also check Roblox ad eligibility; the server never offers it when ads are not allowed.
]]
function Market.canDoubleWithAd(cfg: any, save: any, now: number, adsAllowed: boolean): string?
	local ads = cfg.catalog.rewardedAds
	if not ads.enabled or ads.perDay < 1 then
		return "ads_disabled"
	end
	if not adsAllowed then
		return "ads_not_allowed"
	end
	if save.market.adDateKey == Time.dateKey(now) then
		return "already_used_today"
	end
	if (save.market.lastSaleValue or 0) <= 0 or now - (save.market.lastSaleAt or 0) > 300 then
		return "no_recent_sale"
	end
	return nil
end

return Market
