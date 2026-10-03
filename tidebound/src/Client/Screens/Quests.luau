local Ui = require(script.Parent.Parent.Ui.Ui)
local Theme = require(script.Parent.Parent.Ui.Theme)

local function questCard(app: any, container: Instance, entry: any, def: any)
	local L = app.L
	local card = Ui.card(container)
	Ui.text(card, L(def.id, { target = def.target }), { FontFace = Theme.fontBold })
	Ui.text(card, L("quest_progress", { progress = entry.progress, target = def.target, silver = def.silver or 0 }), { TextSize = 15 })
	if entry.claimed then
		Ui.text(card, L("quest_claimed"), { TextColor3 = Theme.colors.good })
	elseif entry.progress >= def.target then
		Ui.button(card, L("quest_claim"), function()
			app:intent("claimQuest", { quest = entry.id })
		end, { Size = UDim2.new(1, 0, 0, 48) })
	end
end

return {
	title = "panel_quests",
	build = function(app: any, container: Frame)
		local L = app.L
		local s = app.state
		local cfg = app.cfg
		Ui.text(container, L("quests_daily"), { FontFace = Theme.fontBold })
		for _, entry in s.quests.daily do
			questCard(app, container, entry, cfg.index.quests[entry.id])
		end
		if s.quests.weekly then
			Ui.text(container, L("quests_weekly"), { FontFace = Theme.fontBold })
			questCard(app, container, s.quests.weekly, cfg.index.quests[s.quests.weekly.id])
		end
		Ui.text(container, L("quests_streak", { days = s.login.streak, nights = s.night.streak }), { TextColor3 = Theme.colors.textDim })
		Ui.text(container, L("quests_level", { level = s.progress.level, xp = s.progress.xp, next = s.derived.xpToNext }))
	end,
}
