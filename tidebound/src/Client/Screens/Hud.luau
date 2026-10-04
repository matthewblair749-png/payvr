--[[
	Day HUD, laid out like the Tidebound concept art:
	  top left    avatar, name, level and XP bar
	  top centre  phase title with timer, season ribbon under it
	  top right   currency pills, a small shop button (after the first night), the daily quest tracker
	  left        menu icons (Drifters, Backpack, Quests, Harbor, Pass, Settings)
	  bottom      hotbar of day activities and a big round action button
	Nothing here ever pops up a purchase, and the whole HUD hides during a night.
]]

local Players = game:GetService("Players")

local Ui = require(script.Parent.Parent.Ui.Ui)
local Theme = require(script.Parent.Parent.Ui.Theme)
local Format = require(script.Parent.Parent.Ui.Format)

local Hud = {}

local PHASE_KEY = { day = "hud_phase_day", dusk = "hud_phase_dusk", night = "hud_phase_night", dawn = "hud_phase_dawn" }

function Hud.mount(app: any, gui: ScreenGui)
	local L = app.L
	local c = Theme.colors
	local player = Players.LocalPlayer
	local dayHud = Ui.frame(gui, { Name = "DayHud", BackgroundTransparency = 1, Size = UDim2.fromScale(1, 1) })

	-- Profile: avatar, name, level, XP bar
	local profile = Ui.glass(dayHud, { Size = UDim2.fromOffset(250, 64), Position = UDim2.fromOffset(10, 10) })
	Ui.avatar(profile, player.UserId, 52, { Position = UDim2.fromOffset(6, 6) })
	local nameLabel = Ui.text(profile, player.DisplayName, { TextSize = 16, Size = UDim2.new(1, -72, 0, 20), AutomaticSize = Enum.AutomaticSize.None, Position = UDim2.fromOffset(66, 6) })
	nameLabel.TextTruncate = Enum.TextTruncate.AtEnd
	local levelLabel = Ui.text(profile, "", { TextSize = 14, Size = UDim2.fromOffset(60, 18), AutomaticSize = Enum.AutomaticSize.None, Position = UDim2.fromOffset(66, 26), TextColor3 = c.gold })
	local xpFill = Ui.progress(profile, 0, c.xp, { Size = UDim2.new(1, -128, 0, 12), Position = UDim2.fromOffset(120, 30) })
	local xpText = Ui.text(xpFill.Parent, "", { TextSize = 11, Size = UDim2.fromScale(1, 1), AutomaticSize = Enum.AutomaticSize.None, TextXAlignment = Enum.TextXAlignment.Center, ZIndex = 2 })
	xpText.TextYAlignment = Enum.TextYAlignment.Center

	-- Phase title and season ribbon
	local phase = Ui.text(dayHud, "", { TextSize = 26, FontFace = Theme.fontBold, Size = UDim2.fromOffset(420, 32), AutomaticSize = Enum.AutomaticSize.None, Position = UDim2.new(0.5, 0, 0, 10), AnchorPoint = Vector2.new(0.5, 0), TextXAlignment = Enum.TextXAlignment.Center })
	local season = Ui.glass(dayHud, { Size = UDim2.fromOffset(300, 28), Position = UDim2.new(0.5, 0, 0, 46), AnchorPoint = Vector2.new(0.5, 0) })
	local seasonText = Ui.text(season, "", { TextSize = 14, Size = UDim2.fromScale(1, 1), AutomaticSize = Enum.AutomaticSize.None, TextXAlignment = Enum.TextXAlignment.Center, TextColor3 = c.textDim })
	seasonText.TextYAlignment = Enum.TextYAlignment.Center

	-- Currencies
	local wallet = Ui.frame(dayHud, { BackgroundTransparency = 1, Size = UDim2.fromOffset(380, 38), Position = UDim2.new(1, -10, 0, 12), AnchorPoint = Vector2.new(1, 0) })
	local walletList = Ui.list(wallet, 8, true, Enum.HorizontalAlignment.Right)
	walletList.VerticalAlignment = Enum.VerticalAlignment.Center
	local silver = Ui.pill(wallet, "🪙", c.silver, { LayoutOrder = 1, Size = UDim2.fromOffset(124, 38) })
	local pearls = Ui.pill(wallet, "🫧", c.pearl, { LayoutOrder = 2, Size = UDim2.fromOffset(92, 38) })
	local gems = Ui.pill(wallet, "💎", c.gem, { LayoutOrder = 3, Size = UDim2.fromOffset(104, 38) })

	-- Small shop button (only after the first night)
	local shop = Ui.button(dayHud, "🛍️  " .. L("hud_shop"), function()
		app:track("store_opened", { source = "hud" })
		app:open("shop")
	end, { BackgroundColor3 = c.purple, Size = UDim2.fromOffset(110, 40), Position = UDim2.new(1, -10, 0, 58), AnchorPoint = Vector2.new(1, 0), TextSize = 15, Visible = false })

	-- Daily quest tracker
	local tracker = Ui.glass(dayHud, { Size = UDim2.fromOffset(250, 0), AutomaticSize = Enum.AutomaticSize.Y, Position = UDim2.new(1, -10, 0, 106), AnchorPoint = Vector2.new(1, 0) })
	Ui.padding(tracker, 10)
	Ui.list(tracker, 4)
	local trackerTitle = Ui.text(tracker, L("hud_today"), { TextSize = 14, TextColor3 = c.textDim, LayoutOrder = 0 })
	local questLines = {}
	for i = 1, 3 do
		questLines[i] = Ui.text(tracker, "", { TextSize = 14, LayoutOrder = i, FontFace = Theme.fontBody })
	end
	local trackerButton = Instance.new("TextButton")
	trackerButton.BackgroundTransparency = 1
	trackerButton.Text = ""
	trackerButton.Size = UDim2.fromScale(1, 1)
	trackerButton.ZIndex = 3
	trackerButton.Parent = tracker
	trackerButton.Activated:Connect(function()
		app:open("quests")
	end)
	local _ = trackerTitle

	-- Left menu
	local menu = Ui.frame(dayHud, { BackgroundTransparency = 1, Size = UDim2.new(0, 76, 1, -210), Position = UDim2.fromOffset(10, 84) })
	Ui.list(menu, 8, false, Enum.HorizontalAlignment.Center)
	for i, e in {
		{ "drifters", "🐾", "hud_drifters", c.purple },
		{ "inventory", "🎒", "hud_inventory", c.blue },
		{ "quests", "📜", "hud_quests", c.gold },
		{ "harbor", "⚓", "hud_harbor", c.blue },
		{ "pass", "🎟️", "hud_pass", c.purple },
		{ "settings", "⚙️", "hud_settings", c.textDim },
	} do
		Ui.iconButton(menu, e[2], L(e[3]), e[4], function()
			app:open(e[1])
		end, { LayoutOrder = i })
	end

	-- Hotbar
	local hotbar = Ui.frame(dayHud, { BackgroundTransparency = 1, Size = UDim2.fromOffset(5 * 72 + 4 * 8, 72), Position = UDim2.new(0.5, 0, 1, -14), AnchorPoint = Vector2.new(0.5, 1) })
	Ui.list(hotbar, 8, true, Enum.HorizontalAlignment.Center)
	local badges = {}
	for i, e in {
		{ "fishing", "🎣", "hud_fish" },
		{ "farm", "🌱", "hud_farm" },
		{ "market", "🛒", "hud_market" },
		{ "drifters", "🥚", "hud_hatch" },
		{ "inventory", "🪵", "hud_inventory" },
	} do
		local slot = Ui.iconButton(hotbar, e[2], L(e[3]), c.blue, function()
			app:open(e[1])
		end, { LayoutOrder = i })
		local badge = Ui.text(slot, "", { TextSize = 13, Size = UDim2.fromOffset(30, 16), AutomaticSize = Enum.AutomaticSize.None, Position = UDim2.new(1, -32, 0, 3), TextXAlignment = Enum.TextXAlignment.Right, ZIndex = 2 })
		badges[e[1] .. i] = badge
	end

	-- Big round action button: cast a line
	local action = Ui.button(dayHud, "🎣", function()
		app:open("fishing")
	end, { BackgroundColor3 = c.accent, Size = UDim2.fromOffset(96, 96), Position = UDim2.new(1, -16, 1, -16), AnchorPoint = Vector2.new(1, 1), TextSize = 40, FontFace = Theme.fontEmoji })
	action:FindFirstChildOfClass("UICorner").CornerRadius = UDim.new(1, 0)
	local ring = action:FindFirstChildOfClass("UIStroke")
	ring.Thickness = 4
	ring.Color = Color3.fromRGB(190, 225, 255)

	local function refresh()
		local s = app.state
		if not s then
			return
		end
		silver.Text = Format.int(s.currencies.silver)
		pearls.Text = Format.int(s.currencies.pearls)
		gems.Text = Format.int(s.currencies.gems)
		levelLabel.Text = L("hud_level", { level = s.progress.level })
		local need = math.max(1, s.derived.xpToNext)
		xpFill.Size = UDim2.fromScale(math.clamp(s.progress.xp / need, 0, 1), 1)
		xpText.Text = string.format("%d/%d", s.progress.xp, need)
		shop.Visible = s.derived.storeUnlocked == true
		local fishCount, cropCount = 0, 0
		for _, n in s.fish do
			fishCount += n
		end
		for _, n in s.crops do
			cropCount += n
		end
		badges.market3.Text = if fishCount + cropCount > 0 then tostring(fishCount + cropCount) else ""
		badges.drifters4.Text = if s.hatch.eggs > 0 then tostring(s.hatch.eggs) else ""
		local mats = s.materials.driftwood + s.materials.shells + s.materials.ironScrap
		badges.inventory5.Text = if mats > 0 then tostring(mats) else ""
		for i = 1, 3 do
			local entry = s.quests.daily[i]
			local def = entry and app.cfg.index.quests[entry.id]
			if def then
				local done = entry.progress >= def.target
				questLines[i].Text = (if done then "<font color=\"#3CDC78\">✔</font> " else "○ ") .. L(def.id, { target = def.target }) .. string.format(" (%d/%d)", entry.progress, def.target)
			else
				questLines[i].Text = ""
			end
		end
		dayHud.Visible = not app.inNight
	end

	local function tick()
		local s = app.state
		if not s then
			return
		end
		local now = workspace:GetServerTimeNow()
		local d = s.derived
		local key = PHASE_KEY[d.cycle.phase] or "hud_phase_day"
		local left = d.cycle.endsAt - now
		if s.onboarding.firstNightAt and not s.night.firstCompleted and s.onboarding.firstNightAt > now then
			key = "hud_phase_first_night"
			left = s.onboarding.firstNightAt - now
		end
		phase.Text = L(key, { time = Format.duration(left) })
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
