--[[
	One implementation of weighted rolls with pity, used by egg hatching and cosmetic crates.
	The same function computes the odds shown in the UI, so the display cannot drift from the server.

	Pity rules (counters count rolls since the last hit):
	  * epicEvery:      the epicEvery-th roll without an Epic-or-better is forced to Epic or better
	                    (picked between Epic and Legendary by their base weights).
	  * legendaryEvery: the legendaryEvery-th roll without a Legendary is forced to Legendary. Optional.
]]

local Rng = require(script.Parent.Parent.Util.Rng)

local Odds = {}

Odds.ORDER = { "common", "uncommon", "rare", "epic", "legendary" }
local EPIC_PLUS = { "epic", "legendary" }

export type Counters = { sinceEpic: number, sinceLegendary: number }

-- Returns the forced pool (or nil) for the next roll given the counters.
local function forced(counters: Counters, epicEvery: number, legendaryEvery: number?): string?
	if legendaryEvery and counters.sinceLegendary + 1 >= legendaryEvery then
		return "legendary"
	end
	if counters.sinceEpic + 1 >= epicEvery then
		return "epicPlus"
	end
	return nil
end

local function advance(counters: Counters, rarity: string)
	if rarity == "legendary" then
		counters.sinceLegendary = 0
		counters.sinceEpic = 0
	elseif rarity == "epic" then
		counters.sinceEpic = 0
		counters.sinceLegendary += 1
	else
		counters.sinceEpic += 1
		counters.sinceLegendary += 1
	end
end

-- Rolls a rarity and advances the counters in place. Returns (rarity, wasPity).
function Odds.roll(weights: { [string]: number }, counters: Counters, epicEvery: number, legendaryEvery: number?, rng: any): (string, boolean)
	local f = forced(counters, epicEvery, legendaryEvery)
	local rarity
	if f == "legendary" then
		rarity = "legendary"
	elseif f == "epicPlus" then
		rarity = Rng.pickWeighted(rng, EPIC_PLUS, weights)
	else
		rarity = Rng.pickWeighted(rng, Odds.ORDER, weights)
	end
	advance(counters, rarity)
	return rarity, f ~= nil
end

-- Base probability of each rarity on a roll with no pity.
function Odds.base(weights: { [string]: number }): { [string]: number }
	local total = 0
	for _, r in Odds.ORDER do
		total += weights[r] or 0
	end
	local out = {}
	for _, r in Odds.ORDER do
		out[r] = (weights[r] or 0) / total
	end
	return out
end

--[[
	Long-run share of each rarity including pity, from the stationary distribution of the counter chain.
	This is the "overall rate" shown next to the base odds in the UI.
]]
function Odds.effective(weights: { [string]: number }, epicEvery: number, legendaryEvery: number?): { [string]: number }
	local base = Odds.base(weights)
	local epicPlusTotal = base.epic + base.legendary
	local maxL = legendaryEvery or 1
	local stateCount = epicEvery * maxL
	-- Flat transition table: for each state, a list of { rarityIndex, probability, nextState }.
	local transitions = table.create(stateCount)
	for e = 0, epicEvery - 1 do
		for l = 0, maxL - 1 do
			local f = forced({ sinceEpic = e, sinceLegendary = l }, epicEvery, legendaryEvery)
			local outcomes
			if f == "legendary" then
				outcomes = { legendary = 1 }
			elseif f == "epicPlus" then
				outcomes = { epic = base.epic / epicPlusTotal, legendary = base.legendary / epicPlusTotal }
			else
				outcomes = base
			end
			local list = {}
			for ri, r in Odds.ORDER do
				local q = outcomes[r] or 0
				if q > 0 then
					local c = { sinceEpic = e, sinceLegendary = l }
					advance(c, r)
					local nl = if legendaryEvery then c.sinceLegendary else 0
					table.insert(list, { ri, q, c.sinceEpic * maxL + nl + 1 })
				end
			end
			transitions[e * maxL + l + 1] = list
		end
	end

	local dist = table.create(stateCount, 0)
	dist[1] = 1
	local rates = { 0, 0, 0, 0, 0 }
	-- The chain is aperiodic (a Legendary from the reset state returns to it in one step), so the
	-- per-roll rates converge to the stationary values. Pity only shows up after the longest window,
	-- so never stop before several windows have passed.
	local minIterations = 10 * math.max(epicEvery, legendaryEvery or 0)
	for iteration = 1, 20000 do
		local nextDist = table.create(stateCount, 0)
		local nextRates = { 0, 0, 0, 0, 0 }
		for i = 1, stateCount do
			local p = dist[i]
			if p > 0 then
				for _, t in transitions[i] do
					local mass = p * t[2]
					nextRates[t[1]] += mass
					nextDist[t[3]] += mass
				end
			end
		end
		dist = nextDist
		local delta = 0
		for ri = 1, 5 do
			delta = math.max(delta, math.abs(nextRates[ri] - rates[ri]))
		end
		rates = nextRates
		if iteration > minIterations and delta < 1e-13 then
			break
		end
	end
	local out = {}
	for ri, r in Odds.ORDER do
		out[r] = rates[ri]
	end
	return out
end

-- Ready-to-render odds table: base and overall rates, plus the pity text keys and values.
function Odds.display(weights: { [string]: number }, epicEvery: number, legendaryEvery: number?)
	local base = Odds.base(weights)
	local eff = Odds.effective(weights, epicEvery, legendaryEvery)
	local rows = {}
	for _, r in Odds.ORDER do
		table.insert(rows, { rarity = r, base = base[r], overall = eff[r] })
	end
	return { rows = rows, epicEvery = epicEvery, legendaryEvery = legendaryEvery }
end

return Odds
