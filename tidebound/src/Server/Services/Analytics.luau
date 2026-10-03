--[[
	Analytics: Roblox AnalyticsService (custom, economy and onboarding funnel events) for the Creator Dashboard,
	plus batched full payloads to the companion backend for the KPI dashboard.
	Only the fields listed in AnalyticsEvents are sent, and no personal data is ever included.
]]

local AnalyticsService = game:GetService("AnalyticsService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Events = require(ReplicatedStorage.Shared.AnalyticsEvents)
local Onboarding = require(ReplicatedStorage.Shared.Onboarding)
local Backend = require(script.Parent.Backend)
local Logger = require(script.Parent.Logger)

local Analytics = {}

local FIELD_KEYS = { "CustomField01", "CustomField02", "CustomField03" }
local FLUSH_SECONDS = 30
local MAX_BUFFER = 500

local buffer = {}

function Analytics.track(player: Player, name: string, props: any?)
	local def = Events[name]
	if not def then
		Logger.warn("analytics_unknown_event", { name = name })
		return
	end
	props = props or {}
	local fields = {}
	for i, key in def.fields do
		local v = props[key]
		if v ~= nil then
			fields[Enum.AnalyticsCustomFieldKeys[FIELD_KEYS[i]].Name] = tostring(v)
		end
	end
	local value = if def.value then tonumber(props[def.value]) or 1 else 1
	pcall(AnalyticsService.LogCustomEvent, AnalyticsService, player, name, value, fields)
	if name == "tutorial_step" and props.index and props.index > 0 then
		pcall(AnalyticsService.LogOnboardingFunnelStepEvent, AnalyticsService, player, props.index, props.step)
	end
	if #buffer < MAX_BUFFER then
		table.insert(buffer, { name = name, userId = player.UserId, at = os.time(), props = props })
	end
end

-- Currency flows for the Roblox economy dashboard.
function Analytics.economy(player: Player, source: boolean, currency: string, amount: number, balance: number, transactionType: Enum.AnalyticsEconomyTransactionType, sku: string?)
	if amount <= 0 then
		return
	end
	pcall(
		AnalyticsService.LogEconomyEvent,
		AnalyticsService,
		player,
		if source then Enum.AnalyticsEconomyFlowType.Source else Enum.AnalyticsEconomyFlowType.Sink,
		currency,
		amount,
		balance,
		transactionType.Name,
		sku
	)
end

function Analytics.trackAll(player: Player, events: { any })
	for _, e in events do
		if Events[e.name] then
			Analytics.track(player, e.name, e.props)
		end
	end
end

function Analytics.onboardingSteps(): { string }
	return Onboarding.STEPS
end

local function flush()
	if #buffer == 0 or not Backend.enabled() then
		table.clear(buffer)
		return
	end
	local batch = buffer
	buffer = {}
	local ok, err = Backend.post("/v1/events", { events = batch })
	if not ok then
		Logger.warn("analytics_flush_failed", { error = tostring(err), count = #batch })
	end
end

function Analytics.init()
	task.spawn(function()
		while true do
			task.wait(FLUSH_SECONDS)
			flush()
		end
	end)
	game:BindToClose(flush)
end

return Analytics
