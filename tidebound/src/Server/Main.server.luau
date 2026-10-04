--[[
	Composition root: creates services in dependency order. Each service exposes init() and talks to
	the others through explicit requires and Signals, never through globals.
]]

local Players = game:GetService("Players")
local ScriptContext = game:GetService("ScriptContext")

local Services = script.Parent.Services
local Logger = require(Services.Logger)
local Remotes = require(Services.Remotes)
local Backend = require(Services.Backend)
local ConfigService = require(Services.ConfigService)
local DataService = require(Services.DataService)
local Analytics = require(Services.Analytics)
local WorldBuilder = require(Services.WorldBuilder)
local HarborService = require(Services.HarborService)
local PlayerService = require(Services.PlayerService)
local StoreService = require(Services.StoreService)
local NightService = require(Services.NightService)
local SocialService = require(Services.SocialService)
local AccountService = require(Services.AccountService)

-- Crash reporting: uncaught server errors become structured logs (and reach the backend when configured).
ScriptContext.Error:Connect(function(message, trace)
	Logger.error("server_error", { message = message, trace = trace })
end)

Remotes.init()
Backend.init()
Logger.setSink(function(level, entry)
	if level == "error" and Backend.enabled() then
		Backend.post("/v1/logs", entry)
	end
end)
ConfigService.init()
DataService.init()
Analytics.init()
WorldBuilder.init(ConfigService.get())
WorldBuilder.buildHarbor(ConfigService.get())
HarborService.init()
WorldBuilder.applyHarborTiers(HarborService.tiers())
HarborService.Changed:Connect(function(state)
	WorldBuilder.applyHarborTiers(state.tiers)
end)
-- Store and Night subscribe to PlayerService signals, so they start before players are handled.
StoreService.init()
NightService.init()
SocialService.init()
AccountService.init()

local debugFolder = script.Parent:FindFirstChild("Debug")
if debugFolder and debugFolder:FindFirstChild("DebugService") then
	require(debugFolder.DebugService).init()
	Logger.warn("debug_panel_enabled", {})
end

PlayerService.init()
Players.CharacterAutoLoads = true
Logger.info("server_started", { configVersion = ConfigService.get().version })
