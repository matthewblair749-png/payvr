--[[
	Scripted "typical new player" used by the balance tests and the balance report.
	It plays through IntentProcessor exactly as a client would, with human timing:
	about 1 second of overhead per action and tap accuracy within +/-0.3 s of the zone centre.
]]

local Rng = require(script.Parent.Parent.Util.Rng)
local IntentProcessor = require(script.Parent.Parent.Intents.IntentProcessor)
local Session = require(script.Parent.Parent.Session)
local Modifiers = require(script.Parent.Parent.Rules.Modifiers)
local Cycle = require(script.Parent.Parent.Rules.Cycle)
local Farming = require(script.Parent.Parent.Rules.Farming)
local Foraging = require(script.Parent.Parent.Rules.Foraging)

local PlayerSim = {}

local ACTION_OVERHEAD = 1.0

function PlayerSim.new(cfg: any, userId: number, startAt: number, seed: number): any
	local mods = Modifiers.current(cfg, startAt, nil)
	-- A neutral season so balance numbers do not depend on the week the test runs.
	for k in mods do
		mods[k] = 0
	end
	local save, summary = Session.join(cfg, nil, userId, startAt, mods)
	return {
		cfg = cfg,
		save = save,
		now = startAt,
		startAt = startAt,
		rng = Rng.new(seed),
		skill = Rng.new(seed + 1),
		mods = mods,
		userId = userId,
		earned = 0,
		log = {},
		joinSummary = summary,
	}
end

function PlayerSim.ctx(p: any): any
	return { cfg = p.cfg, now = p.now, rng = p.rng, userId = p.userId, mods = p.mods, cycleIndex = Cycle.at(p.cfg, p.now).cycleIndex, adsAllowed = false }
end

function PlayerSim.act(p: any, intentType: string, args: any?): any
	local result = IntentProcessor.apply(PlayerSim.ctx(p), p.save, { type = intentType, args = args })
	if result.ok and (intentType == "sellAll" or intentType == "collectWorkers") then
		p.earned += result.data.silver
	elseif result.ok and intentType == "plant" then
		-- Net Silver: seeds are a cost of farming.
		p.earned -= p.cfg.index.crops[args.crop].seedCost
	end
	return result
end

function PlayerSim.wait(p: any, seconds: number)
	p.now += seconds
	Session.tick(p.cfg, p.save, p.now, p.mods)
end

function PlayerSim.fishOnce(p: any): boolean
	local cast = PlayerSim.act(p, "cast")
	if not cast.ok then
		return false
	end
	local d = cast.data
	local tap = math.clamp(d.zoneCenter + (p.skill:nextNumber() * 0.6 - 0.3), 0, d.minigameSeconds)
	PlayerSim.wait(p, d.biteAt - p.now + tap + 0.15)
	local reel = PlayerSim.act(p, "reel", { castId = d.castId, tap = tap })
	PlayerSim.wait(p, ACTION_OVERHEAD)
	return reel.ok and reel.data.caught
end

-- Runs the tutorial the way the guided flow does. Returns seconds taken.
function PlayerSim.tutorial(p: any): number
	local t0 = p.now
	PlayerSim.act(p, "onboarding", { action = "start" })
	PlayerSim.wait(p, 3)
	assert(PlayerSim.fishOnce(p), "tutorial cast must succeed")
	PlayerSim.wait(p, 2)
	assert(PlayerSim.act(p, "sellAll").ok, "tutorial sale failed")
	PlayerSim.wait(p, 2)
	local hatch = PlayerSim.act(p, "hatch")
	assert(hatch.ok, "tutorial hatch failed: " .. tostring(hatch.err))
	PlayerSim.wait(p, 5)
	assert(PlayerSim.act(p, "setRole", { drifter = hatch.data.drifter.id, role = "worker" }).ok, "tutorial role assignment failed")
	PlayerSim.wait(p, 2)
	return p.now - t0
end

--[[
	Plays the day until `untilTime`: keeps plots planted, forages ready nodes, fishes in between,
	sells and collects Worker income about once a minute.
]]
function PlayerSim.playDay(p: any, untilTime: number)
	local cfg = p.cfg
	local lastSell = p.now
	while p.now < untilTime do
		local acted = false
		for i, plot in p.save.plots do
			local ready = Farming.readyAt(cfg, plot, p.mods)
			if ready and p.now >= ready then
				PlayerSim.act(p, "harvest", { plot = i })
				PlayerSim.wait(p, 0.5)
				acted = true
			end
		end
		for i, plot in p.save.plots do
			if not plot.cropId and p.save.currencies.silver >= 20 then
				PlayerSim.act(p, "plant", { plot = i, crop = "crop_sea_lettuce" })
				PlayerSim.wait(p, 0.5)
				acted = true
			end
		end
		for _, node in cfg.day.foraging.nodes do
			if p.now >= Foraging.readyAt(cfg, p.save, node.id) then
				PlayerSim.act(p, "forage", { node = node.id })
				PlayerSim.wait(p, 1.5)
				acted = true
			end
		end
		if p.now - lastSell >= 60 then
			PlayerSim.act(p, "sellAll")
			PlayerSim.act(p, "collectWorkers")
			lastSell = p.now
			PlayerSim.wait(p, 1)
			acted = true
		end
		PlayerSim.fishOnce(p)
		if not acted and p.now >= untilTime then
			break
		end
	end
	PlayerSim.act(p, "sellAll")
	PlayerSim.act(p, "collectWorkers")
end

return PlayerSim
