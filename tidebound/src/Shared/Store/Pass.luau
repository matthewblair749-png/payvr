--[[
	Harbor Pass: a free track and a paid track per season block (four weekly seasons).
	Pass XP comes from play and is the same for free and paid players; paying only unlocks the paid track,
	which holds cosmetics and Gems (enforced by ConfigValidator).
]]

local Time = require(script.Parent.Parent.Util.Time)

local Pass = {}

function Pass.blockId(cfg: any, now: number): number
	local hp = cfg.catalog.harborPass
	local anchor = Time.parseUtc(hp.anchorUtcDate)
	return math.floor((now - anchor) / (hp.blockDays * 86400))
end

function Pass.blockEndsAt(cfg: any, now: number): number
	local hp = cfg.catalog.harborPass
	local anchor = Time.parseUtc(hp.anchorUtcDate)
	return anchor + (Pass.blockId(cfg, now) + 1) * hp.blockDays * 86400
end

-- Starts a fresh track when a new block begins. Paid ownership is per block.
function Pass.ensureBlock(cfg: any, save: any, now: number)
	local id = Pass.blockId(cfg, now)
	if save.pass.blockId ~= id then
		save.pass.blockId = id
		save.pass.xp = 0
		save.pass.claimedFree = {}
		save.pass.claimedPaid = {}
	end
end

function Pass.ownsPaid(cfg: any, save: any, now: number): boolean
	return save.pass.paid[tostring(Pass.blockId(cfg, now))] ~= nil
end

function Pass.tier(cfg: any, save: any): number
	local hp = cfg.catalog.harborPass
	return math.min(hp.tiers, math.floor(save.pass.xp / hp.xpPerTier))
end

function Pass.addXp(cfg: any, save: any, xp: number, now: number)
	Pass.ensureBlock(cfg, save, now)
	local hp = cfg.catalog.harborPass
	save.pass.xp = math.min(save.pass.xp + xp, hp.tiers * hp.xpPerTier)
end

function Pass.rewardEntries(reward: any): { any }
	local entries = {}
	if (reward.silver or 0) > 0 then
		table.insert(entries, { t = "currency", k = "silver", n = reward.silver })
	end
	if (reward.pearls or 0) > 0 then
		table.insert(entries, { t = "currency", k = "pearls", n = reward.pearls })
	end
	if (reward.gems or 0) > 0 then
		table.insert(entries, { t = "currency", k = "gems", n = reward.gems })
	end
	if (reward.eggs or 0) > 0 then
		table.insert(entries, { t = "eggs", n = reward.eggs })
	end
	for k, n in reward.materials or {} do
		table.insert(entries, { t = "material", k = k, n = n })
	end
	for _, id in reward.cosmetics or {} do
		table.insert(entries, { t = "cosmetic", id = id })
	end
	return entries
end

--[[
	Claims one tier on one track. Returns (entries, purchaseId?) or (nil, errorCode).
	Paid-track entries are attached to the pass purchase so a refund reverses them too.
]]
function Pass.claim(cfg: any, save: any, track: string, tier: number, now: number): (any, any)
	Pass.ensureBlock(cfg, save, now)
	local hp = cfg.catalog.harborPass
	local list = if track == "free" then hp.freeTrack elseif track == "paid" then hp.paidTrack else nil
	if not list then
		return nil, "bad_track"
	end
	if type(tier) ~= "number" or tier % 1 ~= 0 or tier < 1 or tier > hp.tiers then
		return nil, "bad_tier"
	end
	if tier > Pass.tier(cfg, save) then
		return nil, "tier_locked"
	end
	local claimed = if track == "free" then save.pass.claimedFree else save.pass.claimedPaid
	if table.find(claimed, tier) then
		return nil, "already_claimed"
	end
	local purchaseId = nil
	if track == "paid" then
		purchaseId = save.pass.paid[tostring(save.pass.blockId)]
		if purchaseId == nil then
			return nil, "pass_not_owned"
		end
	end
	local reward
	for _, r in list do
		if r.tier == tier then
			reward = r
		end
	end
	if not reward then
		return nil, "no_reward"
	end
	table.insert(claimed, tier)
	return Pass.rewardEntries(reward), purchaseId
end

return Pass
