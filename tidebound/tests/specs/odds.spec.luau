--[[
	Proves that the odds shown in the UI match server behavior.
	Tolerance: each observed rarity share must be within 4 standard errors of the displayed overall rate
	(about 0.6 percentage points for Common, 0.13 for Legendary at 100,000 rolls). Pity limits are exact.
]]
return function(T, Loader)
	local Shared = Loader.root("src/Shared")
	local ConfigLoader = Loader.require(Shared.ConfigLoader)
	local Rng = Loader.require(Shared.Util.Rng)
	local Odds = Loader.require(Shared.Rules.Odds)
	local Hatchery = Loader.require(Shared.Rules.Hatchery)
	local SaveSchema = Loader.require(Shared.SaveSchema)
	local Crates = Loader.require(Shared.Store.Crates)

	local cfg = ConfigLoader.defaults()
	local N = 100000

	local function within(observed: { [string]: number }, expected: { [string]: number }, n: number)
		for _, r in Odds.ORDER do
			local p = expected[r]
			local se = math.sqrt(p * (1 - p) / n)
			T.expect(observed[r] / n).toBeNear(p, math.max(4 * se, 1e-4))
		end
	end

	T.describe("Egg hatching", function()
		T.it("base odds match the configured weights", function()
			local base = Odds.base(Hatchery.weights(cfg))
			T.expect(base.common).toBeNear(0.60, 1e-9)
			T.expect(base.legendary).toBeNear(0.01, 1e-9)
		end)

		T.it("100,000 server hatches match the displayed overall odds and never exceed pity", function()
			local display = Hatchery.odds(cfg)
			local expected = {}
			for _, row in display.rows do
				expected[row.rarity] = row.overall
			end
			local save = SaveSchema.new(1, 0, cfg)
			save.storageUpgrades = 0
			local rng = Rng.new(2026)
			local counts = { common = 0, uncommon = 0, rare = 0, epic = 0, legendary = 0 }
			local sinceEpic, sinceLegendary, maxEpicGap, maxLegendaryGap = 0, 0, 0, 0
			for _ = 1, N do
				-- Keep storage free; the test measures rolls, not inventory.
				table.clear(save.drifters)
				local _, info = Hatchery.hatch(cfg, save, rng, 0)
				counts[info.rarity] += 1
				sinceEpic += 1
				sinceLegendary += 1
				if info.rarity == "epic" or info.rarity == "legendary" then
					maxEpicGap = math.max(maxEpicGap, sinceEpic)
					sinceEpic = 0
				end
				if info.rarity == "legendary" then
					maxLegendaryGap = math.max(maxLegendaryGap, sinceLegendary)
					sinceLegendary = 0
				end
			end
			within(counts, expected, N)
			T.expect(maxEpicGap).toBeAtMost(cfg.drifters.pity.epicOrBetterEvery)
			T.expect(maxLegendaryGap).toBeAtMost(cfg.drifters.pity.legendaryEvery)
			-- Pity lifts the overall rates above the base weights.
			T.expect(expected.legendary).toBeAtLeast(0.01)
			T.expect(expected.epic + expected.legendary).toBeAtLeast(0.05)
		end)
	end)

	T.describe("Cosmetic crates", function()
		T.it("100,000 crate openings match the displayed odds, including the pity rule", function()
			local crate = cfg.index.crates.crate_tidecomb
			local display = Crates.odds(cfg, crate.id)
			local expected = {}
			for _, row in display.rows do
				expected[row.rarity] = row.overall
			end
			local save = SaveSchema.new(1, 0, cfg)
			local rng = Rng.new(99)
			local counts = { common = 0, uncommon = 0, rare = 0, epic = 0, legendary = 0 }
			local gap, maxGap = 0, 0
			for _ = 1, N do
				local result = Crates.open(cfg, save, crate.id, rng)
				counts[result.rarity] += 1
				gap += 1
				if result.rarity == "epic" or result.rarity == "legendary" then
					maxGap = math.max(maxGap, gap)
					gap = 0
				end
			end
			within(counts, expected, N)
			T.expect(maxGap).toBeAtMost(crate.pityEpicOrBetterEvery)
			-- Class shares shown in the UI are consistent with item rarities.
			local classTotal = 0
			for _, share in display.classes do
				classTotal += share
			end
			T.expect(classTotal).toBeNear(1, 1e-9)
		end)
	end)
end
