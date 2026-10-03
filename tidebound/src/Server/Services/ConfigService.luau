--[[
	Remote config. Defaults ship in the place (shared/config, via Rojo). Overrides are JSON Merge Patches
	stored in the LiveConfig DataStore by the companion backend (Open Cloud), which then publishes on the
	"tidebound-config" MessagingService topic so every running server reloads within seconds.
	Invalid overrides are rejected and the server keeps the last good config.
]]

local DataStoreService = game:GetService("DataStoreService")
local MessagingService = game:GetService("MessagingService")
local HttpService = game:GetService("HttpService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local ConfigLoader = require(Shared.ConfigLoader)
local Signal = require(Shared.Util.Signal)
local Logger = require(script.Parent.Logger)

local ConfigService = {}
ConfigService.Changed = Signal.new()

local STORE_NAME = "LiveConfig"
local KEY = "overrides"
local TOPIC = "tidebound-config"
local POLL_SECONDS = 300

local current = nil
local currentOverrides = nil
local defaults = nil

function ConfigService.get(): any
	return current
end

function ConfigService.overrides(): any
	return currentOverrides
end

local function fetchOverrides(): any
	local store = DataStoreService:GetDataStore(STORE_NAME)
	local ok, value = pcall(store.GetAsync, store, KEY)
	if not ok then
		Logger.warn("config_fetch_failed", { error = tostring(value) })
		return nil, false
	end
	if type(value) == "string" then
		local decoded
		ok, decoded = pcall(HttpService.JSONDecode, HttpService, value)
		value = if ok then decoded else nil
	end
	return value, true
end

function ConfigService.reload()
	local overrides, ok = fetchOverrides()
	if not ok then
		return
	end
	local cfg, errors = ConfigLoader.build(defaults, overrides)
	if #errors > 0 then
		Logger.error("config_rejected", { errors = errors })
		return
	end
	if current and cfg.version == current.version then
		return
	end
	current = cfg
	currentOverrides = overrides
	Logger.info("config_loaded", { version = cfg.version, overridden = overrides ~= nil })
	ConfigService.Changed:Fire(cfg)
end

function ConfigService.init()
	defaults = ConfigLoader.defaultSections()
	current = ConfigLoader.build(defaults, nil)
	ConfigService.reload()
	task.spawn(function()
		local ok, err = pcall(MessagingService.SubscribeAsync, MessagingService, TOPIC, function()
			-- Spread reloads so thousands of servers do not hit the DataStore at once.
			task.wait(math.random() * 10)
			ConfigService.reload()
		end)
		if not ok then
			Logger.warn("config_subscribe_failed", { error = tostring(err) })
		end
	end)
	task.spawn(function()
		while true do
			task.wait(POLL_SECONDS)
			ConfigService.reload()
		end
	end)
end

return ConfigService
