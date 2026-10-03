--[[ Spending summary and the monthly limit. Raising a limit waits 24 hours; lowering is immediate. ]]

local Ui = require(script.Parent.Parent.Ui.Ui)
local Theme = require(script.Parent.Parent.Ui.Theme)
local Format = require(script.Parent.Parent.Ui.Format)

return {
	title = "panel_spending",
	build = function(app: any, container: Frame)
		local L = app.L
		local reply = app:store("spending")
		if not reply.ok then
			Ui.text(container, L("loading"))
			return
		end
		local d = reply.data
		Ui.text(container, L("spending_this_month", { robux = Format.int(d.thisMonth) }), { FontFace = Theme.fontBold, TextSize = 22 })
		Ui.text(container, if d.limit then L("spending_limit", { robux = Format.int(d.limit) }) else L("spending_no_limit"))
		if d.pendingLimitAt then
			local now = workspace:GetServerTimeNow()
			local target = if d.pendingNoLimit then L("spending_no_limit") else L("spending_limit", { robux = Format.int(d.pendingLimit or 0) })
			Ui.text(container, L("spending_pending", { target = target, time = Format.duration(d.pendingLimitAt - now) }), { TextColor3 = Theme.colors.accent })
		end
		Ui.text(container, L("spending_set_limit"), { FontFace = Theme.fontBold })
		local grid = Ui.frame(container, { BackgroundTransparency = 1, Size = UDim2.new(1, 0, 0, 0), AutomaticSize = Enum.AutomaticSize.Y })
		Ui.grid(grid, Vector2.new(110, 48), 8)
		for _, option in app.cfg.catalog.spendControls.limitOptionsRobux do
			Ui.button(grid, L("robux_amount", { robux = Format.int(option) }), function()
				local r = app:intent("setSpendLimit", { robux = option })
				if r.ok then
					app:open("spending")
				end
			end, { TextSize = 15 })
		end
		Ui.button(grid, L("spending_no_limit_button"), function()
			local r = app:intent("setSpendLimit", { robux = nil })
			if r.ok then
				app:open("spending")
			end
		end, { TextSize = 15 })
		Ui.text(container, L("spending_roblox_controls"), { TextColor3 = Theme.colors.textDim, TextSize = 15 })
		Ui.text(container, L("spending_history"), { FontFace = Theme.fontBold })
		for _, m in d.months do
			Ui.text(container, m.month .. ": " .. L("robux_amount", { robux = Format.int(m.robux) }))
		end
		Ui.text(container, L("spending_recent"), { FontFace = Theme.fontBold })
		for _, p in d.purchases do
			Ui.text(container, L(p.productId) .. " - " .. L("robux_amount", { robux = Format.int(p.robux) }) .. (if p.reversed then " (" .. L("spending_reversed") .. ")" else ""), { TextSize = 15 })
		end
		Ui.text(container, L("spending_gems_spent", { gems = Format.int(d.gemsSpent) }))
	end,
	static = true,
}
