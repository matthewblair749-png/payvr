--[[
	What the client receives about its own save: everything it needs to draw every screen,
	minus internal bookkeeping (purchase ledger, processed receipt ids, rng-relevant cast secrets).
]]

local Tbl = require(script.Parent.Util.Tbl)
local Drifters = require(script.Parent.Rules.Drifters)
local Farming = require(script.Parent.Rules.Farming)
local Foraging = require(script.Parent.Rules.Foraging)
local Market = require(script.Parent.Rules.Market)
local Modifiers = require(script.Parent.Rules.Modifiers)
local Progression = require(script.Parent.Rules.Progression)
local TimeSim = require(script.Parent.Rules.TimeSim)
local Cycle = require(script.Parent.Rules.Cycle)
local Pass = require(script.Parent.Store.Pass)
local Spending = require(script.Parent.Store.Spending)

local ClientState = {}

function ClientState.build(cfg: any, save: any, now: number, mods: any, harborTiers: any): any
	local view = Tbl.deepCopy(save)
	view.purchases = nil
	if view.cast then
		-- The fish stays secret until the catch.
		view.cast.fishId = nil
	end
	local plotsReadyAt = {}
	for i, plot in save.plots do
		plotsReadyAt[i] = Farming.readyAt(cfg, plot, mods) or 0
	end
	local nodesReadyAt = {}
	for _, n in cfg.day.foraging.nodes do
		nodesReadyAt[n.id] = Foraging.readyAt(cfg, save, n.id)
	end
	local found, total = Progression.collectionProgress(cfg, save)
	local season, seasonEndsAt = Modifiers.season(cfg, now)
	view.derived = {
		now = now,
		cycle = Cycle.at(cfg, now),
		nextNightAt = Cycle.nextNightStart(cfg, now),
		activeSlots = Drifters.activeSlots(cfg, save.progress.level),
		storageCapacity = Drifters.storageCapacity(cfg, save),
		workerPerMinute = Drifters.workerIncomePerMinute(cfg, save),
		workerCap = TimeSim.workerCap(cfg, save),
		xpToNext = Progression.xpToNext(cfg, save.progress.level),
		plotsReadyAt = plotsReadyAt,
		nodesReadyAt = nodesReadyAt,
		demand = Market.demandTable(cfg, now),
		seasonId = season.id,
		seasonEndsAt = seasonEndsAt,
		passTier = Pass.tier(cfg, save),
		passOwned = Pass.ownsPaid(cfg, save, now),
		passEndsAt = Pass.blockEndsAt(cfg, now),
		collectionFound = found,
		collectionTotal = total,
		spentThisMonth = Spending.spentThisMonth(save, now),
		harborTiers = harborTiers,
		mods = mods,
		storeUnlocked = save.night.firstCompleted,
	}
	return view
end

return ClientState
