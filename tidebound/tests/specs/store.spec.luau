--[[
	Sandbox purchase tests. Every product in the catalog is bought, granted once,
	replayed with the same PurchaseId (no second grant), then reversed.
	Also proves that nothing sold changes power, drop rates, or rewards.
]]
return function(T, Loader)
	local Shared = Loader.root("src/Shared")
	local ConfigLoader = Loader.require(Shared.ConfigLoader)
	local SaveSchema = Loader.require(Shared.SaveSchema)
	local Rng = Loader.require(Shared.Util.Rng)
	local Tbl = Loader.require(Shared.Util.Tbl)
	local Time = Loader.require(Shared.Util.Time)
	local Catalog = Loader.require(Shared.Store.Catalog)
	local Purchases = Loader.require(Shared.Store.Purchases)
	local Pass = Loader.require(Shared.Store.Pass)
	local Club = Loader.require(Shared.Store.Club)
	local Spending = Loader.require(Shared.Store.Spending)
	local GemShop = Loader.require(Shared.Store.GemShop)
	local Drifters = Loader.require(Shared.Rules.Drifters)
	local Hatchery = Loader.require(Shared.Rules.Hatchery)
	local Odds = Loader.require(Shared.Rules.Odds)
	local IntentProcessor = Loader.require(Shared.Intents.IntentProcessor)

	local cfg = ConfigLoader.defaults()
	local NOW = Time.parseUtc("2026-10-05T12:00:00Z")

	local function veteran()
		local save = SaveSchema.new(42, NOW - 86400, cfg)
		save.night.firstCompleted = true
		save.progress.level = 10
		local rng = Rng.new(1)
		for i = 1, 6 do
			local d = Hatchery.hatch(cfg, save, rng, NOW)
			d.active = i <= Drifters.activeSlots(cfg, save.progress.level)
			d.role = if i % 2 == 0 then "guardian" else "worker"
		end
		return save
	end

	local function powerSnapshot(save)
		local g = Drifters.guardianProfile(cfg, save)
		return {
			power = g.power,
			speed = g.speed,
			income = Drifters.workerIncomePerMinute(cfg, save),
			slots = Drifters.activeSlots(cfg, save.progress.level),
			hatchOdds = Hatchery.odds(cfg).rows[5].overall,
			pity = save.hatch.sinceEpic,
		}
	end

	T.describe("Purchase flow", function()
		T.it("blocks every purchase before the first night is finished", function()
			local save = SaveSchema.new(1, NOW, cfg)
			for _, p in cfg.catalog.products do
				T.expect(Purchases.canBuy(cfg, save, Catalog.product(cfg, p.id, 1), NOW, nil)).toBe("store_locked")
			end
		end)

		T.it("buys, grants once, and reverses every receipt product", function()
			for _, p in cfg.catalog.products do
				if p.robloxType ~= "subscription" then
					local save = veteran()
					local product = Catalog.product(cfg, p.id, save.userId)
					T.expect(Purchases.canBuy(cfg, save, product, NOW, { ArePaidRandomItemsRestricted = false })).toBe(nil)
					local before = Tbl.deepCopy(save)
					local rng = Rng.new(5)
					local purchaseId = "receipt-" .. p.id
					local first = Purchases.grant(cfg, save, product, purchaseId, product.robux, NOW, rng)
					T.expect(first.granted).toBeTruthy()
					T.expect(first.events[1].name).toBe("purchase_completed")
					T.expect(first.events[1].props.variantId).toBe("control")
					local afterFirst = Tbl.deepCopy(save)

					-- Roblox retries ProcessReceipt until it gets PurchaseGranted: the retry must not grant again.
					local second = Purchases.grant(cfg, save, product, purchaseId, product.robux, NOW, rng)
					T.expect(second.granted).toBeFalsy()
					T.expect(second.duplicate).toBeTruthy()
					T.expect(save.currencies.gems).toBe(afterFirst.currencies.gems)

					if p.kind == "gems" then
						T.expect(save.currencies.gems - before.currencies.gems).toBe(p.gems)
					elseif p.kind == "starterPack" then
						T.expect(save.entitlements.starterPack).toBeTruthy()
						T.expect(save.hatch.eggs).toBe(1)
						T.expect(save.cosmetics.skin_starter_sailor).toBe(1)
						-- One per account.
						T.expect(Purchases.canBuy(cfg, save, product, NOW, nil)).toBe("already_owned")
					elseif p.kind == "storagePass" then
						T.expect(save.entitlements.storagePass).toBeTruthy()
						T.expect(Club.autoCollect(save)).toBeTruthy()
					elseif p.kind == "pass" then
						T.expect(Pass.ownsPaid(cfg, save, NOW)).toBeTruthy()
						T.expect(Purchases.canBuy(cfg, save, product, NOW, nil)).toBe("already_owned")
					elseif p.kind == "crate" then
						T.expect(first.crate ~= nil).toBeTruthy()
						T.expect(first.events[2].name).toBe("crate_opened")
					end
					T.expect(Spending.spentThisMonth(save, NOW)).toBe(product.robux)

					local reversed = Purchases.reverse(cfg, save, purchaseId, "chargeback")
					T.expect(reversed.reversed).toBeTruthy()
					T.expect(reversed.events[1].name).toBe("purchase_refunded")
					T.expect(save.currencies.gems).toBe(before.currencies.gems)
					T.expect(save.entitlements.starterPack).toBe(before.entitlements.starterPack)
					T.expect(save.entitlements.storagePass).toBe(before.entitlements.storagePass)
					T.expect(save.hatch.eggs).toBe(before.hatch.eggs)
					T.expect(Pass.ownsPaid(cfg, save, NOW)).toBe(false)
					for id in save.cosmetics do
						T.expect(before.cosmetics[id] ~= nil).toBeTruthy()
					end
					-- A second reversal does nothing.
					T.expect(Purchases.reverse(cfg, save, purchaseId, "chargeback").reversed).toBeFalsy()
				end
			end
		end)

		T.it("turns spent reversed Gems into debt instead of taking items, and blocks Gem spending until repaid", function()
			local save = veteran()
			local product = Catalog.product(cfg, "gems_pouch", 42)
			Purchases.grant(cfg, save, product, "r1", product.robux, NOW, Rng.new(1))
			local result = IntentProcessor.apply({ cfg = cfg, now = NOW, rng = Rng.new(2), userId = 42, mods = {}, cycleIndex = 0 }, save, { type = "buyGemItem", args = { item = "skin_crown_of_shells" } })
			T.expect(result.ok).toBeTruthy()
			Purchases.reverse(cfg, save, "r1", "refund")
			T.expect(save.currencies.gems).toBe(0)
			T.expect(save.debt.gems).toBe(450)
			-- The cosmetic bought with those Gems stays; nothing is deleted.
			T.expect(save.cosmetics.skin_crown_of_shells).toBe(1)
			local blocked = GemShop.buy(cfg, save, "rodskin_bamboo", 42, Rng.new(3))
			T.expect(blocked).toBe(nil)
			-- The next Gem grant repays the debt first.
			Purchases.grant(cfg, save, product, "r2", product.robux, NOW, Rng.new(1))
			T.expect(save.debt.gems).toBe(0)
			T.expect(save.currencies.gems).toBe(0)
		end)

		T.it("reverses paid Harbor Pass rewards with the pass", function()
			local save = veteran()
			local product = Catalog.product(cfg, "harbor_pass", 42)
			Purchases.grant(cfg, save, product, "pass1", product.robux, NOW, Rng.new(1))
			Pass.addXp(cfg, save, 3 * cfg.catalog.harborPass.xpPerTier, NOW)
			local ctx = { cfg = cfg, now = NOW, rng = Rng.new(2), userId = 42, mods = {}, cycleIndex = 0 }
			T.expect(IntentProcessor.apply(ctx, save, { type = "claimPass", args = { track = "paid", tier = 3 } }).ok).toBeTruthy()
			T.expect(IntentProcessor.apply(ctx, save, { type = "claimPass", args = { track = "paid", tier = 1 } }).ok).toBeTruthy()
			T.expect(save.currencies.gems).toBe(30)
			T.expect(save.cosmetics.emote_salute).toBe(1)
			Purchases.reverse(cfg, save, "pass1", "refund")
			T.expect(save.currencies.gems).toBe(0)
			T.expect(save.cosmetics.emote_salute).toBe(nil)
			-- Free track rewards are untouched and still claimable.
			T.expect(IntentProcessor.apply(ctx, save, { type = "claimPass", args = { track = "free", tier = 1 } }).ok).toBeTruthy()
		end)

		T.it("applies subscription status changes and daily Gems", function()
			local save = veteran()
			T.expect(Club.applyStatus(save, true, true, NOW)).toBe("subscription_started")
			T.expect(Drifters.storageCapacity(cfg, save)).toBe(cfg.economy.storage.cap)
			local entries = Club.claimDaily(cfg, save, NOW)
			T.expect(entries[1].n).toBe(30)
			local _, again = Club.claimDaily(cfg, save, NOW + 60)
			T.expect(again).toBe("already_claimed")
			T.expect(Club.applyStatus(save, true, true, NOW + 31 * 86400)).toBe("subscription_renewed")
			T.expect(Club.applyStatus(save, true, false, NOW + 32 * 86400)).toBe("subscription_cancelled")
			T.expect(Club.applyStatus(save, false, false, NOW + 62 * 86400)).toBe(nil)
			T.expect(save.entitlements.club.active).toBeFalsy()
		end)
	end)

	T.describe("Spending controls", function()
		T.it("enforces the monthly limit and delays raising it by 24 hours", function()
			local save = veteran()
			T.expect(Spending.setLimit(cfg, save, 500, NOW)).toBe(nil)
			local crate = Catalog.product(cfg, "cosmetic_crate", 42)
			Purchases.grant(cfg, save, Catalog.product(cfg, "gems_pouch", 42), "a", 499, NOW, Rng.new(1))
			T.expect(Purchases.canBuy(cfg, save, crate, NOW, nil)).toBe("spend_limit")
			local _, appliesAt = Spending.setLimit(cfg, save, 1000, NOW)
			T.expect(appliesAt).toBe(NOW + 86400)
			T.expect(Purchases.canBuy(cfg, save, crate, NOW + 3600, nil)).toBe("spend_limit")
			T.expect(Purchases.canBuy(cfg, save, crate, NOW + 86401, nil)).toBe(nil)
			T.expect(Spending.setLimit(cfg, save, 123, NOW)).toBe("bad_limit")
			local summary = Spending.summary(save, NOW)
			T.expect(summary.thisMonth).toBe(499)
			T.expect(#summary.purchases).toBe(1)
		end)

		T.it("hides paid random items where Roblox policy restricts them", function()
			local save = veteran()
			local crate = Catalog.product(cfg, "cosmetic_crate", 42)
			T.expect(Purchases.canBuy(cfg, save, crate, NOW, { ArePaidRandomItemsRestricted = true })).toBe("random_items_restricted")
		end)
	end)

	T.describe("Fairness", function()
		T.it("no product or Gem item changes power, speed, income, slots, or drop rates", function()
			local save = veteran()
			local baseline = powerSnapshot(save)
			local rng = Rng.new(9)
			for i, p in cfg.catalog.products do
				local product = Catalog.product(cfg, p.id, 42)
				if p.robloxType == "subscription" then
					Club.applyStatus(save, true, true, NOW)
					Club.claimDaily(cfg, save, NOW)
				else
					Purchases.grant(cfg, save, product, "fair" .. i, product.robux, NOW, rng)
				end
			end
			save.currencies.gems += 100000
			for _, g in cfg.catalog.gemItems do
				GemShop.buy(cfg, save, g.id, 42, rng)
			end
			local after = powerSnapshot(save)
			for k, v in baseline do
				T.expect(after[k]).toBe(v)
			end
			-- Storage only reaches the same cap free players reach with Silver.
			T.expect(Drifters.storageCapacity(cfg, save)).toBe(cfg.economy.storage.cap)
		end)
	end)

	T.describe("Price tests", function()
		T.it("assigns stable variants and logs them on purchase", function()
			local cfg2 = ConfigLoader.build(ConfigLoader.defaultSections(), {
				catalog = { experiments = { { id = "exp_starter_price", enabled = true, productId = "starter_pack", variants = {
					{ id = "control", weight = 50 },
					{ id = "price_3_99", weight = 50, robloxId = 777, priceTier = "tier_3_99" },
				} } } },
			})
			local seen = {}
			for userId = 1, 400 do
				local v = Catalog.product(cfg2, "starter_pack", userId)
				seen[v.variantId] = (seen[v.variantId] or 0) + 1
				T.expect(Catalog.product(cfg2, "starter_pack", userId).variantId).toBe(v.variantId)
			end
			T.expect(seen.control).toBeAtLeast(150)
			T.expect(seen.price_3_99).toBeAtLeast(150)
			local view = Catalog.fromRobloxId(cfg2, "gamePass", 777)
			T.expect(view.variantId).toBe("price_3_99")
			T.expect(view.robux).toBe(399)
			local save = veteran()
			local g = Purchases.grant(cfg2, save, view, "v1", 399, NOW, Rng.new(1))
			T.expect(g.events[1].props.variantId).toBe("price_3_99")
			T.expect(save.purchases.ledger.v1.variantId).toBe("price_3_99")
		end)

		T.it("derives Robux prices from config so a price change needs no code edit", function()
			T.expect(Catalog.product(cfg, "gems_handful", 1).robux).toBe(99)
			T.expect(Catalog.product(cfg, "gems_vault", 1).robux).toBe(4999)
			local cfg2 = ConfigLoader.build(ConfigLoader.defaultSections(), { catalog = { priceTiers = { tier_0_99 = { usd = 1.49 } } } })
			T.expect(Catalog.product(cfg2, "gems_handful", 1).robux).toBe(149)
			local cfg3 = ConfigLoader.build(ConfigLoader.defaultSections(), { catalog = { products = (function()
				local list = Tbl.deepCopy(cfg.catalog.products)
				list[1].gems = 100
				return list
			end)() } })
			T.expect(Catalog.product(cfg3, "gems_handful", 1).gems).toBe(100)
		end)

		T.it("shows odds that come from the same config the server rolls with", function()
			local view = Catalog.clientView(cfg, 1)
			local crateOdds = view.crates.crate_tidecomb.odds
			local base = Odds.base(cfg.index.crates.crate_tidecomb.rarityWeights)
			for _, row in crateOdds.rows do
				T.expect(row.base).toBeNear(base[row.rarity], 1e-12)
			end
			T.expect(crateOdds.epicEvery).toBe(30)
		end)
	end)
end
