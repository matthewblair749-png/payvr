--[[
	Stable FNV-1a (32-bit). The client and server use it to agree on experiment variants,
	daily quests and market demand without a round trip.
]]

local Hash = {}

local band, bxor, rshift, lshift = bit32.band, bit32.bxor, bit32.rshift, bit32.lshift

local function mul32(a: number, b: number): number
	local aHi, aLo = rshift(a, 16), band(a, 0xFFFF)
	local bHi, bLo = rshift(b, 16), band(b, 0xFFFF)
	local lo = aLo * bLo
	local mid = band(aHi * bLo + aLo * bHi, 0xFFFF)
	return band(lo + lshift(mid, 16), 0xFFFFFFFF)
end

function Hash.fnv1a(text: string): number
	local h = 0x811C9DC5
	for i = 1, #text do
		h = mul32(bxor(h, string.byte(text, i)), 0x01000193)
	end
	return h
end

-- Uniform value in [0, 1) for a key.
function Hash.unit(text: string): number
	-- Mix once more so similar keys spread out.
	local h = Hash.fnv1a(text)
	h = mul32(bxor(h, rshift(h, 15)), 0x2C1B3C6D)
	h = mul32(bxor(h, rshift(h, 12)), 0x297A2D39)
	h = bxor(h, rshift(h, 15))
	return h / 4294967296
end

return Hash
