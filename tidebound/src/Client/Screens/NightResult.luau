local Ui = require(script.Parent.Parent.Ui.Ui)
local Theme = require(script.Parent.Parent.Ui.Theme)
local Format = require(script.Parent.Parent.Ui.Format)

return {
	title = "panel_night_result",
	build = function(app: any, container: Frame, r: any)
		local L = app.L
		if not r then
			return
		end
		local headline = if r.partial then "result_left" elseif r.survived then "result_survived" else "result_failed"
		Ui.text(container, L(headline, { waves = r.wavesSurvived }), { TextSize = 26, FontFace = Theme.fontBold, TextColor3 = if r.survived then Theme.colors.good else Theme.colors.accent })
		if r.bossDefeated then
			Ui.text(container, L("result_boss"), { TextColor3 = Theme.colors.accent })
		end
		Ui.text(container, L("result_silver", { silver = Format.int(r.silver) }))
		if r.pearls > 0 then
			Ui.text(container, L("result_pearls", { pearls = r.pearls }))
		end
		Ui.text(container, L("result_materials", { driftwood = r.materials.driftwood or 0, shells = r.materials.shells or 0, iron = r.materials.ironScrap or 0 }))
		Ui.text(container, L("result_share", { pct = math.floor(r.share * 100 + 0.5), repair = Format.int(r.repairHp or 0) }), { TextColor3 = Theme.colors.textDim })
		if r.survived then
			Ui.text(container, L("result_streak", { streak = r.streakAfter, bonus = math.floor(r.streakBonus * 100 + 0.5) }))
		elseif not r.partial then
			Ui.text(container, L("result_failed_note"), { TextColor3 = Theme.colors.textDim })
		end
		Ui.button(container, L("continue"), function()
			app:close()
			-- The one-time Starter Pack offer may follow the first finished night.
			local s = app.state
			if s and s.night.firstCompleted and not s.flags.starterOfferShown and not s.entitlements.starterPack then
				app:open("starterOffer")
			end
		end, { Size = UDim2.new(1, 0, 0, 56) })
	end,
	static = true,
}
