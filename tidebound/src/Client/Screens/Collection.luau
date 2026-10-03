local Ui = require(script.Parent.Parent.Ui.Ui)
local Theme = require(script.Parent.Parent.Ui.Theme)

return {
	title = "panel_collection",
	build = function(app: any, container: Frame)
		local L = app.L
		local s = app.state
		local cfg = app.cfg
		Ui.text(container, L("collection_progress", { found = s.derived.collectionFound, total = s.derived.collectionTotal }), { FontFace = Theme.fontBold })
		for _, element in cfg.drifters.elements do
			Ui.text(container, L("element_" .. element), { FontFace = Theme.fontBold, TextColor3 = Theme.colors.accent })
			for _, species in cfg.drifters.species do
				if species.element == element then
					local row = Ui.row(container, 30)
					Ui.rarity(row, cfg, species.rarity, { Size = UDim2.new(0, 130, 0, 30), AutomaticSize = Enum.AutomaticSize.None })
					local found = s.collection[species.id] == true
					Ui.text(row, if found then L(species.id) else L("collection_unknown"), {
						Size = UDim2.new(1, -140, 0, 30),
						AutomaticSize = Enum.AutomaticSize.None,
						TextColor3 = if found then Theme.colors.text else Theme.colors.textDim,
					})
				end
			end
		end
	end,
}
