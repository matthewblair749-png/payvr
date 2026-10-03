--[[ Client composition root: builds the app, mounts the UI, and wires state from the server. ]]

local Players = game:GetService("Players")
local ScriptContext = game:GetService("ScriptContext")
local TextChatService = game:GetService("TextChatService")
local GuiService = game:GetService("GuiService")

local App = require(script.Parent.App)
local Ui = require(script.Parent.Ui.Ui)
local Theme = require(script.Parent.Ui.Theme)
local PanelHost = require(script.Parent.Ui.PanelHost)
local Hud = require(script.Parent.Screens.Hud)
local Onboarding = require(script.Parent.Screens.Onboarding)
local NightClient = require(script.Parent.Night.NightClient)
local QuickChat = require(script.Parent.QuickChat)
local ForageNodes = require(script.Parent.World.ForageNodes)

local player = Players.LocalPlayer
local app = App.new()

-- No free-text chat: hide the chat window and input bar (the server also creates no channels).
pcall(function()
	TextChatService.ChatWindowConfiguration.Enabled = false
	TextChatService.ChatInputBarConfiguration.Enabled = false
end)

-- Client crash reports (rate limited on the server).
ScriptContext.Error:Connect(function(message, trace)
	app.remotes.ClientError:FireServer(message, trace)
end)

local screens = script.Parent.Screens
for _, name in { "Fishing", "Farm", "Market", "Inventory", "Drifters", "Collection", "Hatch", "Odds", "Harbor", "Quests", "Pass", "Shop", "Spending", "Settings", "Privacy", "StarterOffer", "Welcome", "Debug", "NightResult", "People" } do
	local key = string.lower(string.sub(name, 1, 1)) .. string.sub(name, 2)
	app:registerPanel(key, require(screens[name]))
end
app.panels.squad = { title = "panel_squad", build = function(a, container)
	app.panels.people.build(a, container, { squad = true })
end, static = true }

local playerGui = player:WaitForChild("PlayerGui")
local main = Ui.screen("Tidebound", playerGui, 1)
local overlay = Ui.screen("TideboundOverlay", playerGui, 5)

-- Toasts and the reconnect banner.
local toast = Ui.text(overlay, "", { Position = UDim2.new(0.5, 0, 0, 74), AnchorPoint = Vector2.new(0.5, 0), Size = UDim2.new(0.8, 0, 0, 0), TextXAlignment = Enum.TextXAlignment.Center, BackgroundTransparency = 0.1, BackgroundColor3 = Theme.colors.panelAlt, Visible = false })
Ui.corner(toast, 10)
Ui.padding(toast, 8)
local toastSerial = 0
app.Toast:Connect(function(text)
	toastSerial += 1
	local mine = toastSerial
	toast.Text = text
	toast.Visible = true
	task.delay(2.5, function()
		if toastSerial == mine then
			toast.Visible = false
		end
	end)
end)
local banner = Ui.text(overlay, app.L("reconnecting"), { Position = UDim2.new(0.5, 0, 1, -70), AnchorPoint = Vector2.new(0.5, 0), Size = UDim2.new(0.6, 0, 0, 0), TextXAlignment = Enum.TextXAlignment.Center, BackgroundTransparency = 0, BackgroundColor3 = Theme.colors.bad, Visible = false })
Ui.corner(banner, 10)
Ui.padding(banner, 8)
app.ConnectionChanged:Connect(function(status)
	banner.Visible = status ~= "online"
end)

Hud.mount(app, main)
PanelHost.mount(app, overlay)
Onboarding.mount(app, overlay)
NightClient.mount(app, main)
QuickChat.mount(app, main)

-- People button sits next to quick chat so report and block are always one tap away.
Ui.button(main, "👥", function()
	app:open("people")
end, { Size = UDim2.fromOffset(56, 56), Position = UDim2.new(0, 72, 1, -130), TextSize = 22 })

app.remotes.State.OnClientEvent:Connect(function(state, configVersion)
	if configVersion ~= app.cfg.version then
		task.spawn(function()
			app:loadConfig()
		end)
	end
	app:setState(state, false)
end)
app.remotes.Notice.OnClientEvent:Connect(function(kind, data)
	if kind == "welcome" then
		if data.away and data.away.seconds > 60 or data.login then
			app:open("welcome", data)
		end
	elseif kind == "purchase_granted" then
		app.catalog = nil -- refetch ownership-dependent offers next time
		if data.crate then
			app:toast(app.L("crate_result", { item = app.L(data.crate.itemId), rarity = app.L("rarity_" .. data.crate.rarity) }))
		else
			app:toast(app.L("purchase_thanks"))
		end
	end
end)
GuiService.MenuOpened:Connect(function()
	app:close()
end)

app:loadConfig()
ForageNodes.mount(app)
