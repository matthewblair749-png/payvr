local Ui = require(script.Parent.Parent.Ui.Ui)
local Theme = require(script.Parent.Parent.Ui.Theme)
local Format = require(script.Parent.Parent.Ui.Format)

return {
	title = "panel_welcome",
	build = function(app: any, container: Frame, data: any)
		local L = app.L
		if not data then
			return
		end
		if data.away and data.away.seconds > 60 then
			Ui.text(container, L("welcome_away", { time = Format.duration(data.away.seconds), silver = Format.int(data.away.silver) }))
			if data.away.autoCollected and data.away.autoCollected > 0 then
				Ui.text(container, L("welcome_autocollect", { silver = Format.int(data.away.autoCollected) }), { TextColor3 = Theme.colors.good })
			end
		end
		if data.login then
			Ui.text(container, L("welcome_streak", { day = data.login.day, streak = data.login.streak }), { TextColor3 = Theme.colors.accent })
		end
		Ui.button(container, L("continue"), function()
			app:close()
		end, { Size = UDim2.new(1, 0, 0, 52) })
	end,
	static = true,
}
