--[[
	Odds for any random reward, shown before purchase or hatch: base odds per rarity, the overall rate
	including pity, the pity rule itself, and (for crates) the chance of each item class and item.
	All numbers come from the server's catalog view, computed from the same config the server rolls with.
]]

local Ui = require(script.Parent.Parent.Ui.Ui)
local Theme = require(script.Parent.Parent.Ui.Theme)
local Format = require(script.Parent.Parent.Ui.Format)

return {
	title = "panel_odds",
	build = function(app: any, container: Frame, args: any)
		local L = app.L
		local cfg = app.cfg
		local catalog = app.catalog
		if not catalog then
			Ui.text(container, L("loading"))
			return
		end
		local odds, crate
		if args and args.kind == "crate" then
			crate = catalog.crates[args.crateId]
			odds = crate.odds
			Ui.text(container, L("odds_crate_title"), { FontFace = Theme.fontBold })
			Ui.text(container, L("odds_crate_pity", { n = odds.epicEvery }))
		else
			odds = catalog.hatchOdds
			Ui.text(container, L("odds_hatch_title"), { FontFace = Theme.fontBold })
			Ui.text(container, L("odds_hatch_pity", { epic = odds.epicEvery, legendary = odds.legendaryEvery }))
		end
		local header = Ui.row(container, 28)
		Ui.text(header, L("odds_rarity"), { Size = UDim2.new(0.4, 0, 0, 28), AutomaticSize = Enum.AutomaticSize.None, FontFace = Theme.fontBold })
		Ui.text(header, L("odds_base"), { Size = UDim2.new(0.28, 0, 0, 28), AutomaticSize = Enum.AutomaticSize.None, FontFace = Theme.fontBold })
		Ui.text(header, L("odds_overall"), { Size = UDim2.new(0.28, 0, 0, 28), AutomaticSize = Enum.AutomaticSize.None, FontFace = Theme.fontBold })
		for _, row in odds.rows do
			local r = Ui.row(container, 28)
			Ui.rarity(r, cfg, row.rarity, { Size = UDim2.new(0.4, 0, 0, 28), AutomaticSize = Enum.AutomaticSize.None })
			Ui.text(r, Format.pct(row.base), { Size = UDim2.new(0.28, 0, 0, 28), AutomaticSize = Enum.AutomaticSize.None })
			Ui.text(r, Format.pct(row.overall), { Size = UDim2.new(0.28, 0, 0, 28), AutomaticSize = Enum.AutomaticSize.None })
		end
		if crate then
			Ui.text(container, L("odds_by_class"), { FontFace = Theme.fontBold })
			for class, share in odds.classes do
				Ui.text(container, L("class_" .. class) .. ": " .. Format.pct(share))
			end
			Ui.text(container, L("odds_by_item"), { FontFace = Theme.fontBold })
			for _, item in crate.items do
				Ui.text(container, L(item.id) .. " (" .. L("rarity_" .. item.rarity) .. "): " .. Format.pct(odds.items[item.id]), { TextSize = 15 })
			end
			Ui.text(container, L("odds_duplicates"), { TextColor3 = Theme.colors.textDim, TextSize = 15 })
		end
		Ui.text(container, L("odds_explainer"), { TextColor3 = Theme.colors.textDim, TextSize = 15 })
	end,
}
