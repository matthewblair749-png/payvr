--[[ Shared harbor: each building's tier, what the next tier needs, and contributing materials. ]]

local Ui = require(script.Parent.Parent.Ui.Ui)
local Theme = require(script.Parent.Parent.Ui.Theme)
local Format = require(script.Parent.Parent.Ui.Format)

return {
	title = "panel_harbor",
	build = function(app: any, container: Frame)
		local L = app.L
		local s = app.state
		local cfg = app.cfg
		local tiers = s.derived.harborTiers or {}
		Ui.text(container, L("harbor_intro"), { TextColor3 = Theme.colors.textDim, TextSize = 15 })
		for _, b in cfg.harbor.buildings do
			local tier = tiers[b.id] or 1
			local card = Ui.card(container)
			Ui.text(card, L("building_" .. b.id) .. "  " .. L("harbor_tier", { tier = tier, max = cfg.harbor.maxTier }), { FontFace = Theme.fontBold })
			Ui.text(card, L("perk_" .. b.perk, { value = math.abs(b.perPerTier * (tier - 1)) }), { TextSize = 15, TextColor3 = Theme.colors.textDim })
			if tier < cfg.harbor.maxTier then
				local cost = cfg.harbor.tierCosts[tier]
				Ui.text(card, L("harbor_next", { driftwood = Format.int(cost.driftwood), shells = Format.int(cost.shells), iron = Format.int(cost.ironScrap) }), { TextSize = 15 })
				local row = Ui.row(card)
				for _, m in { "driftwood", "shells", "ironScrap" } do
					local amount = math.min(s.materials[m], 50)
					Ui.button(row, L("harbor_give", { amount = amount, material = L("material_" .. m) }), function()
						if amount > 0 then
							local materials = { [m] = amount }
							local reply = app:intent("contribute", { building = b.id, materials = materials })
							if reply.ok then
								app:toast(L("harbor_thanks"))
							end
						end
					end, { Size = UDim2.new(0.33, -6, 0, 48), TextSize = 14 })
				end
			end
		end
	end,
}
