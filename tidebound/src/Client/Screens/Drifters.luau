--[[
	Drifters: hatch, then browse your Drifters in a filterable grid of 3D tiles. The detail pane shows the
	selected Drifter with its role, level, happiness and stats, and lets you switch role, set it active,
	feed it, and apply skins.
]]

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Ui = require(script.Parent.Parent.Ui.Ui)
local Theme = require(script.Parent.Parent.Ui.Theme)
local Format = require(script.Parent.Parent.Ui.Format)
local Creatures = require(script.Parent.Parent.World.Creatures)
local Drifters = require(ReplicatedStorage.Shared.Rules.Drifters)

local FILTERS = { "all", "common", "uncommon", "rare", "epic", "legendary" }

return {
	title = "panel_drifters",
	build = function(app: any, container: Frame)
		local L = app.L
		local s = app.state
		local cfg = app.cfg
		local c = Theme.colors
		app.drifterFilter = app.drifterFilter or "all"

		local active = 0
		for _, d in s.drifters do
			if d.active then
				active += 1
			end
		end
		local top = Ui.row(container, 52)
		Ui.button(top, if s.hatch.eggs > 0 then "🥚 " .. L("drifters_hatch_egg", { eggs = s.hatch.eggs }) else "🥚 " .. L("drifters_buy_egg", { price = cfg.economy.eggPriceSilver }), function()
			local reply = app:intent("hatch")
			if reply.ok then
				app:open("hatch", reply.data)
			end
		end, { BackgroundColor3 = c.good, Size = UDim2.new(0.5, -6, 0, 52), TextSize = 17 })
		Ui.button(top, L("drifters_odds"), function()
			app:open("odds", { kind = "hatch" })
		end, { BackgroundColor3 = c.panelAlt, Size = UDim2.new(0.22, -6, 0, 52) })
		Ui.button(top, L("drifters_book"), function()
			app:open("collection")
		end, { BackgroundColor3 = c.panelAlt, Size = UDim2.new(0.25, -6, 0, 52) })
		Ui.text(container, L("drifters_slots", { active = active, slots = s.derived.activeSlots, stored = #s.drifters, capacity = s.derived.storageCapacity }), { TextSize = 15, TextColor3 = c.textDim, FontFace = Theme.fontBody })

		local tabs = {}
		for _, f in FILTERS do
			table.insert(tabs, { id = f, label = if f == "all" then L("filter_all") else L("rarity_" .. f) })
		end
		Ui.tabs(container, tabs, app.drifterFilter, function(id)
			app.drifterFilter = id
			app:open("drifters")
		end)

		-- Grid of tiles
		local grid = Ui.frame(container, { BackgroundTransparency = 1, Size = UDim2.new(1, 0, 0, 0), AutomaticSize = Enum.AutomaticSize.Y })
		Ui.grid(grid, Vector2.new(104, 132), 8)
		local selected = nil
		for i, d in s.drifters do
			local species = cfg.index.species[d.speciesId]
			if app.drifterFilter == "all" or species.rarity == app.drifterFilter then
				local rarity = cfg.index.rarities[species.rarity]
				local tile = Ui.button(grid, "", function()
					app.selectedDrifter = d.id
					app:open("drifters")
				end, { BackgroundColor3 = if app.selectedDrifter == d.id then c.accent else c.panelAlt, LayoutOrder = i })
				tile:FindFirstChildOfClass("UIStroke").Color = Theme.hex(rarity.color)
				Creatures.viewport(tile, Creatures.drifter(cfg, d.speciesId), UDim2.new(1, 0, 0, 84), false, Theme)
				Ui.text(tile, L(d.speciesId), { TextSize = 13, Size = UDim2.new(1, -6, 0, 18), AutomaticSize = Enum.AutomaticSize.None, Position = UDim2.new(0, 3, 0, 86), TextXAlignment = Enum.TextXAlignment.Center })
				Ui.text(tile, L("drifter_level", { level = d.level }) .. (if d.active then "  ✔" else ""), { TextSize = 12, Size = UDim2.new(1, 0, 0, 16), AutomaticSize = Enum.AutomaticSize.None, Position = UDim2.new(0, 0, 0, 106), TextXAlignment = Enum.TextXAlignment.Center, TextColor3 = c.textDim, FontFace = Theme.fontBody })
				if app.selectedDrifter == d.id or (not app.selectedDrifter and not selected) then
					selected = d
				end
			end
		end
		if #s.drifters == 0 then
			Ui.text(container, L("drifters_none"), { TextColor3 = c.textDim, FontFace = Theme.fontBody })
			return
		end
		selected = selected or s.drifters[1]

		-- Detail pane
		local d = selected
		local species = cfg.index.species[d.speciesId]
		local stats = Drifters.stats(cfg, d)
		local card = Ui.card(container, { BackgroundColor3 = c.panel })
		local head = Ui.frame(card, { BackgroundTransparency = 1, Size = UDim2.new(1, 0, 0, 150) })
		local portrait = Ui.frame(head, { BackgroundColor3 = c.bg, Size = UDim2.fromOffset(150, 150) })
		Ui.corner(portrait, 14)
		Creatures.viewport(portrait, Creatures.drifter(cfg, d.speciesId), UDim2.fromScale(1, 1), true, Theme)
		local info = Ui.frame(head, { BackgroundTransparency = 1, Size = UDim2.new(1, -164, 1, 0), Position = UDim2.fromOffset(164, 0) })
		Ui.list(info, 4)
		Ui.text(info, L(d.speciesId), { TextSize = 24, FontFace = Theme.fontBold })
		local line = Ui.row(info, 22)
		Ui.rarity(line, cfg, species.rarity, { TextSize = 15, Size = UDim2.fromOffset(110, 22), AutomaticSize = Enum.AutomaticSize.None })
		Ui.text(line, "• " .. L("element_" .. species.element) .. "  • " .. L(d.traitId), { TextSize = 15, Size = UDim2.new(1, -120, 0, 22), AutomaticSize = Enum.AutomaticSize.None, TextColor3 = c.textDim, FontFace = Theme.fontBody })
		Ui.text(info, (if d.role == "worker" then "⛏ " .. L("role_worker") else "🛡 " .. L("role_guardian")) .. "   " .. L("drifter_level_of", { level = d.level, max = cfg.economy.drifterLevel.maxLevel }), { TextSize = 16 })
		Ui.text(info, L("drifter_happiness", { value = Format.int(d.happiness) }), { TextSize = 14, TextColor3 = c.textDim, FontFace = Theme.fontBody })
		Ui.progress(info, d.happiness / 100, c.xp, { Size = UDim2.new(1, -8, 0, 10) })

		for _, stat in { { "⚔", "stat_power", stats.power, c.coral }, { "💨", "stat_speed", stats.speed, c.blue }, { "🪙", "stat_income", stats.income, c.gold } } do
			local r = Ui.row(card, 26)
			Ui.text(r, stat[1] .. "  " .. L(stat[2]), { TextSize = 16, Size = UDim2.new(0.5, 0, 0, 26), AutomaticSize = Enum.AutomaticSize.None })
			Ui.text(r, Format.int(stat[3]), { TextSize = 18, Size = UDim2.new(0.45, 0, 0, 26), AutomaticSize = Enum.AutomaticSize.None, TextXAlignment = Enum.TextXAlignment.Right, TextColor3 = stat[4] })
		end

		local food = nil
		for id, n in s.crops do
			if n > 0 then
				food = id
			end
		end
		for id, n in s.fish do
			if n > 0 and not food then
				food = id
			end
		end
		local actions = Ui.row(card, 52)
		Ui.button(actions, if d.role == "worker" then L("drifter_make_guardian") else L("drifter_make_worker"), function()
			app:intent("setRole", { drifter = d.id, role = if d.role == "worker" then "guardian" else "worker" })
		end, { BackgroundColor3 = c.accent, Size = UDim2.new(0.34, -6, 0, 52), TextSize = 15 })
		Ui.button(actions, if d.active then L("drifter_active") else L("drifter_stored"), function()
			app:intent("setActive", { drifter = d.id, active = not d.active })
		end, { BackgroundColor3 = if d.active then c.good else c.panelAlt, Size = UDim2.new(0.33, -6, 0, 52), TextSize = 15 })
		Ui.button(actions, "🍖 " .. L("drifter_feed"), function()
			if food then
				app:intent("feed", { drifter = d.id, item = food })
			else
				app:toast(L("err_no_food"))
			end
		end, { BackgroundColor3 = c.coral, Size = UDim2.new(0.33, -6, 0, 52), TextSize = 15 })
		for cosmetic in s.cosmetics do
			if string.sub(cosmetic, 1, 5) == "skin_" then
				Ui.button(card, (if d.skinId == cosmetic then "✔ " else "") .. L(cosmetic), function()
					app:intent("equipCosmetic", { cosmetic = cosmetic, drifter = d.id })
				end, { Size = UDim2.new(1, 0, 0, 48), TextSize = 14, BackgroundColor3 = c.panelAlt })
			end
		end
		if s.storageUpgrades < #cfg.economy.storage.upgradePricesSilver and s.derived.storageCapacity < cfg.economy.storage.cap then
			Ui.button(container, L("drifters_storage_upgrade", { price = cfg.economy.storage.upgradePricesSilver[s.storageUpgrades + 1], amount = cfg.economy.storage.upgradeAmount }), function()
				app:intent("upgradeStorage")
			end, { Size = UDim2.new(1, 0, 0, 48), BackgroundColor3 = c.panelAlt })
		end
	end,
	}
