--[[ Collection book: every species as a 3D tile; undiscovered ones are dark silhouettes. ]]

local Ui = require(script.Parent.Parent.Ui.Ui)
local Theme = require(script.Parent.Parent.Ui.Theme)
local Creatures = require(script.Parent.Parent.World.Creatures)

return {
	title = "panel_collection",
	build = function(app: any, container: Frame)
		local L = app.L
		local s = app.state
		local cfg = app.cfg
		local c = Theme.colors
		Ui.text(container, L("collection_progress", { found = s.derived.collectionFound, total = s.derived.collectionTotal }), { TextSize = 18 })
		Ui.progress(container, s.derived.collectionFound / math.max(1, s.derived.collectionTotal), c.gold, { Size = UDim2.new(1, 0, 0, 12) })
		for _, element in cfg.drifters.elements do
			Ui.text(container, string.upper(L("element_" .. element)), { TextSize = 16, TextColor3 = c.textDim })
			local grid = Ui.frame(container, { BackgroundTransparency = 1, Size = UDim2.new(1, 0, 0, 0), AutomaticSize = Enum.AutomaticSize.Y })
			Ui.grid(grid, Vector2.new(104, 124), 8)
			for i, species in cfg.drifters.species do
				if species.element == element then
					local found = s.collection[species.id] == true
					local tile = Ui.card(grid, { LayoutOrder = i, BackgroundColor3 = c.panelAlt })
					tile.AutomaticSize = Enum.AutomaticSize.None
					tile:FindFirstChildOfClass("UIPadding"):Destroy()
					tile:FindFirstChildOfClass("UIListLayout"):Destroy()
					tile:FindFirstChildOfClass("UIStroke").Color = Theme.hex(cfg.index.rarities[species.rarity].color)
					local m = Creatures.drifter(cfg, species.id)
					if not found then
						for _, part in m:GetDescendants() do
							if part:IsA("BasePart") then
								part.Color = Color3.fromRGB(14, 20, 34)
								part.Material = Enum.Material.SmoothPlastic
							elseif part:IsA("ParticleEmitter") or part:IsA("Fire") or part:IsA("PointLight") then
								part:Destroy()
							end
						end
					end
					Creatures.viewport(tile, m, UDim2.new(1, 0, 0, 84), false, Theme)
					Ui.text(tile, if found then L(species.id) else L("collection_unknown"), { TextSize = 13, Size = UDim2.new(1, -6, 0, 18), AutomaticSize = Enum.AutomaticSize.None, Position = UDim2.new(0, 3, 0, 86), TextXAlignment = Enum.TextXAlignment.Center })
					Ui.rarity(tile, cfg, species.rarity, { TextSize = 11, Size = UDim2.new(1, 0, 0, 14), AutomaticSize = Enum.AutomaticSize.None, Position = UDim2.new(0, 0, 0, 104), TextXAlignment = Enum.TextXAlignment.Center })
				end
			end
		end
	end,
	static = true,
}
