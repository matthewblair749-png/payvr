--[[ Token bucket per key. Pure: the caller passes the current time. ]]

local RateLimiter = {}
RateLimiter.__index = RateLimiter

function RateLimiter.new(perSecond: number, burst: number)
	return setmetatable({ rate = perSecond, burst = burst, buckets = {} }, RateLimiter)
end

function RateLimiter:allow(key: any, now: number, cost: number?): boolean
	cost = cost or 1
	local b = self.buckets[key]
	if not b then
		b = { tokens = self.burst, at = now }
		self.buckets[key] = b
	end
	b.tokens = math.min(self.burst, b.tokens + (now - b.at) * self.rate)
	b.at = now
	if b.tokens >= cost then
		b.tokens -= cost
		return true
	end
	return false
end

function RateLimiter:forget(key: any)
	self.buckets[key] = nil
end

return RateLimiter
