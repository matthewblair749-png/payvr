--[[
	Harbor Club subscription benefits: +storage (to the same cap free players reach), auto-collect,
	30 Gems a day (claimed in the game), and one cosmetic per month. Status comes from Roblox.
]]

local Time = require(script.Parent.Parent.Util.Time)

local Club = {}

--[[
	Applies a status read from MarketplaceService:GetUserSubscriptionStatusAsync.
	Returns the analytics event name for the transition, if any.
]]
function Club.applyStatus(save: any, isSubscribed: boolean, isRenewing: boolean, now: number): string?
	local club = save.entitlements.club
	local was = club.active
	local periodKey = Time.monthKey(now)
	local event = nil
	if isSubscribed and not was then
		event = if club.everSubscribed then "subscription_renewed" else "subscription_started"
		club.everSubscribed = true
		club.periodKey = periodKey
		club.cancelReported = false
	elseif isSubscribed and was and club.periodKey ~= periodKey and isRenewing then
		event = "subscription_renewed"
		club.periodKey = periodKey
		club.cancelReported = false
	elseif (not isSubscribed or not isRenewing) and was and not club.cancelReported then
		-- Either it ended, or auto-renew was turned off (still active until the period ends). Report once.
		event = "subscription_cancelled"
		club.cancelReported = true
	end
	club.active = isSubscribed
	club.renewing = isSubscribed and isRenewing
	return event
end

function Club.claimDaily(cfg: any, save: any, now: number): (any, string?)
	local club = save.entitlements.club
	if not club.active then
		return nil, "not_subscribed"
	end
	local key = Time.dateKey(now)
	if club.lastDailyGemsKey == key then
		return nil, "already_claimed"
	end
	club.lastDailyGemsKey = key
	return { { t = "currency", k = "gems", n = cfg.catalog.harborClub.dailyGems } }, nil
end

function Club.monthlyCosmetic(cfg: any, now: number): string
	local list = cfg.catalog.harborClub.monthlyCosmetics
	local d = Time.utcParts(now)
	local index = ((d.year * 12 + d.month - 1) % #list) + 1
	return list[index]
end

function Club.claimMonthly(cfg: any, save: any, now: number): (any, string?)
	local club = save.entitlements.club
	if not club.active then
		return nil, "not_subscribed"
	end
	local key = Time.monthKey(now)
	if club.monthlyClaimed[key] then
		return nil, "already_claimed"
	end
	club.monthlyClaimed[key] = true
	return { { t = "cosmetic", id = Club.monthlyCosmetic(cfg, now) } }, nil
end

function Club.autoCollect(save: any): boolean
	return save.entitlements.storagePass or save.entitlements.club.active
end

return Club
