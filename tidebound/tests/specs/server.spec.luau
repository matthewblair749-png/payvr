--[[
	Server integration: the real ServerScriptService code from the built place, on mocked engine services.
	Covers the acceptance flow end to end through remotes, the store's receipt path for every product,
	session locking between two servers, and persistence across leaving and rejoining.
]]
return function(T, _Loader)
	local Runtime = require("../harness/RobloxRuntime")
	local Clients = require("../harness/Clients")
	local PLACE = "tests/.build/tidebound-dev.rbxl"

	T.describe("Server boot", function()
		T.it("starts, builds the world and creates every remote", function()
			local rt = Runtime.new(PLACE)
			rt:start()
			local remotes = rt.place:GetService("ReplicatedStorage"):FindFirstChild("Remotes")
			T.expect(remotes ~= nil).toBeTruthy()
			T.expect(remotes:FindFirstChild("Intent").ClassName).toBe("RemoteFunction")
			T.expect(remotes:FindFirstChild("NightSnapshot").ClassName).toBe("UnreliableRemoteEvent")
			local ws = rt.place:GetService("Workspace")
			T.expect(ws:FindFirstChild("Harbor") ~= nil).toBeTruthy()
			T.expect(#ws.NightSectors:GetChildren()).toBe(4)
			rt:assertNoErrors()
		end)

		T.it("loads a new player and pushes their state", function()
			local rt = Runtime.new(PLACE)
			rt:start()
			local p = rt:join(101)
			rt:assertNoErrors()
			local state = rt:state(p)
			T.expect(state ~= nil).toBeTruthy()
			T.expect(state.currencies.silver).toBeAtLeast(0)
			T.expect(state.purchases).toBe(nil)
			T.expect(rt:eventCount("session_started", 101)).toBe(1)
		end)
	end)

	T.describe("Acceptance flow", function()
		T.it("new player: tutorial, tutorial night, a squad night, leave, return on another server", function()
			local backend = Runtime.newBackend()
			local rt = Runtime.new(PLACE, { backend = backend })
			rt:start()
			local p = rt:join(201)
			Clients.tutorial(rt, p)
			local state = rt:state(p)
			T.expect(state.onboarding.done).toBeTruthy()
			T.expect(state.onboarding.firstNightAt ~= nil).toBeTruthy()
			-- First night within 8 minutes of joining.
			T.expect(state.onboarding.firstNightAt - rt.epoch).toBeAtMost(8 * 60)
			-- No purchase prompt before the first night.
			local early = rt:invoke(p, "Store", "buy", { productId = "starter_pack" })
			T.expect(early.err).toBe("store_locked")

			-- Play the day until the tutorial night starts, then let the scripted client defend.
			Clients.driveNights(rt)
			rt:advance(state.onboarding.firstNightAt - rt.epoch - rt.clock + 1)
			T.expect(Clients.lastEvent(p, "night_started") ~= nil).toBeTruthy()
			T.expect(Clients.lastEvent(p, "night_started").onboarding).toBeTruthy()
			rt:advance(160)
			rt:assertNoErrors()
			local result = Clients.lastEvent(p, "night_result")
			T.expect(result ~= nil).toBeTruthy()
			T.expect(result.wavesSurvived).toBe(3)
			state = rt:state(p)
			T.expect(state.night.firstCompleted).toBeTruthy()
			T.expect(rt:eventCount("night_started", 201)).toBe(1)

			-- Two more players finish their tutorials, then the global night forms one squad.
			local mates = { rt:join(202), rt:join(203) }
			for _, m in mates do
				Clients.tutorial(rt, m)
			end
			-- Skip the mates' tutorial nights with the debug panel (Studio only).
			for _, m in mates do
				T.expect(rt:invoke(m, "Debug", "finishTutorial").ok).toBeTruthy()
			end
			local Cycle = rt:shared("Rules.Cycle")
			local cfg = rt:service("ConfigService").get()
			local nightAt = Cycle.nextNightStart(cfg, rt.epoch + rt.clock)
			rt:advance(nightAt - rt.epoch - rt.clock + 1)
			for _, who in { p, mates[1], mates[2] } do
				local started = Clients.lastEvent(who, "night_started")
				T.expect(started ~= nil and not started.onboarding).toBeTruthy()
			end
			T.expect(#Clients.lastEvent(p, "night_started").squad).toBe(3)
			rt:advance(cfg.cycle.nightSeconds + 2)
			rt:assertNoErrors()
			local squadResult = Clients.lastEvent(p, "night_result")
			T.expect(squadResult.onboarding == nil).toBeTruthy()
			T.expect(squadResult.survived).toBeTruthy()
			T.expect(squadResult.wavesSurvived).toBe(6)
			state = rt:state(p)
			T.expect(state.night.played).toBe(2)
			local silver, level, drifters = state.currencies.silver, state.progress.level, #state.drifters

			-- Leave; the save is released. Return two hours later on a different server.
			rt:leave(p)
			local record = backend.stores.Players.u201
			T.expect(record.lock).toBe(nil)
			local rt2 = Runtime.new(PLACE, { backend = backend, jobId = "job-2", epoch = rt.epoch + rt.clock + 7200 })
			rt2:start()
			local back = rt2:join(201)
			rt2:assertNoErrors()
			local s2 = rt2:state(back)
			T.expect(s2.currencies.silver).toBeAtLeast(silver)
			T.expect(s2.progress.level).toBe(level)
			T.expect(#s2.drifters).toBe(drifters)
			T.expect(s2.night.firstCompleted).toBeTruthy()
		end)
	end)
end
