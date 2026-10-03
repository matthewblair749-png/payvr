--[[
	Advances everything time-based in a save: happiness decay, Worker income, auto-collect and play time.
	Runs on join (covering time away, capped at offlineCapHours) and on every server tick for online players.
]]

local Drifters = require(script.Parent.Drifters)
local Farming = require(script.Parent.Farming)

local TimeSim = {}

function TimeSim.workerCap(cfg: any, save: any): number
	return Drifters.workerIncomePerMinute(cfg, save) * 60 * cfg.economy.worker.pendingCapHours
end

--[[
	online = true while the player is in the server (play time counts); false for time away.
	Returns a summary used by the "while you were away" panel.
]]
function TimeSim.advance(cfg: any, save: any, now: number, mods: any, online: boolean): any
	local elapsed = now - save.lastSimAt
	if elapsed <= 0 then
		return { seconds = 0, silver = 0 }
	end
	local capped = math.min(elapsed, cfg.cycle.offlineCapHours * 3600)
	-- Income uses happiness at the start of the step; steps are short online and capped offline.
	local rate = Drifters.workerIncomePerMinute(cfg, save)
	local cap = TimeSim.workerCap(cfg, save)
	local before = save.worker.pending
	save.worker.pending = math.min(cap, save.worker.pending + rate * capped / 60)
	local earned = save.worker.pending - before
	for _, d in save.drifters do
		if d.active then
			Drifters.decayHappiness(cfg, d, capped, mods.happinessDecayPct or 0)
		end
	end
	if online then
		save.progress.playSeconds += elapsed
	end
	save.lastSimAt = now
	local collected = 0
	local harvested = 0
	local Club = require(script.Parent.Parent.Store.Club)
	if Club.autoCollect(save) then
		collected = TimeSim.collect(save)
		for i, plot in save.plots do
			local ready = Farming.readyAt(cfg, plot, mods)
			if ready and now >= ready then
				Farming.harvest(cfg, save, i, now, mods)
				harvested += 1
			end
		end
	end
	return { seconds = capped, silver = earned, autoCollected = collected, autoHarvested = harvested, full = save.worker.pending >= cap and cap > 0 }
end

-- Moves pending Worker income into the wallet. Returns Silver collected.
function TimeSim.collect(save: any): number
	local amount = math.floor(save.worker.pending)
	if amount <= 0 then
		return 0
	end
	save.worker.pending -= amount
	local Ledger = require(script.Parent.Parent.Store.Ledger)
	Ledger.addCurrency(save, "silver", amount)
	return amount
end

return TimeSim
