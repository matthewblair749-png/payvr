--[[
	Sandbox purchase tests on the real server code: every catalog product is bought through the Store
	remote, charged by (mock) Roblox, granted by ProcessReceipt exactly once, and reversed.
	Plus session locking across servers, moderation, privacy controls, rate limits and live config.
]]
return function(T, _Loader)
	local fs = require("@lune/fs")
	local serde = require("@lune/serde")
	local Runtime = require("../harness/RobloxRuntime")
	local Clients = require("../harness/Clients")
	local PLACE = "tests/.build/tidebound-dev.rbxl"

	-- Roblox ids as they would be after creating the products on the Creator Hub.
	local function catalogWithIds()
		local catalog = serde.decode("json", fs.readFile("shared/config/catalog.json"))
		for i, p in catalog.products do
			p.robloxId = if p.robloxType == "subscription" then "EXP-1000" .. i else 1000 + i
		end
		return catalog.products
	end

	local function veteranServer(userId: number)
		local backend = Runtime.newBackend()
		backend.stores.LiveConfig = { overrides = { catalog = { products = catalogWithIds() } } }
		local rt = Runtime.new(PLACE, { backend = backend })
		rt:start()
		local p = rt:join(userId)
		T.expect(rt:invoke(p, "Debug", "finishTutorial").ok).toBeTruthy()
		return rt, p, backend
	end

	local function product(rt, id)
		return rt:service("ConfigService").get().index.products[id]
	end

	local function receipt(rt, p, robloxId, purchaseId, robux)
		local market = rt.services.MarketplaceService
		return rt:run(function()
			return market.ProcessReceipt({ PlayerId = p.UserId, ProductId = robloxId, PurchaseId = purchaseId, CurrencySpent = robux, PlaceIdWherePurchased = 1 })
		end)
	end

	T.describe("Store on the server", function()
		T.it("grants every developer product exactly once and reverses it on request", function()
			local rt, p, backend = veteranServer(301)
			for _, id in { "gems_handful", "gems_pouch", "gems_chest", "gems_hoard", "gems_vault", "cosmetic_crate", "harbor_pass" } do
				local prod = product(rt, id)
				local before = rt:state(p)
				-- Purchase prompts are rate limited (6 a minute); space them like a real player would.
				rt:advance(15)
				local reply = rt:invoke(p, "Store", "buy", { productId = id })
				T.expect(reply.err).toBe(nil)
				local prompt = rt.prompts[#rt.prompts]
				T.expect(prompt.kind).toBe("product")
				T.expect(prompt.id).toBe(prod.robloxId)
				local purchaseId = "P-" .. id
				local decision = receipt(rt, p, prod.robloxId, purchaseId, 0)
				T.expect(tostring(decision)).toBe("Enum.ProductPurchaseDecision.PurchaseGranted")
				local after = rt:state(p)
				-- Roblox retries until it hears PurchaseGranted: a retry must not grant twice.
				T.expect(tostring(receipt(rt, p, prod.robloxId, purchaseId, 0))).toBe("Enum.ProductPurchaseDecision.PurchaseGranted")
				local again = rt:state(p)
				T.expect(again.currencies.gems).toBe(after.currencies.gems)
				if prod.kind == "gems" then
					T.expect(after.currencies.gems - before.currencies.gems).toBe(prod.gems)
				end
				-- Audit log written.
				T.expect(backend.stores.PurchaseAudit[purchaseId].status).toBe("granted")
				-- Support reversal through the backend's MessagingService topic.
				rt:run(function()
					rt.services.MessagingService:PublishAsync("tidebound-reverse", { userId = 301, purchaseId = purchaseId, reason = "chargeback" })
				end)
				rt:advance(0.5)
				local reversed = rt:state(p)
				T.expect(reversed.currencies.gems).toBe(before.currencies.gems)
				T.expect(backend.stores.PurchaseAudit[purchaseId].status).toBe("reversed")
			end
			T.expect(rt:eventCount("purchase_completed", 301)).toBe(7)
			T.expect(rt:eventCount("purchase_refunded", 301)).toBe(7)
			T.expect(rt:eventCount("purchase_started", 301)).toBe(7)
			rt:assertNoErrors()
		end)

		T.it("rolls back and asks Roblox to retry when the save fails", function()
			local rt, p, backend = veteranServer(302)
			local prod = product(rt, "gems_pouch")
			backend.failUpdates = 3
			local decision = receipt(rt, p, prod.robloxId, "P-fail", 499)
			T.expect(tostring(decision)).toBe("Enum.ProductPurchaseDecision.NotProcessedYet")
			T.expect(rt:service("DataService").saveOf(p).currencies.gems).toBe(0)
			decision = receipt(rt, p, prod.robloxId, "P-fail", 499)
			T.expect(tostring(decision)).toBe("Enum.ProductPurchaseDecision.PurchaseGranted")
			T.expect(rt:service("DataService").saveOf(p).currencies.gems).toBe(450)
			-- The grant was saved before Roblox was told.
			T.expect(backend.stores.Players.u302.data.purchases.processed["P-fail"]).toBeTruthy()
		end)

		T.it("mirrors game passes and reverses them when Roblox revokes ownership", function()
			local rt, p, backend = veteranServer(303)
			local starter = product(rt, "starter_pack")
			T.expect(rt:invoke(p, "Store", "buy", { productId = "starter_pack" }).ok).toBeTruthy()
			T.expect(rt.prompts[#rt.prompts].kind).toBe("gamePass")
			rt.ownedPasses["303:" .. starter.robloxId] = true
			rt:run(function()
				rt.services.MarketplaceService.PromptGamePassPurchaseFinished:Fire(p, starter.robloxId, true)
			end)
			rt:advance(0.5)
			local s = rt:state(p)
			T.expect(s.entitlements.starterPack).toBeTruthy()
			T.expect(s.hatch.eggs).toBe(1)
			T.expect(rt:invoke(p, "Store", "buy", { productId = "starter_pack" }).err).toBe("already_owned")
			-- Refunded on Roblox: the next join reverses it.
			rt:leave(p)
			rt.ownedPasses["303:" .. starter.robloxId] = nil
			local p2 = rt:join(303)
			rt:advance(1)
			T.expect(rt:state(p2).entitlements.starterPack).toBeFalsy()
			T.expect(rt:eventCount("purchase_refunded", 303)).toBe(1)
			T.expect(backend.stores.Players.u303 ~= nil).toBeTruthy()
		end)

		T.it("tracks the Harbor Club subscription from Roblox status", function()
			local rt, p = veteranServer(304)
			local club = product(rt, "harbor_club")
			T.expect(rt:invoke(p, "Store", "buy", { productId = "harbor_club" }).ok).toBeTruthy()
			T.expect(rt.prompts[#rt.prompts].id).toBe(club.robloxId)
			rt.subscriptions[304] = { IsSubscribed = true, IsRenewing = true }
			rt:run(function()
				rt.services.Players.UserSubscriptionStatusChanged:Fire(p, club.robloxId)
			end)
			rt:advance(0.5)
			T.expect(rt:state(p).entitlements.club.active).toBeTruthy()
			T.expect(rt:eventCount("subscription_started", 304)).toBe(1)
			T.expect(Clients.intent(rt, p, "claimClubDaily").ok).toBeTruthy()
			T.expect(rt:state(p).currencies.gems).toBe(30)
		end)

		T.it("enforces the spend limit and paid random item policy before prompting", function()
			local rt, p = veteranServer(305)
			T.expect(Clients.intent(rt, p, "setSpendLimit", { robux = 0 }).ok).toBeTruthy()
			local before = #rt.prompts
			T.expect(rt:invoke(p, "Store", "buy", { productId = "gems_handful" }).err).toBe("spend_limit")
			T.expect(#rt.prompts).toBe(before)
			local rt2 = Runtime.new(PLACE, { backend = rt.backend, jobId = "job-x" })
			rt2:start()
			local restricted = rt2:join(306, { policy = { ArePaidRandomItemsRestricted = true } })
			rt2:invoke(restricted, "Debug", "finishTutorial")
			T.expect(rt2:invoke(restricted, "Store", "buy", { productId = "cosmetic_crate" }).err).toBe("random_items_restricted")
			local catalog = rt2:invoke(restricted, "Store", "catalog")
			T.expect(catalog.data.randomItemsRestricted).toBeTruthy()
			-- Odds are part of the catalog the client renders.
			T.expect(#catalog.data.crates.crate_tidecomb.odds.rows).toBe(5)
		end)
	end)

	T.describe("Sessions", function()
		T.it("lets the newest server take over a locked save and stops the old one from writing", function()
			local backend = Runtime.newBackend()
			local a = Runtime.new(PLACE, { backend = backend, jobId = "server-A" })
			a:start()
			local pa = a:join(401)
			Clients.intent(a, pa, "onboarding", { action = "start" })
			local b = Runtime.new(PLACE, { backend = backend, jobId = "server-B" })
			b:start()
			-- Server B waits for A's lock, then takes it over.
			local pb = b:join(401)
			b:advance(40)
			T.expect(backend.stores.Players.u401.lock.jobId).toBe("server-B")
			T.expect(b:service("DataService").saveOf(pb) ~= nil).toBeTruthy()
			-- A's next autosave finds the lock gone: it writes nothing and removes the player.
			local before = serde.encode("json", backend.stores.Players.u401.data)
			a:advance(61)
			T.expect(pa.kicked ~= nil).toBeTruthy()
			T.expect(serde.encode("json", backend.stores.Players.u401.data)).toBe(before)
		end)
	end)

	T.describe("Safety", function()
		T.it("relays only preset phrases, records reports, and hides nothing it should not", function()
			local rt = Runtime.new(PLACE)
			rt:start()
			local a, b = rt:join(501), rt:join(502)
			rt:fire(a, "QuickChat", "phrase", "qp_hello")
			T.expect(b.inbox.QuickChat[1][3]).toBe("qp_hello")
			rt:fire(a, "QuickChat", "phrase", "you are bad")
			rt:advance(2)
			rt:fire(a, "QuickChat", "phrase", "custom_text")
			T.expect(#b.inbox.QuickChat).toBe(1)
			local report = rt:invoke(b, "Social", "report", { userId = 501, reason = "report_griefing" })
			T.expect(report.ok).toBeTruthy()
			local count = 0
			for _ in rt.backend.stores.Reports do
				count += 1
			end
			T.expect(count).toBe(1)
			T.expect(rt:invoke(b, "Social", "block", { userId = 501 }).ok).toBeTruthy()
			T.expect(rt:state(b).social.blocked[1]).toBe(501)
		end)

		T.it("exports and deletes a player's data on request", function()
			local rt = Runtime.new(PLACE)
			rt:start()
			local p = rt:join(601)
			local export = rt:invoke(p, "Account", "export")
			T.expect(export.ok).toBeTruthy()
			T.expect(serde.decode("json", export.data).save.userId).toBe(601)
			local code = rt:invoke(p, "Account", "requestDelete").data.code
			T.expect(rt:invoke(p, "Account", "confirmDelete", { code = "wrong" }).ok).toBeFalsy()
			code = rt:invoke(p, "Account", "requestDelete").data.code
			T.expect(rt:invoke(p, "Account", "confirmDelete", { code = code }).ok).toBeTruthy()
			T.expect(p.kicked ~= nil).toBeTruthy()
			rt:advance(1)
			T.expect(rt.backend.stores.Players.u601).toBe(nil)
		end)

		T.it("rate limits intent spam and flags malformed requests", function()
			local rt = Runtime.new(PLACE)
			rt:start()
			local p = rt:join(701)
			local slowed = 0
			for _ = 1, 40 do
				local r = Clients.intent(rt, p, "collectWorkers")
				if r.err == "slow_down" then
					slowed += 1
				end
			end
			T.expect(slowed).toBeAtLeast(1)
			rt:advance(5)
			local bad = rt:invoke(p, "Intent", { type = "plant", args = { plot = 0 / 0 } }, 999)
			T.expect(bad.ok).toBeFalsy()
			-- A replayed sequence number is ignored (retry after a dropped reply).
			local dup = rt:invoke(p, "Intent", { type = "sellAll" }, 999)
			T.expect(dup.duplicate).toBeTruthy()
		end)

		T.it("applies a live config push without a restart, and rejects a bad one", function()
			local rt = Runtime.new(PLACE)
			rt:start()
			local p = rt:join(801)
			rt.backend.stores.LiveConfig = { overrides = { economy = { eggPriceSilver = 50 } } }
			rt:run(function()
				rt.services.MessagingService:PublishAsync("tidebound-config", "reload")
			end)
			rt:advance(12)
			T.expect(rt:service("ConfigService").get().economy.eggPriceSilver).toBe(50)
			rt.backend.stores.LiveConfig = { overrides = { catalog = { harborPass = { paidTrack = { { tier = 1, silver = 999 } } } } } }
			rt:run(function()
				rt.services.MessagingService:PublishAsync("tidebound-config", "reload")
			end)
			rt:advance(12)
			T.expect(rt:service("ConfigService").get().economy.eggPriceSilver).toBe(50)
			T.expect(rt:service("ConfigService").get().catalog.harborPass.paidTrack[1].silver).toBe(nil)
			rt:assertNoErrors()
			T.expect(p ~= nil).toBeTruthy()
		end)
	end)
end
