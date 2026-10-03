--[[
	The shop. Opened only from the small HUD button (or the pass screen). Prices are the live Robux prices
	Roblox will charge; random items show their odds on the card and a full odds table before purchase.
	No timers, no "limited stock", no pop-ups.
]]

local Ui = require(script.Parent.Parent.Ui.Ui)
local Theme = require(script.Parent.Parent.Ui.Theme)
local Format = require(script.Parent.Parent.Ui.Format)

local function price(app: any, product: any): string
	if product.robloxType == "subscription" then
		return app.L("shop_price_subscription", { usd = string.format("%.2f", product.usd) })
	end
	return app.L("shop_price_robux", { robux = Format.int(product.liveRobux or product.robux) })
end

local function bonusPct(product: any, base: any): number
	-- Bonus versus the base bundle, measured per whole dollar (80 Gems per dollar).
	local perDollar = base.gems / math.ceil(base.usd)
	return math.floor((product.gems / (math.ceil(product.usd) * perDollar) - 1) * 100 + 0.5)
end

return {
	title = "panel_shop",
	build = function(app: any, container: Frame)
		local L = app.L
		local s = app.state
		if not s.derived.storeUnlocked then
			Ui.text(container, L("shop_locked"))
			return
		end
		if not app.catalog then
			Ui.text(container, L("loading"))
			task.spawn(function()
				local reply = app:store("catalog")
				if reply.ok then
					app.catalog = reply.data
					app:open("shop")
				end
			end)
			return
		end
		local catalog = app.catalog
		local byId = {}
		for _, p in catalog.products do
			byId[p.id] = p
		end
		Ui.button(container, L("shop_spending"), function()
			app:open("spending")
		end, { Size = UDim2.new(1, 0, 0, 48), BackgroundColor3 = Theme.colors.panelAlt, TextColor3 = Theme.colors.text })

		local function buy(product: any)
			local reply = app:store("buy", { productId = product.id })
			if reply.ok then
				app:toast(L("shop_prompt_opened"))
			end
		end

		local function card(product: any, title: string, body: string, extra: ((Frame) -> ())?)
			app:track("product_viewed", { productId = product.id, variantId = product.variantId or "control" })
			local c = Ui.card(container)
			Ui.text(c, title, { FontFace = Theme.fontBold })
			Ui.text(c, body, { TextSize = 15, TextColor3 = Theme.colors.textDim })
			if extra then
				extra(c)
			end
			Ui.button(c, price(app, product), function()
				buy(product)
			end, { Size = UDim2.new(1, 0, 0, 52) })
			return c
		end

		-- Starter Pack (one per account).
		local starter = byId.starter_pack
		if starter and not s.entitlements.starterPack then
			card(starter, L("starter_pack"), L("starter_pack_body"))
		end

		-- Gem bundles.
		Ui.text(container, L("shop_gems"), { FontFace = Theme.fontBold })
		local base = byId.gems_handful
		for _, p in catalog.products do
			if p.kind == "gems" then
				local bonus = bonusPct(p, base)
				local body = if bonus > 0 then L("shop_gems_bonus", { pct = bonus }) else L("shop_gems_base")
				card(p, L(p.id, { gems = Format.int(p.gems) }), body)
			end
		end

		-- Cosmetic crate with odds on the card.
		local crate = byId.cosmetic_crate
		if crate and not catalog.randomItemsRestricted then
			local odds = catalog.crates[crate.crateId].odds
			card(crate, L("cosmetic_crate"), L("cosmetic_crate_body", { n = odds.epicEvery }), function(c)
				for _, row in odds.rows do
					local r = Ui.row(c, 24)
					Ui.rarity(r, app.cfg, row.rarity, { Size = UDim2.new(0.5, 0, 0, 24), AutomaticSize = Enum.AutomaticSize.None, TextSize = 15 })
					Ui.text(r, Format.pct(row.base), { Size = UDim2.new(0.45, 0, 0, 24), AutomaticSize = Enum.AutomaticSize.None, TextSize = 15 })
				end
				Ui.button(c, L("shop_view_odds"), function()
					app:open("odds", { kind = "crate", crateId = crate.crateId })
				end, { Size = UDim2.new(1, 0, 0, 48), BackgroundColor3 = Theme.colors.panel, TextColor3 = Theme.colors.text })
			end)
		elseif crate then
			Ui.text(container, L("shop_random_restricted"), { TextColor3 = Theme.colors.textDim })
		end

		-- Harbor Pass, Club, Storage Pass.
		local pass = byId.harbor_pass
		if pass and not s.derived.passOwned then
			card(pass, L("harbor_pass"), L("harbor_pass_body"))
		end
		local club = byId.harbor_club
		if club and not s.entitlements.club.active then
			card(club, L("harbor_club"), L("harbor_club_body", { gems = catalog.harborClub.dailyGems, storage = catalog.harborClub.storageBonus }))
		elseif club then
			local c = Ui.card(container)
			Ui.text(c, L("harbor_club_member"), { FontFace = Theme.fontBold })
			Ui.button(c, L("club_claim_daily", { gems = catalog.harborClub.dailyGems }), function()
				app:intent("claimClubDaily")
			end, { Size = UDim2.new(1, 0, 0, 48) })
			Ui.button(c, L("club_claim_monthly"), function()
				app:intent("claimClubMonthly")
			end, { Size = UDim2.new(1, 0, 0, 48) })
		end
		local storage = byId.storage_pass
		if storage and not s.entitlements.storagePass then
			card(storage, L("storage_pass"), L("storage_pass_body"))
		end

		-- Spending Gems: cosmetics and convenience only.
		Ui.text(container, L("shop_gem_items"), { FontFace = Theme.fontBold })
		for _, item in catalog.gemItems do
			if not (item.kind == "crate" and catalog.randomItemsRestricted) then
				local owned = (s.cosmetics[item.id] or 0) > 0
				local c = Ui.card(container)
				Ui.text(c, L(item.id), { FontFace = Theme.fontBold })
				if item.kind == "crate" then
					Ui.button(c, L("shop_view_odds"), function()
						app:open("odds", { kind = "crate", crateId = item.crateId })
					end, { Size = UDim2.new(1, 0, 0, 48), BackgroundColor3 = Theme.colors.panel, TextColor3 = Theme.colors.text })
				end
				Ui.button(c, if owned then L("owned") else L("shop_price_gems", { gems = item.gems }), function()
					if not owned then
						local reply = app:intent("buyGemItem", { item = item.id })
						if reply.ok and reply.data.crate then
							app:toast(L("crate_result", { item = L(reply.data.crate.itemId), rarity = L("rarity_" .. reply.data.crate.rarity) }))
						end
					end
				end, { Size = UDim2.new(1, 0, 0, 48), Active = not owned })
			end
		end
	end,
}
