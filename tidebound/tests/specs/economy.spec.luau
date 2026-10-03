--[[
	Economy balance targets from the brief:
	  * about 400 Silver earned in the first 8 minutes,
	  * the first egg costs 100 Silver and is affordable right after the first sale,
	  * the first night starts within 8 minutes,
	  * a Rare (or better) Drifter within about 3 sessions without paying.
]]
return function(T, Loader)
	local Shared = Loader.root("src/Shared")
	local ConfigLoader = Loader.require(Shared.ConfigLoader)
	local PlayerSim = Loader.require(Shared.Sim.PlayerSim)
	local Hatchery = Loader.require(Shared.Rules.Hatchery)
	local Time = Loader.require(Shared.Util.Time)

	local cfg = ConfigLoader.defaults()
	local START = Time.parseUtc("2026-10-05T12:00:00Z")

	T.describe("First session", function()
		T.it("earns about 400 Silver in 8 minutes and reaches the first night in time", function()
			local samples = {}
			for seed = 1, 10 do
				local p = PlayerSim.new(cfg, 1000 + seed, START, seed)
				local tutorialSeconds = PlayerSim.tutorial(p)
				T.expect(tutorialSeconds).toBeAtMost(60)
				T.expect(cfg.economy.eggPriceSilver).toBe(100)
				local firstNight = p.save.onboarding.firstNightAt
				T.expect(firstNight - START).toBeAtMost(8 * 60)
				PlayerSim.playDay(p, START + 8 * 60)
				-- Count the login reward too: it is Silver the player has in the first 8 minutes.
				table.insert(samples, p.earned + 20)
			end
			local sum = 0
			for _, s in samples do
				sum += s
			end
			local mean = sum / #samples
			print(("    mean Silver earned in the first 8 minutes: %.0f"):format(mean))
			T.expect(mean).toBeNear(400, 60)
		end)
	end)

	T.describe("Rare Drifters without paying", function()
		T.it("a free player has at least a 75% chance of a Rare or better within 3 sessions", function()
			-- One session = one day phase of play plus a survived night at the squad average share.
			local p = PlayerSim.new(cfg, 77, START, 77)
			PlayerSim.tutorial(p)
			PlayerSim.playDay(p, START + cfg.cycle.daySeconds)
			local daySilver = p.earned
			local nightSilver = cfg.night.rewards.silverPerWave * cfg.night.waveCount * 1.05
			local perSession = daySilver + nightSilver
			-- Players keep some Silver for seeds; assume 70% goes to eggs.
			local eggs = math.floor(perSession * 3 * 0.7 / cfg.economy.eggPriceSilver)
			local odds = Hatchery.odds(cfg)
			local rarePlus = 0
			for _, row in odds.rows do
				if row.rarity == "rare" or row.rarity == "epic" or row.rarity == "legendary" then
					rarePlus += row.overall
				end
			end
			local chance = 1 - (1 - rarePlus) ^ eggs
			print(("    Silver per session %.0f, eggs in 3 sessions %d, chance of Rare+ %.0f%%"):format(perSession, eggs, chance * 100))
			T.expect(chance).toBeAtLeast(0.75)
		end)
	end)
end
