--[[
	Monthly spend tracking and the player's own spend limit.
	Lowering the limit applies at once. Raising it waits 24 hours, so an impulse cannot undo it.
	Roblox's own parental controls (spending limits and purchase approval) apply on top of this.
]]

local Time = require(script.Parent.Parent.Util.Time)

local Spending = {}

local RAISE_DELAY = 24 * 3600

local function effectiveLimit(save: any, now: number): number?
	local s = save.spend
	if s.pendingLimitAt and now >= s.pendingLimitAt then
		s.limitRobux = s.pendingLimit
		s.pendingLimit = nil
		s.pendingLimitAt = nil
		s.pendingNoLimit = nil
	end
	return s.limitRobux
end

Spending.effectiveLimit = effectiveLimit

function Spending.spentThisMonth(save: any, now: number): number
	return save.spend.byMonth[Time.monthKey(now)] or 0
end

-- Returns nil if allowed, or "spend_limit".
function Spending.check(save: any, robux: number, now: number): string?
	local limit = effectiveLimit(save, now)
	if limit == nil then
		return nil
	end
	if Spending.spentThisMonth(save, now) + robux > limit then
		return "spend_limit"
	end
	return nil
end

function Spending.record(save: any, robux: number, now: number)
	local key = Time.monthKey(now)
	save.spend.byMonth[key] = (save.spend.byMonth[key] or 0) + robux
end

-- value = nil means "no limit". Returns (nil, appliesAt) or (errorCode).
function Spending.setLimit(cfg: any, save: any, value: number?, now: number): (string?, number?)
	if value ~= nil and not table.find(cfg.catalog.spendControls.limitOptionsRobux, value) then
		return "bad_limit"
	end
	local current = effectiveLimit(save, now)
	local lowering = value ~= nil and (current == nil or value <= current)
	if lowering then
		save.spend.limitRobux = value
		save.spend.pendingLimit = nil
		save.spend.pendingLimitAt = nil
		return nil, now
	end
	save.spend.pendingLimit = value
	save.spend.pendingLimitAt = now + RAISE_DELAY
	-- nil cannot be told apart from "nothing pending" in a table, so flag it for the UI.
	save.spend.pendingNoLimit = value == nil or nil
	return nil, now + RAISE_DELAY
end

-- Applies a pending limit change once it is due.
function Spending.tick(save: any, now: number)
	effectiveLimit(save, now)
end

-- Data for the spending summary screen.
function Spending.summary(save: any, now: number): any
	local months = {}
	for key, robux in save.spend.byMonth do
		table.insert(months, { month = key, robux = robux })
	end
	table.sort(months, function(a, b)
		return a.month > b.month
	end)
	local purchases = {}
	for i = #save.purchases.order, math.max(1, #save.purchases.order - 49), -1 do
		local id = save.purchases.order[i]
		local r = save.purchases.ledger[id]
		if r then
			table.insert(purchases, { productId = r.productId, robux = r.robux, at = r.at, reversed = r.reversed == true })
		end
	end
	Spending.tick(save, now)
	return {
		thisMonth = Spending.spentThisMonth(save, now),
		limit = save.spend.limitRobux,
		pendingLimit = save.spend.pendingLimit,
		pendingNoLimit = save.spend.pendingNoLimit,
		pendingLimitAt = save.spend.pendingLimitAt,
		months = months,
		purchases = purchases,
		gemsSpent = save.stats.gemsSpent or 0,
	}
end

return Spending
