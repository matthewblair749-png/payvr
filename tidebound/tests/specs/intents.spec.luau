return function(T, Loader)
	local Shared = Loader.root("src/Shared")
	local ConfigLoader = Loader.require(Shared.ConfigLoader)
	local SaveSchema = Loader.require(Shared.SaveSchema)
	local IntentProcessor = Loader.require(Shared.Intents.IntentProcessor)
	local Rng = Loader.require(Shared.Util.Rng)
	local Hatchery = Loader.require(Shared.Rules.Hatchery)
	local Market = Loader.require(Shared.Rules.Market)
	local Notifications = Loader.require(Shared.Rules.Notifications)
	local Cycle = Loader.require(Shared.Rules.Cycle)
	local Time = Loader.require(Shared.Util.Time)

	local cfg = ConfigLoader.defaults()
	local NOW = Time.parseUtc("2026-10-05T12:00:00Z")

	local function ctx(now, cycleIndex)
		return { cfg = cfg, now = now or NOW, rng = Rng.new(1), userId = 1, mods = {}, cycleIndex = cycleIndex or 0 }
	end

	T.describe("Validation", function()
		T.it("rejects malformed intents and arguments", function()
			local save = SaveSchema.new(1, NOW, cfg)
			for _, bad in {
				"string",
				{ type = "nope" },
				{ type = "plant", args = { plot = 0 / 0, crop = "crop_sea_lettuce" } },
				{ type = "plant", args = { plot = 1.5, crop = "crop_sea_lettuce" } },
				{ type = "plant", args = { plot = 99, crop = "crop_sea_lettuce" } },
				{ type = "reel", args = { castId = 1, tap = math.huge } },
				{ type = "setRole", args = { drifter = "d1", role = "king" } },
				{ type = "feed", args = { drifter = ("x"):rep(500), item = "fish_minnowkin" } },
				{ type = "setSetting", args = { key = "textScale", value = 50 } },
				{ type = "contribute", args = { building = "market", materials = { driftwood = -5 } } },
			} do
				T.expect(IntentProcessor.apply(ctx(), save, bad).ok).toBeFalsy()
			end
		end)

		T.it("checks ownership, cost, and state", function()
			local save = SaveSchema.new(1, NOW, cfg)
			T.expect(IntentProcessor.apply(ctx(), save, { type = "setRole", args = { drifter = "d99", role = "guardian" } }).err).toBe("not_owned")
			T.expect(IntentProcessor.apply(ctx(), save, { type = "hatch" }).err).toBe("not_enough_silver")
			T.expect(IntentProcessor.apply(ctx(), save, { type = "harvest", args = { plot = 1 } }).err).toBe("plot_empty")
			T.expect(IntentProcessor.apply(ctx(), save, { type = "buyRod", args = { tier = 4 } }).err).toBe("level_too_low")
		end)

		T.it("allows one role switch per cycle", function()
			local save = SaveSchema.new(1, NOW, cfg)
			local d = Hatchery.hatch(cfg, save, Rng.new(1), NOW)
			T.expect(IntentProcessor.apply(ctx(NOW, 5), save, { type = "setRole", args = { drifter = d.id, role = "guardian" } }).ok).toBeTruthy()
			T.expect(IntentProcessor.apply(ctx(NOW, 5), save, { type = "setRole", args = { drifter = d.id, role = "worker" } }).err).toBe("role_switch_cooldown")
			T.expect(IntentProcessor.apply(ctx(NOW, 6), save, { type = "setRole", args = { drifter = d.id, role = "worker" } }).ok).toBeTruthy()
		end)

		T.it("rejects a fishing tap that claims to land before the bite", function()
			local save = SaveSchema.new(1, NOW, cfg)
			save.onboarding.done = true
			local cast = IntentProcessor.apply(ctx(), save, { type = "cast" })
			T.expect(cast.ok).toBeTruthy()
			local early = IntentProcessor.apply(ctx(cast.data.biteAt - 1), save, { type = "reel", args = { castId = cast.data.castId, tap = 0.5 } })
			T.expect(early.err).toBe("too_early")
			local onTime = IntentProcessor.apply(ctx(cast.data.biteAt + cast.data.zoneCenter + 0.1), save, { type = "reel", args = { castId = cast.data.castId, tap = cast.data.zoneCenter } })
			T.expect(onTime.ok and onTime.data.caught).toBeTruthy()
		end)
	end)

	T.describe("Day rules", function()
		T.it("keeps the market demand within +/-10% and the same for everyone on a date", function()
			for day = 0, 60 do
				for _, c in cfg.day.market.categories do
					local d = Market.demand(cfg, NOW + day * 86400, c)
					T.expect(d >= 0.9 and d <= 1.1).toBeTruthy()
				end
			end
		end)

		T.it("runs a 6 min day, 15 s dusk, 5 min night, 15 s dawn", function()
			local start = Cycle.at(cfg, NOW)
			local t = start.startsAt
			local seen = {}
			while t < start.startsAt + Cycle.length(cfg) * 2 do
				local p = Cycle.at(cfg, t)
				seen[p.phase] = p.endsAt - p.startsAt
				t = p.endsAt + 0.001
			end
			T.expect(seen.day).toBe(360)
			T.expect(seen.dusk).toBe(15)
			T.expect(seen.night).toBe(300)
			T.expect(seen.dawn).toBe(15)
		end)
	end)

	T.describe("Notifications", function()
		T.it("sends at most two a day, respects settings and quiet hours", function()
			local settings = { crops_ready = true, worker_income_full = true, night_starting = true, season_changed = false }
			local base = Time.parseUtc("2026-10-05T10:00:00Z")
			local plan = Notifications.plan(cfg, {
				{ type = "crops_ready", at = base },
				{ type = "worker_income_full", at = base + 600 },
				{ type = "night_starting", at = base + 1200 },
				{ type = "season_changed", at = base + 1800 },
				{ type = "night_starting", at = Time.parseUtc("2026-10-05T23:00:00Z") },
			}, settings, {}, 0)
			T.expect(#plan).toBe(2)
			T.expect(plan[1].type).toBe("crops_ready")
			T.expect(plan[2].type).toBe("night_starting")
		end)
	end)
end
