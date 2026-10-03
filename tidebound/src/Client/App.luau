--[[
	Client composition root state: config, the player's state view, settings, translator, panels and toasts.
	Screens and controllers talk to each other through app signals, not through each other.
]]

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local LocalizationService = game:GetService("LocalizationService")
local HapticService = game:GetService("HapticService")
local GuiService = game:GetService("GuiService")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local ConfigLoader = require(Shared.ConfigLoader)
local Signal = require(Shared.Util.Signal)

local Ui = require(script.Parent.Ui.Ui)
local Theme = require(script.Parent.Ui.Theme)
local Net = require(script.Parent.Net)

local App = {}
App.__index = App

function App.new()
	local self = setmetatable({}, App)
	self.player = Players.LocalPlayer
	self.userId = self.player.UserId
	self.remotes = ReplicatedStorage:WaitForChild("Remotes")
	self.StateChanged = Signal.new()
	self.ConfigChanged = Signal.new()
	self.ConnectionChanged = Signal.new()
	self.PanelChanged = Signal.new()
	self.Toast = Signal.new()
	self.state = nil
	self.predicted = false
	self.connection = "online"
	self.panels = {}
	self.openPanel = nil
	self.catalog = nil
	-- Safe defaults baked into the place; remote overrides arrive in loadConfig.
	self.cfg = ConfigLoader.defaults()
	self.translator = nil
	local ok, translator = pcall(LocalizationService.GetTranslatorForPlayerAsync, LocalizationService, self.player)
	if ok then
		self.translator = translator
	end
	self.L = function(key: string, args: any?): string
		return self:translate(key, args)
	end
	Ui.setTranslator(self.L)
	self.net = Net.new(self)
	return self
end

-- Looks up a string key; falls back to the key so missing strings are visible in testing.
function App:translate(key: string, args: any?): string
	if self.translator then
		local ok, text = pcall(self.translator.FormatByKey, self.translator, key, args)
		if ok and text then
			return text
		end
	end
	return key
end

function App:loadConfig()
	local ok, reply = pcall(self.remotes.Store.InvokeServer, self.remotes.Store, "config")
	if ok and reply and reply.ok then
		local cfg = ConfigLoader.build(ConfigLoader.defaultSections(), reply.data.overrides)
		self.cfg = cfg
		self.ConfigChanged:Fire(cfg)
	end
end

function App:setState(state: any, predicted: boolean?)
	self.state = state
	self.predicted = predicted == true
	local s = state.settings
	if s then
		local reduced = s.reducedMotion
		local okSystem, systemReduced = pcall(function()
			return GuiService.ReducedMotionEnabled
		end)
		Theme.reducedMotion = reduced or (okSystem and systemReduced == true)
		if Theme.textScale ~= s.textScale then
			Theme.textScale = s.textScale
			self.PanelChanged:Fire(self.openPanel)
		end
	end
	self.StateChanged:Fire(state)
end

function App:setConnection(status: string)
	if self.connection ~= status then
		self.connection = status
		self.ConnectionChanged:Fire(status)
	end
end

function App:toast(text: string)
	self.Toast:Fire(text)
end

function App:haptic(strength: number?)
	if not self.state or not self.state.settings.haptics then
		return
	end
	pcall(function()
		if HapticService:IsVibrationSupported(Enum.UserInputType.Gamepad1) then
			HapticService:SetMotor(Enum.UserInputType.Gamepad1, Enum.VibrationMotor.Small, strength or 0.4)
			task.delay(0.08, function()
				HapticService:SetMotor(Enum.UserInputType.Gamepad1, Enum.VibrationMotor.Small, 0)
			end)
		end
	end)
end

function App:registerPanel(name: string, module: any)
	self.panels[name] = module
end

function App:open(name: string, args: any?)
	if not self.panels[name] then
		return
	end
	self.openPanel = name
	self.panelArgs = args
	self.PanelChanged:Fire(name)
end

function App:close()
	self.openPanel = nil
	self.panelArgs = nil
	self.PanelChanged:Fire(nil)
end

function App:intent(intentType: string, args: any?): any
	return self.net:send(intentType, args)
end

function App:store(action: string, args: any?): any
	local ok, reply = pcall(self.remotes.Store.InvokeServer, self.remotes.Store, action, args)
	if not ok then
		return { ok = false, err = "network" }
	end
	if not reply.ok and reply.err then
		self:toast(self.L("err_" .. reply.err))
	end
	return reply
end

function App:track(name: string, props: any?)
	self.remotes.Track:FireServer(name, props)
end

return App
