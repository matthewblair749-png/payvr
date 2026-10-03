--[[
	Quick phrases and emotes, the only way players talk. Phrases appear as bubbles over the sender's head
	(client-side) and are hidden for anyone the player blocked in Tidebound or on Roblox.
]]

local Players = game:GetService("Players")
local StarterGui = game:GetService("StarterGui")
local ContextActionService = game:GetService("ContextActionService")

local Ui = require(script.Parent.Ui.Ui)
local Theme = require(script.Parent.Ui.Theme)

local QuickChat = {}

local function isBlocked(app: any, userId: number): boolean
	if app.state and table.find(app.state.social.blocked, userId) then
		return true
	end
	local ok, ids = pcall(StarterGui.GetCore, StarterGui, "GetBlockedUserIds")
	return ok and type(ids) == "table" and table.find(ids, userId) ~= nil
end

local function bubble(player: Player, text: string)
	local head = player.Character and player.Character:FindFirstChild("Head")
	if not head then
		return
	end
	local gui = Instance.new("BillboardGui")
	gui.Size = UDim2.fromOffset(220, 50)
	gui.StudsOffset = Vector3.new(0, 3, 0)
	gui.AlwaysOnTop = true
	gui.MaxDistance = 120
	local label = Instance.new("TextLabel")
	label.Size = UDim2.fromScale(1, 1)
	label.BackgroundColor3 = Theme.colors.panel
	label.TextColor3 = Theme.colors.text
	label.FontFace = Theme.fontBold
	label.TextScaled = true
	label.Text = text
	label.Parent = gui
	Ui.corner(label, 10)
	gui.Parent = head
	task.delay(4, function()
		gui:Destroy()
	end)
end

function QuickChat.mount(app: any, gui: ScreenGui)
	local L = app.L
	local remote = app.remotes.QuickChat
	local wheel = Ui.frame(gui, { Name = "QuickChat", Size = UDim2.new(0, 320, 0, 360), Position = UDim2.new(0.5, 0, 0.5, 0), AnchorPoint = Vector2.new(0.5, 0.5), Visible = false })
	Ui.corner(wheel, 16)
	local scroll = Ui.scroll(wheel, { Size = UDim2.new(1, -16, 1, -16), Position = UDim2.fromOffset(8, 8) })
	local inner = Ui.frame(scroll, { BackgroundTransparency = 1, Size = UDim2.new(1, -10, 0, 0), AutomaticSize = Enum.AutomaticSize.Y })
	Ui.grid(inner, Vector2.new(146, 48), 6)

	local function fill()
		Ui.clear(inner)
		for _, id in app.cfg.compliance.quickPhrases do
			Ui.button(inner, L(id), function()
				remote:FireServer("phrase", id)
				wheel.Visible = false
			end, { TextSize = 14 })
		end
		local emotes = table.clone(app.cfg.compliance.emotes)
		for id in (app.state and app.state.cosmetics or {}) do
			if string.sub(id, 1, 6) == "emote_" and not table.find(emotes, id) then
				table.insert(emotes, id)
			end
		end
		for _, id in emotes do
			Ui.button(inner, L(id), function()
				remote:FireServer("emote", id)
				wheel.Visible = false
			end, { TextSize = 14, BackgroundColor3 = Theme.colors.panelAlt, TextColor3 = Theme.colors.text })
		end
	end

	local open = Ui.button(gui, "💬", function()
		fill()
		wheel.Visible = not wheel.Visible
	end, { Size = UDim2.fromOffset(56, 56), Position = UDim2.new(0, 8, 1, -130), TextSize = 24 })
	open.Name = "QuickChatButton"
	ContextActionService:BindAction("TideQuickChat", function(_, state)
		if state == Enum.UserInputState.Begin then
			fill()
			wheel.Visible = not wheel.Visible
		end
		return Enum.ContextActionResult.Pass
	end, false, Enum.KeyCode.C, Enum.KeyCode.DPadUp)

	remote.OnClientEvent:Connect(function(senderId, _kind, id)
		if isBlocked(app, senderId) then
			return
		end
		local sender = Players:GetPlayerByUserId(senderId)
		if sender then
			bubble(sender, L(id))
		end
	end)
end

return QuickChat
