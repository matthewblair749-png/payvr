--[[ Hatch reveal. The result was rolled on the server; this only presents it. ]]

local Ui = require(script.Parent.Parent.Ui.Ui)
local Theme = require(script.Parent.Parent.Ui.Theme)

return {
	title = "panel_hatch",
	build = function(app: any, container: Frame, data: any)
		local L = app.L
		local cfg = app.cfg
		if not data or not data.drifter then
			return
		end
		local d = data.drifter
		local egg = Ui.text(container, "🥚", { TextSize = 72, TextXAlignment = Enum.TextXAlignment.Center })
		local name = Ui.text(container, "", { TextSize = 28, FontFace = Theme.fontBold, TextXAlignment = Enum.TextXAlignment.Center })
		local rarityRow = Ui.frame(container, { BackgroundTransparency = 1, Size = UDim2.new(1, 0, 0, 36) })
		local reveal = function()
			egg.Text = "✨"
			name.Text = L(d.speciesId)
			Ui.rarity(rarityRow, cfg, data.rarity, { TextSize = 24, TextXAlignment = Enum.TextXAlignment.Center })
			if data.newSpecies then
				Ui.text(container, L("hatch_new_species"), { TextColor3 = Theme.colors.good, TextXAlignment = Enum.TextXAlignment.Center })
			end
			if data.pity then
				Ui.text(container, L("hatch_pity"), { TextColor3 = Theme.colors.accent, TextXAlignment = Enum.TextXAlignment.Center })
			end
			app:haptic(0.8)
		end
		if Theme.reducedMotion then
			reveal()
		else
			task.delay(0.8, reveal)
		end
		Ui.button(container, L("hatch_assign"), function()
			app:open("drifters")
		end, { Size = UDim2.new(1, 0, 0, 56) })
	end,
	static = true,
}
