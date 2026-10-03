local Ui = require(script.Parent.Parent.Ui.Ui)
local Theme = require(script.Parent.Parent.Ui.Theme)
local Format = require(script.Parent.Parent.Ui.Format)

return {
	title = "panel_farm",
	build = function(app: any, container: Frame)
		local L = app.L
		local s = app.state
		local now = workspace:GetServerTimeNow()
		local selected = app.selectedCrop or "crop_sea_lettuce"
		Ui.text(container, L("farm_pick_seed"), { FontFace = Theme.fontBold })
		local seeds = Ui.row(container)
		for _, crop in app.cfg.day.farming.crops do
			local locked = s.progress.level < crop.levelRequired
			Ui.button(seeds, L(crop.id) .. "\n" .. L("farm_seed_cost", { cost = crop.seedCost, time = crop.growSeconds }), function()
				app.selectedCrop = crop.id
				app:open("farm")
			end, {
				Size = UDim2.new(0, 130, 0, 64),
				TextSize = 14,
				BackgroundColor3 = if selected == crop.id then Theme.colors.accent else Theme.colors.panel,
				TextColor3 = if selected == crop.id then Theme.colors.buttonText else Theme.colors.text,
				AutoButtonColor = not locked,
				Active = not locked,
			})
		end
		Ui.button(container, L("farm_harvest_all"), function()
			app:intent("harvestAll")
		end, { Size = UDim2.new(1, 0, 0, 52) })
		local grid = Ui.frame(container, { BackgroundTransparency = 1, Size = UDim2.new(1, 0, 0, 0), AutomaticSize = Enum.AutomaticSize.Y })
		Ui.grid(grid, Vector2.new(104, 88), 8)
		for i, plot in s.plots do
			local readyAt = s.derived.plotsReadyAt[i] or 0
			local label
			if not plot.cropId then
				label = L("farm_empty")
			elseif now >= readyAt then
				label = L("farm_ready", { crop = L(plot.cropId) })
			else
				label = L("farm_growing", { crop = L(plot.cropId), time = Format.duration(readyAt - now) })
			end
			Ui.button(grid, label, function()
				if not plot.cropId then
					app:intent("plant", { plot = i, crop = selected })
				else
					app:intent("harvest", { plot = i })
				end
			end, { Size = UDim2.fromOffset(104, 88), TextSize = 14, BackgroundColor3 = if plot.cropId and now >= readyAt then Theme.colors.good else Theme.colors.panelAlt, TextColor3 = Theme.colors.text })
		end
		if #s.plots < app.cfg.day.farming.maxPlots then
			local i = #s.plots - app.cfg.day.farming.startPlots + 1
			Ui.button(container, L("farm_buy_plot", { price = app.cfg.day.farming.extraPlotPrices[i], level = app.cfg.day.farming.extraPlotLevels[i] }), function()
				app:intent("buyPlot")
			end, { Size = UDim2.new(1, 0, 0, 52) })
		end
	end,
	-- Timers count down, so refresh every second while open.
	refreshEvery = 1,
}
