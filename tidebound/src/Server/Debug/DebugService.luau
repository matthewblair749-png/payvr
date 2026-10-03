--[[
	Cheat menu for testing. Only included by default.project.json (development); release.project.json
	leaves this folder out, so it does not exist in published builds. As a second guard it answers only
	in Studio or for user ids in the "DebugTesters" attribute on a place with "IsTestPlace" set.
]]

local RunService = game:GetService("RunService")
local ServerScriptService = game:GetService("ServerScriptService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Ledger = require(Shared.Store.Ledger)
local Hatchery = require(Shared.Rules.Hatchery)
local Rng = require(Shared.Util.Rng)

local Services = ServerScriptService.Server.Services
local DataService = require(Services.DataService)
local PlayerService = require(Services.PlayerService)
local NightService = require(Services.NightService)
local ConfigService = require(Services.ConfigService)
local Remotes = require(Services.Remotes)
local Logger = require(Services.Logger)

local DebugService = {}

local function allowed(player: Player): boolean
	if RunService:IsStudio() then
		return true
	end
	local root = ServerScriptService.Server
	if root:GetAttribute("IsTestPlace") ~= true then
		return false
	end
	local testers = tostring(root:GetAttribute("DebugTesters") or "")
	return string.find("," .. testers .. ",", "," .. player.UserId .. ",", 1, true) ~= nil
end

local COMMANDS = {
	silver = function(_player, save, amount)
		Ledger.addCurrency(save, "silver", math.clamp(tonumber(amount) or 1000, 0, 1e7))
	end,
	gems = function(_player, save, amount)
		Ledger.addCurrency(save, "gems", math.clamp(tonumber(amount) or 1000, 0, 1e7))
	end,
	materials = function(_player, save)
		for m in save.materials do
			save.materials[m] += 500
		end
	end,
	level = function(_player, save, level)
		save.progress.level = math.clamp(tonumber(level) or 10, 1, 50)
	end,
	finishTutorial = function(_player, save)
		save.onboarding.done = true
		save.onboarding.skipped = true
		save.night.firstCompleted = true
	end,
	tutorialNightNow = function(_player, save)
		save.onboarding.firstNightAt = PlayerService.now()
	end,
	nightNow = function(player)
		NightService.debugStartNow(player, false)
	end,
	skipTime = function(_player, save, minutes)
		-- Moves the save's clocks back so timers complete, as if time passed.
		local s = (tonumber(minutes) or 10) * 60
		for _, plot in save.plots do
			if plot.cropId then
				plot.plantedAt -= s
			end
		end
		for id, t in save.forage do
			save.forage[id] = t - s
		end
		save.lastSimAt -= s
	end,
	hatch = function(_player, save, count)
		local cfg = ConfigService.get()
		local rng = Rng.fromRandom(Random.new())
		for _ = 1, math.clamp(tonumber(count) or 1, 1, 100) do
			Hatchery.hatch(cfg, save, rng, PlayerService.now())
		end
	end,
	resetSave = function(player)
		DataService.erase(player.UserId)
	end,
}

function DebugService.init()
	Remotes.get("Debug").OnServerInvoke = function(player, command, arg)
		if not allowed(player) then
			return { ok = false, err = "not_allowed" }
		end
		local fn = COMMANDS[command]
		local save = DataService.saveOf(player)
		if not fn or not save then
			return { ok = false, err = "unknown_command" }
		end
		Logger.warn("debug_command", { userId = player.UserId, command = command, arg = tostring(arg) })
		fn(player, save, arg)
		PlayerService.pushState(player)
		return { ok = true }
	end
end

return DebugService
