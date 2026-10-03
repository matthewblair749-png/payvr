--[[
	Always-on HUD: currencies, day/night timer, season banner, and the menu buttons.
	The shop button is small, lives on the harbor screen only, and is hidden until the first night is done.
	Nothing here ever pops up a purchase screen.
]]

local Ui = require(script.Parent.Parent.Ui.Ui)
local Theme = require(script.Parent.Parent.Ui.Theme)
local Format = require(script.Parent.Parent.Ui.Format)

local Hud = {}

function Hud.mount(app: any, gui: ScreenGui)
	local L = app.L
	local top = Ui.frame(gui, { Name = "TopBar", BackgroundTransparency = 0.15, Size = UDim2.new(1, -16, 0, 56), Position = UDim2.fromOffset(8, 8) })
	Ui.corner(top, 14)
	Ui.padding(top, 8)
	Ui.list(top, 14, true)
	local silver = Ui.text(top, "", { Size = UDim2.new(0, 120, 1, 0), AutomaticSize = Enum.AutomaticSize.None, TextColor3 = Theme.colors.silver, TextSize = 20 })
	local pearls = Ui.text(top, "", { Size = UDim2.new(0, 90, 1, 0), AutomaticSize = Enum.AutomaticSize.None, TextColor3 = Theme.colors.pearl, TextSize = 20 })
	local gems = Ui.text(top, "", { Size = UDim2.new(0, 90, 1, 0), AutomaticSize = Enum.AutomaticSize.None, TextColor3 = Theme.colors.gem, TextSize = 20 })
	local phase = Ui.text(top, "", { Size = UDim2.new(0, 200, 1, 0), AutomaticSize = Enum.AutomaticSize.None, TextSize = 18 })

	local banner = Ui.frame(gui, { Name = "SeasonBanner", BackgroundColor3 = Theme.colors.panelAlt, Size = UDim2.new(0, 340, 0, 48), Position = UDim2.new(0, 8, 0, 70) })
	Ui.corner(banner, 12)
	Ui.padding(banner, 8)
	local seasonText = Ui.text(banner, "", { TextSize = 16, Size = UDim2.fromScale(1, 1), AutomaticSize = Enum.AutomaticSize.None })

	local menu = Ui.frame(gui, { Name = "Menu", BackgroundTransparency = 1, Size = UDim2.new(0, 120, 1, -140), Position = UDim2.new(1, -128, 0, 70) })
	Ui.list(menu, 8, false, Enum.HorizontalAlignment.Right)
	local buttons = {}
	local entries = {
		{ "fishing", "hud_fish" },
		{ "farm", "hud_farm" },
		{ "market", "hud_market" },
		{ "drifters", "hud_drifters" },
		{ "inventory", "hud_inventory" },
		{ "harbor", "hud_harbor" },
		{ "quests", "hud_quests" },
		{ "pass", "hud_pass" },
		{ "settings", "hud_settings" },
	}
	for i, e in entries do
		buttons[e[1]] = Ui.button(menu, L(e[2]), function()
			app:open(e[1])
		end, { Size = UDim2.new(0, 112, 0, 48), LayoutOrder = i, TextSize = 16 })
	end
	-- Small shop button; not shown until the first night is finished.
	local shop = Ui.button(menu, L("hud_shop"), function()
		app:track("store_opened", { source = "hud" })
		app:open("shop")
	end, { Size = UDim2.new(0, 112, 0, 48), LayoutOrder = 100, TextSize = 16, Visible = false })

	local function refresh()
		local s = app.state
		if not s then
			return
		end
		silver.Text = "● " .. Format.int(s.currencies.silver) .. " " .. L("currency_silver_short")
		pearls.Text = "◌ " .. Format.int(s.currencies.pearls)
		gems.Text = "◆ " .. Format.int(s.currencies.gems)
		shop.Visible = s.derived.storeUnlocked == true and not app.inNight
		menu.Visible = not app.inNight
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
		phase.Text = L("phase_" .. d.cycle.phase, { time = Format.duration(cycleLeft) })
		if s.onboarding.firstNightAt and not s.night.firstCompleted and s.onboarding.firstNightAt > now then
			phase.Text = L("phase_first_night", { time = Format.duration(s.onboarding.firstNightAt - now) })
		end
		seasonText.Text = L("season_banner", { season = L(d.seasonId), time = Format.duration(d.seasonEndsAt - now) })
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
