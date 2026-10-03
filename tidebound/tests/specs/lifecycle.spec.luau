--[[
	Acceptance: a new player finishes onboarding, runs a full day, plays a full night in a squad,
	leaves, comes back, and finds progress intact (including capped offline progress).
	The save goes through a JSON round trip, the same as a DataStore write and read.
]]
return function(T, Loader)
	local serde = require("@lune/serde")
	local Shared = Loader.root("src/Shared")
	local ConfigLoader = Loader.require(Shared.ConfigLoader)
	local PlayerSim = Loader.require(Shared.Sim.PlayerSim)
	local Session = Loader.require(Shared.Session)
	local NightSim = Loader.require(Shared.Night.NightSim)
	local Rewards = Loader.require(Shared.Night.Rewards)
	local Bot = Loader.require(Shared.Night.Bot)
	local Drifters = Loader.require(Shared.Rules.Drifters)
	local Purchases = Loader.require(Shared.Store.Purchases)
	local Catalog = Loader.require(Shared.Store.Catalog)
	local Time = Loader.require(Shared.Util.Time)

	local cfg = ConfigLoader.defaults()
	local START = Time.parseUtc("2026-10-05T12:00:00Z")

	local function playNight(players, onboarding)
		local members = {}
		for i, p in players do
			local g = Drifters.guardianProfile(cfg, p.save)
			members[i] = { userId = p.userId, power = g.power, speed = g.speed, element = g.element, repairPct = g.repairPct, ironScrap = p.save.materials.ironScrap }
		end
		local sim = NightSim.new(cfg, { seed = 8, members = members, onboarding = onboarding })
		while not sim.ended do
			for _, id in sim.playerOrder do
				NightSim.setInput(sim, id, Bot.input(sim, id, nil))
			end
			NightSim.step(sim, 1 / cfg.night.tickRate)
		end
		local streaks = {}
		for _, p in players do
			streaks[p.userId] = p.save.night.streak
		end
		return sim, Rewards.compute(cfg, sim, streaks, {})
	end

	T.it("new player: onboarding, day, tutorial night, squad night, leave and return", function()
		local p = PlayerSim.new(cfg, 501, START, 4)
		T.expect(p.joinSummary.isNew).toBeTruthy()
		PlayerSim.tutorial(p)
		T.expect(p.save.onboarding.done).toBeTruthy()
		T.expect(#p.save.drifters).toBe(1)
		T.expect(p.save.drifters[1].speciesId).toBe(cfg.drifters.onboardingSpeciesId)
		local stepsLogged = #p.save.onboarding.log
		T.expect(stepsLogged).toBe(6) -- welcome .. countdown; first_night comes after the night

		-- No purchase prompt is allowed yet.
		T.expect(Purchases.canBuy(cfg, p.save, Catalog.product(cfg, "starter_pack", 501), p.now, nil)).toBe("store_locked")

		-- Play the rest of the first day, then make the Drifter a Guardian for the night.
		PlayerSim.playDay(p, p.save.onboarding.firstNightAt)
		local drifter = p.save.drifters[1]
		T.expect(PlayerSim.act(p, "setRole", { drifter = drifter.id, role = "guardian" }).ok).toBeTruthy()

		-- Reduced first night (3 waves, no boss).
		local sim, rewards = playNight({ p }, true)
		T.expect(sim.waveCount).toBe(3)
		local events = Session.settleNight(cfg, p.save, "tutorial-501", rewards[p.userId], p.now)
		T.expect(p.save.night.firstCompleted).toBeTruthy()
		local names = {}
		for _, e in events do
			names[e.name] = true
		end
		T.expect(names.tutorial_step).toBeTruthy()
		T.expect(names.starter_offer_eligible).toBeTruthy()
		-- Settling the same night again changes nothing.
		local silver = p.save.currencies.silver
		T.expect(#Session.settleNight(cfg, p.save, "tutorial-501", rewards[p.userId], p.now)).toBe(0)
		T.expect(p.save.currencies.silver).toBe(silver)
		-- The store opens after the first night.
		T.expect(Purchases.canBuy(cfg, p.save, Catalog.product(cfg, "starter_pack", 501), p.now, nil)).toBe(nil)

		-- A full night with a squad of four other players.
		local squad = { p }
		for i = 1, 4 do
			local mate = PlayerSim.new(cfg, 600 + i, START, 600 + i)
			PlayerSim.tutorial(mate)
			mate.save.drifters[1].role = "guardian"
			mate.save.drifters[1].level = 5
			mate.save.materials.ironScrap = 30
			table.insert(squad, mate)
		end
		local fullSim, fullRewards = playNight(squad, false)
		T.expect(fullSim.waveCount).toBe(6)
		T.expect(fullSim.result.survived).toBeTruthy()
		Session.settleNight(cfg, p.save, "night-1", fullRewards[p.userId], p.now)
		T.expect(p.save.night.played).toBe(2)

		-- Leave: the save is written as JSON, as DataStores do.
		local level, xp = p.save.progress.level, p.save.progress.xp
		local silverBefore = p.save.currencies.silver
		local drifterCount = #p.save.drifters
		p.save.drifters[1].role = "worker"
		Session.leave(p.save, p.now)
		local stored = serde.encode("json", p.save)

		-- Return 12 hours later: offline progress is capped at 8 hours.
		local returnAt = p.now + 12 * 3600
		local back, summary = Session.join(cfg, serde.decode("json", stored), 501, returnAt, p.mods)
		T.expect(summary.isNew).toBeFalsy()
		T.expect(summary.away.seconds).toBe(cfg.cycle.offlineCapHours * 3600)
		T.expect(back.progress.level).toBe(level)
		T.expect(back.progress.xp).toBe(xp)
		T.expect(#back.drifters).toBe(drifterCount)
		T.expect(back.night.firstCompleted).toBeTruthy()
		T.expect(back.currencies.silver).toBeAtLeast(silverBefore)
		T.expect(back.worker.pending).toBeAtLeast(1)
		-- Crops planted before leaving are ready.
		local ready = 0
		for _, plot in back.plots do
			if plot.cropId then
				ready += 1
			end
		end
		T.expect(ready).toBeAtLeast(1)
	end)
end
