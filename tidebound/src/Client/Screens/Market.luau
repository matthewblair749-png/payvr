local Ui = require(script.Parent.Parent.Ui.Ui)
local Theme = require(script.Parent.Parent.Ui.Theme)
local Format = require(script.Parent.Parent.Ui.Format)

return {
	title = "panel_market",
	build = function(app: any, container: Frame)
		local L = app.L
		local s = app.state
		Ui.text(container, L("market_demand_title"), { FontFace = Theme.fontBold })
		for category, mult in s.derived.demand do
			local pct = math.floor((mult - 1) * 100 + 0.5)
			local key = if pct > 0 then "market_demand_up" elseif pct < 0 then "market_demand_down" else "market_demand_flat"
			Ui.text(container, L(key, { category = L("category_" .. category), pct = math.abs(pct) }), {
				TextColor3 = if pct > 0 then Theme.colors.good elseif pct < 0 then Theme.colors.bad else Theme.colors.textDim,
			})
		end
		local count = 0
		for _, n in s.fish do
			count += n
		end
		for _, n in s.crops do
			count += n
		end
		Ui.text(container, L("market_items", { count = count }))
		Ui.button(container, L("market_sell_all"), function()
			local reply = app:intent("sellAll")
			if reply.ok then
				app:haptic(0.5)
				app:toast(L("market_sold", { silver = Format.int(reply.data.silver) }))
			end
		end, { Size = UDim2.new(1, 0, 0, 64), TextSize = 22 })
		Ui.text(container, L("market_workers", { rate = string.format("%.1f", s.derived.workerPerMinute), pending = Format.int(s.worker.pending), cap = Format.int(s.derived.workerCap) }))
		Ui.button(container, L("market_collect"), function()
			app:intent("collectWorkers")
		end, { Size = UDim2.new(1, 0, 0, 52) })
		local ads = app.catalog and app.catalog.rewardedAds
		if ads and ads.enabled then
			Ui.button(container, L("market_ad_double"), function()
				app:store("adDouble")
			end, { Size = UDim2.new(1, 0, 0, 48), BackgroundColor3 = Theme.colors.panelAlt, TextColor3 = Theme.colors.text })
		end
	end,
}
