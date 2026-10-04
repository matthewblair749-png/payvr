--[[
	Always-on HUD, laid out like top Roblox games:
	  * top centre: currency pills and a day/night pill with the timer
	  * under it: the season ribbon
	  * left column: day activities; right column: progression, settings, and the gold shop button
	The shop button appears only after the first night and never during a night. Nothing here pops up a purchase.
]]

local Ui = require(script.Parent.Parent.Ui.Ui)
local Theme = require(script.Parent.Parent.Ui.Theme)
local Format = require(script.Parent.Parent.Ui.Format)

local Hud = {}

local PHASE_ICON = { day = "☀️", dusk = "🌇", night = "🌙", dawn = "🌅" }

function Hud.mount(app: any, gui: ScreenGui)
	local L = app.L
	local c = Theme.colors

	local top = Ui.frame(gui, { Name = "TopBar", BackgroundTransparency = 1, Size = UDim2.new(1, 0, 0, 44), Position = UDim2.fromOffset(0, 10) })
	local topList = Ui.list(top, 8, true, Enum.HorizontalAlignment.Center)
	topList.VerticalAlignment = Enum.VerticalAlignment.Center
	local silver = Ui.pill(top, "🪙", c.silver, { LayoutOrder = 1, Size = UDim2.fromOffset(132, 44) })
	local pearls = Ui.pill(top, "🫧", c.pearl, { LayoutOrder = 2, Size = UDim2.fromOffset(96, 44) })
	local gems = Ui.pill(top, "💎", c.gem, { LayoutOrder = 3, Size = UDim2.fromOffset(110, 44) })
	local phase = Ui.pill(top, "☀️", c.accent, { LayoutOrder = 4, Size = UDim2.fromOffset(170, 44) })
	phase.TextSize = Theme.size(16)
	local phaseIcon = phase.Parent:FindFirstChild("Icon")

	local banner = Ui.frame(gui, { Name = "SeasonBanner", BackgroundColor3 = Color3.new(1, 1, 1), Size = UDim2.fromOffset(300, 34), Position = UDim2.new(0.5, 0, 0, 62), AnchorPoint = Vector2.new(0.5, 0) })
	Ui.gradient(banner, c.coral, Theme.darker(c.coral, 0.25))
	Ui.corner(banner, 17)
	Ui.stroke(banner, Theme.darker(c.coral, 0.6), 2.5, true)
	local seasonText = Ui.text(banner, "", { TextSize = 16, Size = UDim2.fromScale(1, 1), AutomaticSize = Enum.AutomaticSize.None, TextXAlignment = Enum.TextXAlignment.Center })
	seasonText.TextYAlignment = Enum.TextYAlignment.Center

	local function column(name: string, xScale: number, xOffset: number, anchorX: number): Frame
		local f = Ui.frame(gui, { Name = name, BackgroundTransparency = 1, Size = UDim2.new(0, 80, 1, -230), Position = UDim2.new(xScale, xOffset, 0, 110), AnchorPoint = Vector2.new(anchorX, 0) })
		Ui.list(f, 8, false, Enum.HorizontalAlignment.Center)
		return f
	end
	local left = column("DayMenu", 0, 10, 0)
	local right = column("MetaMenu", 1, -10, 1)

	local entries = {
		{ left, "fishing", "🎣", "hud_fish", c.blue },
		{ left, "farm", "🌱", "hud_farm", c.good },
		{ left, "market", "🛒", "hud_market", c.coral },
		{ left, "drifters", "🐾", "hud_drifters", c.purple },
		{ left, "inventory", "🎒", "hud_inventory", c.panelAlt },
		{ left, "harbor", "⚓", "hud_harbor", c.blue },
		{ right, "quests", "📜", "hud_quests", c.accent },
		{ right, "pass", "🎟️", "hud_pass", c.purple },
		{ right, "settings", "⚙️", "hud_settings", c.panelAlt },
	}
	for i, e in entries do
		Ui.iconButton(e[1], e[3], L(e[4]), e[5], function()
			app:open(e[2])
		end, { LayoutOrder = i })
	end
	-- Gold shop button; hidden until the first night is finished.
	local shop = Ui.iconButton(right, "🛍️", L("hud_shop"), c.accent, function()
		app:track("store_opened", { source = "hud" })
		app:open("shop")
	end, { LayoutOrder = 100, Visible = false })

	local function refresh()
		local s = app.state
		if not s then
			return
		end
		silver.Text = Format.int(s.currencies.silver)
		pearls.Text = Format.int(s.currencies.pearls)
		gems.Text = Format.int(s.currencies.gems)
		shop.Visible = s.derived.storeUnlocked == true and not app.inNight
		left.Visible = not app.inNight
		right.Visible = not app.inNight
		banner.Visible = not app.inNight
	end

	local function tick()
		local s = app.state
		if not s then
			return
		end
		local now = workspace:GetServerTimeNow()
		local d = s.derived
		local cycleLeft = d.cycle.endsAt - now
		phaseIcon.Text = PHASE_ICON[d.cycle.phase] or "☀️"
		phase.Text = L("phase_" .. d.cycle.phase, { time = Format.duration(cycleLeft) })
		if s.onboarding.firstNightAt and not s.night.firstCompleted and s.onboarding.firstNightAt > now then
			phaseIcon.Text = "🌙"
			phase.Text = L("phase_first_night", { time = Format.duration(s.onboarding.firstNightAt - now) })
		end
		seasonText.Text = "🌊 " .. L("season_banner", { season = L(d.seasonId), time = Format.duration(d.seasonEndsAt - now) })
	end

	app.StateChanged:Connect(refresh)
	task.spawn(function()
		while gui.Parent do
			tick()
			task.wait(0.5)
		end
	end)
	return { refresh = refresh }
end

return Hud
