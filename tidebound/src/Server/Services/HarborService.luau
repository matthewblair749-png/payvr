--[[
	The shared harbor everyone funds. Global state lives in the "Harbor" DataStore under one key and is
	changed only with UpdateAsync, so contributions from many servers never overwrite each other.
	Servers cache it, refresh every 30 seconds, and hear about tier unlocks right away over MessagingService.
]]

local MessagingService = game:GetService("MessagingService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Harbor = require(Shared.Rules.Harbor)
local Signal = require(Shared.Util.Signal)
local Stores = require(script.Parent.Stores)
local ConfigService = require(script.Parent.ConfigService)
local Logger = require(script.Parent.Logger)

local HarborService = {}
HarborService.Changed = Signal.new()

local STORE = "Harbor"
local KEY = "global"
local TOPIC = "tidebound-harbor"
local REFRESH_SECONDS = 30

local store = nil
local state = nil

function HarborService.state(): any
	return state
end

function HarborService.tiers(): { [string]: number }
	return state and state.tiers or {}
end

local function refresh()
	local ok, value = pcall(store.GetAsync, store, KEY)
	if ok then
		local cfg = ConfigService.get()
		state = value or Harbor.newState(cfg)
		HarborService.Changed:Fire(state)
	else
		Logger.warn("harbor_refresh_failed", { error = tostring(value) })
	end
end

--[[
	Applies a contribution already taken from the player's save. If the shared write fails,
	returns false and the caller gives the materials back.
]]
function HarborService.contribute(contribution: any): (boolean, { any })
	local cfg = ConfigService.get()
	local unlocked = {}
	local ok, err = pcall(store.UpdateAsync, store, KEY, function(old)
		local s = old or Harbor.newState(cfg)
		unlocked = Harbor.applyContribution(cfg, s, contribution)
		s.contributors = (s.contributors or 0) + 1
		state = s
		return s
	end)
	if not ok then
		Logger.error("harbor_contribute_failed", { error = tostring(err) })
		return false, {}
	end
	HarborService.Changed:Fire(state)
	if #unlocked > 0 then
		pcall(MessagingService.PublishAsync, MessagingService, TOPIC, "unlocked")
		Logger.info("harbor_tier_unlocked", { unlocked = unlocked })
	end
	return true, unlocked
end

function HarborService.init()
	store = Stores.get(STORE)
	state = Harbor.newState(ConfigService.get())
	refresh()
	task.spawn(function()
		pcall(MessagingService.SubscribeAsync, MessagingService, TOPIC, function()
			refresh()
		end)
	end)
	task.spawn(function()
		while true do
			task.wait(REFRESH_SECONDS)
			refresh()
		end
	end)
end

return HarborService
