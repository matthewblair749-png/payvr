--[[
	Title screen shown when a player joins: the Tidebound logo over a slow camera pan of the harbor,
	menu buttons, and a countdown to the next night. Continue hands the camera back to the player.
]]

local RunService = game:GetService("RunService")
local Players = game:GetService("Players")

local Ui = require(script.Parent.Parent.Ui.Ui)
local Theme = require(script.Parent.Parent.Ui.Theme)
local Format = require(script.Parent.Parent.Ui.Format)

local Lobby = {}

function Lobby.mount(app: any, gui: ScreenGui)
	local L = app.L
	local c = Theme.colors
	local camera = workspace.CurrentCamera
	local root = Ui.frame(gui, { Name = "Lobby", BackgroundTransparency = 1, Size = UDim2.fromScale(1, 1), ZIndex = 20 })
	local shade = Ui.frame(root, { BackgroundColor3 = Color3.new(1, 1, 1), Size = UDim2.fromScale(1, 1), BackgroundTransparency = 0 })
	local g = Ui.gradient(shade, Color3.fromRGB(6, 16, 36), Color3.fromRGB(6, 16, 36), 0)
	-- Dark on the left behind the menu, fading to clear on the right.
	g.Transparency = NumberSequence.new(0.1, 1)

	local logo = Ui.text(root, "Tidebound", { TextSize = 84, FontFace = Font.fromEnum(Enum.Font.FredokaOne), Size = UDim2.fromOffset(520, 96), AutomaticSize = Enum.AutomaticSize.None, Position = UDim2.fromOffset(40, 40), outline = false })
	Ui.stroke(logo, Color3.fromRGB(30, 110, 200), 4)
	Ui.text(root, L("lobby_tagline"), { TextSize = 26, Size = UDim2.fromOffset(520, 32), AutomaticSize = Enum.AutomaticSize.None, Position = UDim2.fromOffset(48, 136) })

	local menu = Ui.frame(root, { BackgroundTransparency = 1, Size = UDim2.fromOffset(280, 300), Position = UDim2.fromOffset(40, 200) })
	Ui.list(menu, 10)
	local function close()
		root.Visible = false
		camera.CameraType = Enum.CameraType.Custom
		local character = Players.LocalPlayer.Character
		local humanoid = character and character:FindFirstChildOfClass("Humanoid")
		if humanoid then
			camera.CameraSubject = humanoid
		end
	end
	Ui.button(menu, "▶  " .. L("lobby_continue"), close, { BackgroundColor3 = c.accent, Size = UDim2.new(1, 0, 0, 58), TextSize = 24, LayoutOrder = 1 })
	Ui.button(menu, "🐾  " .. L("hud_drifters"), function()
		close()
		app:open("drifters")
	end, { BackgroundColor3 = c.panel, Size = UDim2.new(1, 0, 0, 50), TextSize = 19, LayoutOrder = 2 })
	local shopButton = Ui.button(menu, "🛍️  " .. L("hud_shop"), function()
		close()
		app:open("shop")
	end, { BackgroundColor3 = c.panel, Size = UDim2.new(1, 0, 0, 50), TextSize = 19, LayoutOrder = 3, Visible = false })
	Ui.button(menu, "⚙️  " .. L("hud_settings"), function()
		close()
		app:open("settings")
	end, { BackgroundColor3 = c.panel, Size = UDim2.new(1, 0, 0, 50), TextSize = 19, LayoutOrder = 4 })

	local nightCard = Ui.glass(root, { Size = UDim2.fromOffset(230, 64), Position = UDim2.new(1, -24, 1, -24), AnchorPoint = Vector2.new(1, 1) })
	local nightText = Ui.text(nightCard, "", { TextSize = 16, Size = UDim2.new(1, -16, 1, 0), AutomaticSize = Enum.AutomaticSize.None, Position = UDim2.fromOffset(12, 0) })
	nightText.TextYAlignment = Enum.TextYAlignment.Center

	-- Slow orbit over the harbor while the menu is open.
	camera.CameraType = Enum.CameraType.Scriptable
	local angle = 0
	local conn
	conn = RunService.RenderStepped:Connect(function(dt)
		if not root.Visible then
			conn:Disconnect()
			return
		end
		if not Theme.reducedMotion then
			angle += dt * 0.04
		end
		local eye = Vector3.new(math.sin(angle) * 150, 55, math.cos(angle) * 150 - 40)
		camera.CFrame = CFrame.lookAt(eye, Vector3.new(0, 8, -30))
		local s = app.state
		if s then
			shopButton.Visible = s.derived.storeUnlocked == true
			local now = workspace:GetServerTimeNow()
			nightText.Text = "🌙  " .. L("lobby_night_in", { time = Format.duration(s.derived.nextNightAt - now) })
		end
	end)
	-- Returning players and anyone mid-tutorial can always get straight in.
	app.closeLobby = close
end

return Lobby
