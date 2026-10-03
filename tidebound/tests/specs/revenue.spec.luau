--[[ Confirms the planning numbers from the brief against config defaults. ]]
return function(T, Loader)
	local Shared = Loader.root("src/Shared")
	local ConfigLoader = Loader.require(Shared.ConfigLoader)
	local Revenue = Loader.require(Shared.Revenue)
	local cfg = ConfigLoader.defaults()

	T.it("reproduces the planning numbers", function()
		local m = Revenue.model(cfg)
		print(("    spend/DAU $%.4f, gross $%.0f, standalone net $%.0f, break-even %.0f, roblox keep %.3f, crossover %.0f"):format(
			m.spendPerDailyPlayer, m.grossMonthly, m.standalone.netMonthly, m.standalone.breakEvenDailyPlayers, m.roblox.keepRate, m.crossoverDailyPlayers))
		T.expect(m.spendPerDailyPlayer).toBeNear(0.15061, 1e-5)
		T.expect(m.grossMonthly).toBeNear(1506, 1)
		T.expect(m.standalone.feeRate).toBeNear(0.15, 1e-9)
		T.expect(m.standalone.netMonthly).toBeNear(1280, 1)
		T.expect(m.standalone.fixedMonthly).toBe(1400)
		T.expect(m.standalone.breakEvenDailyPlayers).toBeNear(11000, 100)
		T.expect(m.roblox.keepRate).toBeNear(0.266, 1e-9)
		T.expect(m.crossoverDailyPlayers).toBeNear(16000, 150)
	end)

	T.it("moves with config: a buy-rate change flows through without code edits", function()
		local cfg2 = ConfigLoader.build(ConfigLoader.defaultSections(), { catalog = { planning = { buyRates = { starter_pack = 0.02 } } } })
		local m = Revenue.model(cfg2)
		T.expect(m.spendPerDailyPlayer).toBeNear(0.15061 + 2.99 * 0.01, 1e-5)
	end)

	T.it("switches Google to 30% above $1M a year", function()
		T.expect(Revenue.standaloneFeeRate(cfg, 3000000)).toBeNear(0.225, 1e-9)
	end)
end
