--[[
	Combines the current Tide Season and the shared harbor's building perks into one table of percentages.
	These apply to every player equally, paying or not.
]]

local Time = require(script.Parent.Parent.Util.Time)

local Modifiers = {}

Modifiers.KEYS = {
	"fishWaitPct",
	"fishValuePct",
	"sellPricePct",
	"cropGrowPct",
	"forageYieldPct",
	"happinessDecayPct",
	"nightSilverPct",
	"repairPct",
	"lighthouseHpPct",
	"seawallHpPct",
}

function Modifiers.season(cfg: any, now: number): (any, number, number)
	local s = cfg.harbor.seasons
	local anchor = Time.parseUtc(s.anchorUtcDate)
	local length = s.lengthDays * 86400
	local index = math.floor((now - anchor) / length)
	local season = s.list[(index % #s.list) + 1]
	local endsAt = anchor + (index + 1) * length
	return season, endsAt, index
end

-- harborTiers: { [buildingId] = tier } from the shared harbor state (tier 1 = no bonus).
function Modifiers.current(cfg: any, now: number, harborTiers: { [string]: number }?): { [string]: number }
	local out = {}
	for _, k in Modifiers.KEYS do
		out[k] = 0
	end
	local season = Modifiers.season(cfg, now)
	for k, v in season.modifiers do
		out[k] = (out[k] or 0) + v
	end
	if harborTiers then
		for _, b in cfg.harbor.buildings do
			local tier = harborTiers[b.id] or 1
			out[b.perk] = (out[b.perk] or 0) + b.perPerTier * (tier - 1)
		end
	end
	return out
end

return Modifiers
