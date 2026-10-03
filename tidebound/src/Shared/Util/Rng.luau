--[[
	Deterministic random source (xoshiro128**). Pure Luau so tests can seed it.
	On Roblox servers, Rng.fromRandom wraps Roblox's Random object instead.

	Every rule that rolls takes an rng with :nextNumber() -> [0, 1) and :nextInteger(min, max) -> [min, max].
]]

local Rng = {}
Rng.__index = Rng

local band, bor, bxor, lshift, rshift = bit32.band, bit32.bor, bit32.bxor, bit32.lshift, bit32.rshift

local function rotl(x: number, k: number): number
	return bor(lshift(x, k), rshift(x, 32 - k))
end

-- 32-bit multiply modulo 2^32 without losing precision in doubles.
local function mul32(a: number, b: number): number
	local aHi, aLo = rshift(a, 16), band(a, 0xFFFF)
	local bHi, bLo = rshift(b, 16), band(b, 0xFFFF)
	local lo = aLo * bLo
	local mid = band(aHi * bLo + aLo * bHi, 0xFFFF)
	return band(lo + lshift(mid, 16), 0xFFFFFFFF)
end

local function splitmix32(state: number): (number, number)
	state = band(state + 0x9E3779B9, 0xFFFFFFFF)
	local z = state
	z = mul32(bxor(z, rshift(z, 16)), 0x85EBCA6B)
	z = mul32(bxor(z, rshift(z, 13)), 0xC2B2AE35)
	z = bxor(z, rshift(z, 16))
	return state, z
end

function Rng.new(seed: number)
	local s = band(math.floor(seed) % 4294967296, 0xFFFFFFFF)
	local self = setmetatable({}, Rng)
	local a, b, c, d
	s, a = splitmix32(s)
	s, b = splitmix32(s)
	s, c = splitmix32(s)
	s, d = splitmix32(s)
	if a == 0 and b == 0 and c == 0 and d == 0 then
		a = 1
	end
	self.s = { a, b, c, d }
	return self
end

function Rng:nextUInt32(): number
	local s = self.s
	local result = mul32(rotl(mul32(s[2], 5), 7), 9)
	local t = lshift(s[2], 9)
	s[3] = bxor(s[3], s[1])
	s[4] = bxor(s[4], s[2])
	s[2] = bxor(s[2], s[3])
	s[1] = bxor(s[1], s[4])
	s[3] = bxor(s[3], t)
	s[4] = rotl(s[4], 11)
	return result
end

function Rng:nextNumber(): number
	-- 53 bits from two draws.
	local a = rshift(self:nextUInt32(), 5)
	local b = rshift(self:nextUInt32(), 6)
	return (a * 67108864 + b) / 9007199254740992
end

function Rng:nextInteger(min: number, max: number): number
	if max <= min then
		return min
	end
	return min + math.floor(self:nextNumber() * (max - min + 1))
end

-- Wraps a Roblox Random (or anything with NextNumber/NextInteger) in the same interface.
function Rng.fromRandom(random: any)
	return {
		nextNumber = function(_)
			return random:NextNumber()
		end,
		nextInteger = function(_, min: number, max: number)
			return random:NextInteger(min, max)
		end,
	}
end

-- Picks a key from { [key] = weight }. Iterates keys in the given order list for determinism.
function Rng.pickWeighted(rng: any, order: { string }, weights: { [string]: number }): string
	local total = 0
	for _, key in order do
		total += math.max(0, weights[key] or 0)
	end
	assert(total > 0, "all weights are zero")
	local roll = rng:nextNumber() * total
	local last
	for _, key in order do
		local w = weights[key] or 0
		if w > 0 then
			last = key
			if roll < w then
				return key
			end
			roll -= w
		end
	end
	return last
end

return Rng
