--[[ Farming plots. Growth uses timestamps, so crops keep growing while the player is away. ]]

local Farming = {}

function Farming.growSeconds(cfg: any, cropId: string, mods: any): number
	local crop = cfg.index.crops[cropId]
	return crop.growSeconds * math.max(0.25, 1 + (mods.cropGrowPct or 0) / 100)
end

function Farming.readyAt(cfg: any, plot: any, mods: any): number?
	if not plot.cropId then
		return nil
	end
	return plot.plantedAt + Farming.growSeconds(cfg, plot.cropId, mods)
end

function Farming.plant(cfg: any, save: any, plotIndex: number, cropId: string, now: number): string?
	local plot = save.plots[plotIndex]
	if not plot then
		return "bad_plot"
	end
	if plot.cropId then
		return "plot_busy"
	end
	local crop = cfg.index.crops[cropId]
	if not crop then
		return "unknown_crop"
	end
	if save.progress.level < crop.levelRequired then
		return "level_too_low"
	end
	if save.currencies.silver < crop.seedCost then
		return "not_enough_silver"
	end
	save.currencies.silver -= crop.seedCost
	plot.cropId = cropId
	plot.plantedAt = now
	return nil
end

-- Returns (cropId) or (nil, errorCode).
function Farming.harvest(cfg: any, save: any, plotIndex: number, now: number, mods: any): (string?, string?)
	local plot = save.plots[plotIndex]
	if not plot then
		return nil, "bad_plot"
	end
	if not plot.cropId then
		return nil, "plot_empty"
	end
	if now < Farming.readyAt(cfg, plot, mods) then
		return nil, "not_ready"
	end
	local cropId = plot.cropId
	save.crops[cropId] = (save.crops[cropId] or 0) + 1
	plot.cropId = nil
	plot.plantedAt = 0
	return cropId, nil
end

function Farming.buyPlot(cfg: any, save: any): string?
	local f = cfg.day.farming
	local owned = #save.plots
	if owned >= f.maxPlots then
		return "max_plots"
	end
	local i = owned - f.startPlots + 1
	if save.progress.level < f.extraPlotLevels[i] then
		return "level_too_low"
	end
	if save.currencies.silver < f.extraPlotPrices[i] then
		return "not_enough_silver"
	end
	save.currencies.silver -= f.extraPlotPrices[i]
	table.insert(save.plots, { cropId = nil, plantedAt = 0 })
	return nil
end

return Farming
