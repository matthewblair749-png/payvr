--[[ Drifter manager: hatch, set Worker or Guardian, choose active slots, feed, and apply skins. ]]

local Ui = require(script.Parent.Parent.Ui.Ui)
local Creatures = require(script.Parent.Parent.World.Creatures)
local Theme = require(script.Parent.Parent.Ui.Theme)
local Format = require(script.Parent.Parent.Ui.Format)

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Drifters = require(ReplicatedStorage.Shared.Rules.Drifters)

return {
	title = "panel_drifters",
	build = function(app: any, container: Frame)
		local L = app.L
		local s = app.state
		local cfg = app.cfg
		local active = 0
		for _, d in s.drifters do
			if d.active then
				active += 1
			end
		end
		Ui.text(container, L("drifters_slots", { active = active, slots = s.derived.activeSlots, stored = #s.drifters, capacity = s.derived.storageCapacity }))
		local hatchRow = Ui.row(container)
		Ui.button(hatchRow, if s.hatch.eggs > 0 then L("drifters_hatch_egg", { eggs = s.hatch.eggs }) else L("drifters_buy_egg", { price = cfg.economy.eggPriceSilver }), function()
			local reply = app:intent("hatch")
			if reply.ok then
				app:open("hatch", reply.data)
			end
		end, { Size = UDim2.new(0.5, -4, 0, 52) })
		Ui.button(hatchRow, L("drifters_odds"), function()
			app:open("odds", { kind = "hatch" })
		end, { Size = UDim2.new(0.25, -4, 0, 52), BackgroundColor3 = Theme.colors.panelAlt, TextColor3 = Theme.colors.text })
		Ui.button(hatchRow, L("drifters_book"), function()
			app:open("collection")
		end, { Size = UDim2.new(0.25, -4, 0, 52), BackgroundColor3 = Theme.colors.panelAlt, TextColor3 = Theme.colors.text })
		if s.storageUpgrades < #cfg.economy.storage.upgradePricesSilver and s.derived.storageCapacity < cfg.economy.storage.cap then
			Ui.button(container, L("drifters_storage_upgrade", { price = cfg.economy.storage.upgradePricesSilver[s.storageUpgrades + 1], amount = cfg.economy.storage.upgradeAmount }), function()
				app:intent("upgradeStorage")
			end, { Size = UDim2.new(1, 0, 0, 48), BackgroundColor3 = Theme.colors.panelAlt, TextColor3 = Theme.colors.text })
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

		for _, d in s.drifters do
			local species = cfg.index.species[d.speciesId]
			local stats = Drifters.stats(cfg, d)
			local card = Ui.card(container)
			local portraitRow = Ui.row(card, 96)
			local portrait = Ui.frame(portraitRow, { BackgroundColor3 = Theme.colors.bg, Size = UDim2.fromOffset(96, 96) })
			Ui.corner(portrait, 14)
			Creatures.viewport(portrait, Creatures.drifter(cfg, d.speciesId), UDim2.fromScale(1, 1), false, Theme)
			local head = Ui.row(portraitRow, 28)
			head.Size = UDim2.new(1, -110, 0, 28)
			Ui.rarity(head, cfg, species.rarity, { Size = UDim2.new(0, 130, 0, 28), AutomaticSize = Enum.AutomaticSize.None })
			Ui.text(head, L(d.speciesId) .. "  " .. L("drifter_level", { level = d.level }) .. "  " .. L("element_" .. species.element), {
				Size = UDim2.new(1, -140, 0, 28),
				AutomaticSize = Enum.AutomaticSize.None,
				FontFace = Theme.fontBold,
			})
			Ui.text(card, L("drifter_stats", {
				power = Format.int(stats.power),
				speed = Format.int(stats.speed),
				income = Format.int(stats.income),
				happiness = Format.int(d.happiness),
				trait = L(d.traitId),
			}), { TextSize = 15, TextColor3 = Theme.colors.textDim })
			local actions = Ui.row(card)
			Ui.button(actions, if d.role == "worker" then L("role_worker") else L("role_guardian"), function()
				app:intent("setRole", { drifter = d.id, role = if d.role == "worker" then "guardian" else "worker" })
			end, { Size = UDim2.new(0.33, -6, 0, 48), TextSize = 15 })
			Ui.button(actions, if d.active then L("drifter_active") else L("drifter_stored"), function()
				app:intent("setActive", { drifter = d.id, active = not d.active })
			end, { Size = UDim2.new(0.33, -6, 0, 48), TextSize = 15, BackgroundColor3 = if d.active then Theme.colors.good else Theme.colors.panel, TextColor3 = Theme.colors.text })
			Ui.button(actions, L("drifter_feed"), function()
				if food then
					app:intent("feed", { drifter = d.id, item = food })
				else
					app:toast(L("err_no_food"))
				end
			end, { Size = UDim2.new(0.33, -6, 0, 48), TextSize = 15 })
			for cosmetic in s.cosmetics do
				if string.sub(cosmetic, 1, 5) == "skin_" then
					Ui.button(card, (if d.skinId == cosmetic then "✓ " else "") .. L(cosmetic), function()
						app:intent("equipCosmetic", { cosmetic = cosmetic, drifter = d.id })
					end, { Size = UDim2.new(1, 0, 0, 48), TextSize = 14, BackgroundColor3 = Theme.colors.panel, TextColor3 = Theme.colors.text })
				end
			end
		end
	end,
}
