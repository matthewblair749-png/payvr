--[[
	Revenue math shared by the in-game debug panel and the tests. The spreadsheet in /model implements
	the same formulas with live cells. All inputs come from catalog.json, so changing a price or a buy rate
	in config changes every output.
]]

local Revenue = {}

-- Gross monthly spend per daily player: sum of price x monthly buy rate.
function Revenue.spendPerDailyPlayer(cfg: any): number
	local cat = cfg.catalog
	local total = 0
	for _, p in cat.products do
		local rate = cat.planning.buyRates[p.id] or 0
		total += cat.priceTiers[p.priceTier].usd * rate
	end
	return total
end

-- Blended store commission for the standalone app (iOS 15% with the Small Business Program, Google 15%).
function Revenue.standaloneFeeRate(cfg: any, annualGrossUsd: number?): number
	local f = cfg.catalog.platformFees
	local google = f.googlePlay.rateUnderThreshold
	if annualGrossUsd and annualGrossUsd * f.platformMix.googlePlay > f.googlePlay.thresholdUsdPerYear then
		google = f.googlePlay.rateOverThreshold
	end
	return f.ios.commissionRate * f.platformMix.ios + google * f.platformMix.googlePlay
end

-- Share of player spend the developer keeps on Roblox: (1 - fee) x DevEx rate / USD per Robux.
function Revenue.robloxKeepRate(cfg: any): number
	local r = cfg.catalog.roblox
	return (1 - r.platformFee) * r.devExUsdPerRobux / r.usdPerRobux
end

function Revenue.model(cfg: any, dailyPlayers: number?): any
	local cat = cfg.catalog
	local dau = dailyPlayers or cat.planning.dailyPlayers
	local perPlayer = Revenue.spendPerDailyPlayer(cfg)
	local gross = perPlayer * dau
	local feeRate = Revenue.standaloneFeeRate(cfg, gross * 12)
	local standaloneFixed = cat.standalone.backendCostMonthlyUsd + cat.planning.marketingMonthlyUsd
	local standaloneNet = gross * (1 - feeRate)
	local keep = Revenue.robloxKeepRate(cfg)
	local robloxFixed = cat.roblox.companionBackendMonthlyUsd + cat.roblox.marketingMonthlyUsd
	local robloxNet = gross * keep + cat.planning.premiumPayoutsPerDailyPlayerMonthlyUsd * dau
	local standaloneMargin = perPlayer * (1 - feeRate)
	local robloxMargin = perPlayer * keep + cat.planning.premiumPayoutsPerDailyPlayerMonthlyUsd
	local crossover = nil
	if standaloneMargin > robloxMargin then
		crossover = (standaloneFixed - robloxFixed) / (standaloneMargin - robloxMargin)
	end
	return {
		dailyPlayers = dau,
		spendPerDailyPlayer = perPlayer,
		grossMonthly = gross,
		standalone = {
			feeRate = feeRate,
			platformFee = gross * feeRate,
			netMonthly = standaloneNet,
			fixedMonthly = standaloneFixed,
			profitMonthly = standaloneNet - standaloneFixed,
			profitYearly = (standaloneNet - standaloneFixed) * 12,
			breakEvenDailyPlayers = standaloneFixed / standaloneMargin,
		},
		roblox = {
			keepRate = keep,
			netMonthly = robloxNet,
			fixedMonthly = robloxFixed,
			profitMonthly = robloxNet - robloxFixed,
			profitYearly = (robloxNet - robloxFixed) * 12,
			breakEvenDailyPlayers = if robloxMargin > 0 then robloxFixed / robloxMargin else math.huge,
		},
		crossoverDailyPlayers = crossover,
	}
end

return Revenue
