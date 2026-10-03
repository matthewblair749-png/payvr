return function(T, Loader)
	local Shared = Loader.root("src/Shared")
	local ConfigLoader = Loader.require(Shared.ConfigLoader)
	local NightSim = Loader.require(Shared.Night.NightSim)
	local WaveMath = Loader.require(Shared.Night.WaveMath)
	local Rewards = Loader.require(Shared.Night.Rewards)
	local Bot = Loader.require(Shared.Night.Bot)

	local cfg = ConfigLoader.defaults()

	local function member(id, power, element, opts)
		opts = opts or {}
		return { userId = id, power = power, speed = 10, element = element, repairPct = 0, ironScrap = opts.iron or 40, smugglerOptIn = opts.smuggler }
	end

	local function run(sim, roles)
		local dt = 1 / cfg.night.tickRate
		local steps = 0
		while not sim.ended do
			for _, id in sim.playerOrder do
				NightSim.setInput(sim, id, Bot.input(sim, id, roles and roles[id]))
			end
			NightSim.step(sim, dt)
			steps += 1
			assert(steps < 20 * 60 * 20, "night did not end")
		end
		return sim.result
	end

	T.describe("Wave math", function()
		T.it("follows base + wave * growth + squad * 1.5 and +8% health per wave", function()
			T.expect(WaveMath.enemyCount(cfg, 1, 1)).toBe(7) -- 3 + 2 + 1.5 = 6.5, rounds up
			T.expect(WaveMath.enemyCount(cfg, 6, 5)).toBe(23) -- 3 + 12 + 7.5 = 22.5
			T.expect(WaveMath.enemyCount(cfg, 3, 2)).toBe(12) -- 3 + 6 + 3
			T.expect(WaveMath.healthMultiplier(cfg, 1)).toBeNear(1, 1e-9)
			T.expect(WaveMath.healthMultiplier(cfg, 2)).toBeNear(1.08, 1e-9)
			T.expect(WaveMath.healthMultiplier(cfg, 6)).toBeNear(1.08 ^ 5, 1e-9)
		end)
		T.it("fits six waves into the five-minute night", function()
			T.expect(WaveMath.nightLength(cfg, 6)).toBe(cfg.cycle.nightSeconds)
		end)
	end)

	T.describe("Full night", function()
		T.it("a squad of five new players survives all six waves and defeats The Undertow", function()
			local members = {}
			local elements = { "tide", "ember", "moss", "frost", "tide" }
			for i = 1, 5 do
				members[i] = member(i, 14, elements[i])
			end
			local sim = NightSim.new(cfg, { seed = 11, members = members })
			local result = run(sim, { [1] = "boss", [2] = "boss", [3] = "boss", [5] = "repair" })
			T.expect(result.survived).toBeTruthy()
			T.expect(result.wavesSurvived).toBe(6)
			T.expect(result.bossDefeated).toBeTruthy()
			T.expect(sim.t).toBeAtMost(cfg.cycle.nightSeconds + 0.1)

			local rewards = Rewards.compute(cfg, sim, { [1] = 0, [2] = 3, [3] = 6, [4] = 10, [5] = 0 }, {})
			-- Streak bonus: +5% per consecutive night, capped at +30%.
			T.expect(rewards[1].streakBonus).toBeNear(0.05, 1e-9)
			T.expect(rewards[2].streakBonus).toBeNear(0.20, 1e-9)
			T.expect(rewards[4].streakBonus).toBeNear(0.30, 1e-9)
			T.expect(rewards[1].pearls).toBe(cfg.night.rewards.bossPearls)
			-- The repairer earns a fair share.
			T.expect(rewards[5].repairHp).toBeAtLeast(1)
			T.expect(rewards[5].share).toBeAtLeast(cfg.night.rewards.minShare)
		end)

		T.it("a solo player with a level 4 Guardian survives a full night", function()
			local sim = NightSim.new(cfg, { seed = 11, members = { member(1, 14, "tide") } })
			local result = run(sim)
			T.expect(result.survived).toBeTruthy()
			T.expect(result.wavesSurvived).toBe(6)
		end)

		T.it("a solo player finishes the reduced tutorial night (3 waves, no boss)", function()
			local sim = NightSim.new(cfg, { seed = 3, members = { member(1, 10, "tide") }, onboarding = true })
			local result = run(sim)
			T.expect(sim.waveCount).toBe(3)
			T.expect(sim.boss).toBe(nil)
			T.expect(result.survived).toBeTruthy()
		end)

		T.it("a failed night pays 25% and resets the streak, and never takes anything", function()
			local sim = NightSim.new(cfg, { seed = 5, members = { member(1, 1, nil) } })
			-- Nobody defends.
			local dt = 1 / cfg.night.tickRate
			while not sim.ended do
				NightSim.step(sim, dt)
			end
			T.expect(sim.result.survived).toBeFalsy()
			local r = Rewards.compute(cfg, sim, { [1] = 4 }, {})[1]
			T.expect(r.streakAfter).toBe(0)
			local full = cfg.night.rewards.silverPerWave * sim.result.wavesSurvived
			T.expect(r.silver).toBe(math.floor(full * 0.25))
			T.expect(r.silver >= 0 and r.materials.driftwood >= 0).toBeTruthy()
		end)
	end)

	T.describe("Contribution", function()
		T.it("splits silver by contribution within the share bounds", function()
			local sim = NightSim.new(cfg, { seed = 1, members = { member(1, 10, "tide"), member(2, 10, "tide") } })
			sim.players[1].contribution = { damage = 300, repair = 0, weakPoints = 0 }
			sim.players[2].contribution = { damage = 0, repair = 200, weakPoints = 0 }
			sim.wavesCompleted = 6
			sim.result = { survived = true, wavesSurvived = 6, bossDefeated = false }
			local r = Rewards.compute(cfg, sim, {}, {})
			-- 300 damage points vs 300 repair points (200 HP * 1.5): equal shares.
			T.expect(r[1].share).toBeNear(1, 1e-9)
			T.expect(r[2].share).toBeNear(1, 1e-9)
		end)
	end)

	T.describe("Boss weak points", function()
		T.it("need every squad member to break the shield", function()
			local sim = NightSim.new(cfg, { seed = 2, members = { member(1, 10, "tide"), member(2, 10, "tide"), member(3, 10, "tide") } })
			sim.wave = 6
			sim.boss = { hp = 100, maxHp = 100, x = 12, y = 27, phase = 2, shielded = false, weakPoints = {}, stunnedUntil = -1, nextTelegraphAt = 999, defeated = false }
			sim.phase = "wave"
			sim.phaseEndsAt = 999
			NightSim.exposeWeakPoints(sim)
			T.expect(#sim.boss.weakPoints).toBe(3)
			for i = 1, 2 do
				local wp = sim.boss.weakPoints[i]
				sim.players[i].x, sim.players[i].y = wp.x, wp.y
				NightSim.setInput(sim, i, { attack = true })
			end
			NightSim.step(sim, 0.05)
			T.expect(sim.boss.shielded).toBeTruthy()
			local wp = sim.boss.weakPoints[3]
			sim.players[3].x, sim.players[3].y = wp.x, wp.y
			NightSim.setInput(sim, 3, { attack = true })
			NightSim.step(sim, 0.05)
			T.expect(sim.boss.shielded).toBeFalsy()
			T.expect(sim.t < sim.boss.stunnedUntil).toBeTruthy()
		end)
	end)

	T.describe("Smuggler", function()
		T.it("activates only with 3 opt-ins and only shows crates to the Smuggler", function()
			local few = NightSim.new(cfg, { seed = 4, members = { member(1, 10, nil, { smuggler = true }), member(2, 10, nil, { smuggler = true }) } })
			T.expect(few.smuggler).toBe(nil)
			local sim = NightSim.new(cfg, {
				seed = 4,
				members = { member(1, 10, nil, { smuggler = true }), member(2, 10, nil, { smuggler = true }), member(3, 10, nil, { smuggler = true }) },
			})
			T.expect(sim.smuggler ~= nil).toBeTruthy()
			local smugglerId = sim.smuggler.userId
			local other = if smugglerId == 1 then 2 else 1
			T.expect(NightSim.snapshot(sim, smugglerId).sm.crates ~= nil).toBeTruthy()
			T.expect(NightSim.snapshot(sim, other).sm.crates).toBe(nil)

			-- Smuggler picks up a crate; a squad mate inspects and catches them.
			local crate = sim.smuggler.crates[1]
			sim.players[smugglerId].x, sim.players[smugglerId].y = crate.x, crate.y
			NightSim.step(sim, 0.05)
			T.expect(sim.smuggler.carrying).toBe(1)
			sim.players[other].x, sim.players[other].y = crate.x + 1, crate.y
			NightSim.setInput(sim, other, { inspect = smugglerId })
			for _ = 1, 50 do
				NightSim.step(sim, 0.05)
			end
			T.expect(sim.smuggler.result).toBe("caught")
			-- One inspect per wave.
			T.expect(sim.players[other].inspectedWave).toBe(sim.wave)
		end)
	end)
end
