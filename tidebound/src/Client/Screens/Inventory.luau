local Ui = require(script.Parent.Parent.Ui.Ui)
local Theme = require(script.Parent.Parent.Ui.Theme)
local Format = require(script.Parent.Parent.Ui.Format)

return {
	title = "panel_inventory",
	build = function(app: any, container: Frame)
		local L = app.L
		local s = app.state
		local cfg = app.cfg
		Ui.text(container, L("inv_materials"), { FontFace = Theme.fontBold })
		for _, m in { "driftwood", "shells", "ironScrap" } do
			Ui.text(container, L("material_" .. m) .. ": " .. Format.int(s.materials[m]))
		end
		Ui.text(container, L("inv_fish"), { FontFace = Theme.fontBold })
		for id, n in s.fish do
			if n > 0 then
				local row = Ui.row(container, 28)
				Ui.rarity(row, cfg, cfg.index.fish[id].rarity, { Size = UDim2.new(0, 130, 0, 28), AutomaticSize = Enum.AutomaticSize.None })
				Ui.text(row, L(id) .. " x" .. n, { Size = UDim2.new(1, -140, 0, 28), AutomaticSize = Enum.AutomaticSize.None })
			end
		end
		Ui.text(container, L("inv_crops"), { FontFace = Theme.fontBold })
		for id, n in s.crops do
			if n > 0 then
				Ui.text(container, L(id) .. " x" .. n)
			end
		end
		Ui.text(container, L("inv_cosmetics"), { FontFace = Theme.fontBold })
		for id in s.cosmetics do
			local row = Ui.row(container)
			Ui.text(row, L(id), { Size = UDim2.new(0.6, 0, 0, 48), AutomaticSize = Enum.AutomaticSize.None })
			if string.sub(id, 1, 8) == "rodskin_" or string.sub(id, 1, 5) == "deco_" then
				Ui.button(row, L("equip_toggle"), function()
					app:intent("equipCosmetic", { cosmetic = id })
				end, { Size = UDim2.new(0.35, 0, 0, 48) })
			end
		end
		Ui.text(container, L("inv_eggs", { count = s.hatch.eggs }))
	end,
}
