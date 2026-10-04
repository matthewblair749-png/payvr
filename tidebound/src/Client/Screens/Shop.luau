--[[
	The shop, styled after the concept art: tabs (Featured, Gems, Cosmetics, Passes), a featured Starter Pack
	banner, and tiles with green price buttons. Prices are the live Robux prices Roblox will charge; random
	items show odds on the card and a full odds table before purchase. No timers, no fake scarcity, no pop-ups.
]]

local Ui = require(script.Parent.Parent.Ui.Ui)
local Theme = require(script.Parent.Parent.Ui.Theme)
local Format = require(script.Parent.Parent.Ui.Format)
local Creatures = require(script.Parent.Parent.World.Creatures)

local GEM_ICONS = { gems_handful = "💎", gems_pouch = "💎💎", gems_chest = "🧰", gems_hoard = "💰", gems_vault = "🏦" }

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
	build = function(app: any, container: Frame, args: any)
		local L = app.L
		local s = app.state
		local c = Theme.colors
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
					app:open("shop", args)
				end
			end)
			return
		end
		local catalog = app.catalog
		local byId = {}
		for _, p in catalog.products do
			byId[p.id] = p
		end
		if args and args.focus == "harbor_pass" then
			app.shopTab = "passes"
		end
		app.shopTab = app.shopTab or "featured"

		local function buy(product: any)
			local reply = app:store("buy", { productId = product.id })
			if reply.ok then
				app:toast(L("shop_prompt_opened"))
			end
		end
		local function viewed(product: any)
			app:track("product_viewed", { productId = product.id, variantId = product.variantId or "control" })
		end

		Ui.tabs(container, {
			{ id = "featured", label = L("shop_tab_featured") },
			{ id = "gems", label = L("shop_tab_gems") },
			{ id = "cosmetics", label = L("shop_tab_cosmetics") },
			{ id = "passes", label = L("shop_tab_passes") },
		}, app.shopTab, function(id)
			app.shopTab = id
			app:open("shop")
		end)

		local function tileGrid(): Frame
			local grid = Ui.frame(container, { BackgroundTransparency = 1, Size = UDim2.new(1, 0, 0, 0), AutomaticSize = Enum.AutomaticSize.Y })
			Ui.grid(grid, Vector2.new(160, 190), 10)
			return grid
		end

		local function tile(grid: Instance, icon: string, title: string, sub: string, buttonText: string, onBuy: () -> (), color: Color3?)
			local t = Ui.card(grid, { BackgroundColor3 = c.panelAlt })
			t.AutomaticSize = Enum.AutomaticSize.None
			Ui.text(t, title, { TextSize = 15, TextXAlignment = Enum.TextXAlignment.Center })
			local iconLabel = Ui.text(t, icon, { TextSize = 40, outline = false, FontFace = Theme.fontEmoji, TextXAlignment = Enum.TextXAlignment.Center, Size = UDim2.new(1, 0, 0, 56), AutomaticSize = Enum.AutomaticSize.None })
			iconLabel.TextYAlignment = Enum.TextYAlignment.Center
			Ui.text(t, sub, { TextSize = 12, TextXAlignment = Enum.TextXAlignment.Center, TextColor3 = c.textDim, FontFace = Theme.fontBody })
			Ui.button(t, buttonText, onBuy, { BackgroundColor3 = color or c.good, Size = UDim2.new(1, 0, 0, 40), TextSize = 15 })
			return t
		end

		if app.shopTab == "featured" then
			local starter = byId.starter_pack
			if starter and not s.entitlements.starterPack then
				viewed(starter)
				local banner = Ui.card(container, { BackgroundColor3 = c.accent })
				local inner = Ui.frame(banner, { BackgroundTransparency = 1, Size = UDim2.new(1, 0, 0, 170) })
				Ui.text(inner, L("starter_pack"), { TextSize = 26, FontFace = Theme.fontBold, Size = UDim2.new(0.6, 0, 0, 32), AutomaticSize = Enum.AutomaticSize.None })
				Ui.text(inner, L("starter_pack_body"), { TextSize = 14, FontFace = Theme.fontBody, Size = UDim2.new(0.58, 0, 0, 80), AutomaticSize = Enum.AutomaticSize.None, Position = UDim2.fromOffset(0, 36) })
				local vp = Creatures.viewport(inner, Creatures.drifter(app.cfg, app.cfg.drifters.onboardingSpeciesId), UDim2.new(0.4, 0, 1, 0), true, Theme)
				vp.Position = UDim2.fromScale(0.6, 0)
				Ui.button(inner, price(app, starter), function()
					buy(starter)
				end, { BackgroundColor3 = c.good, Size = UDim2.fromOffset(170, 48), Position = UDim2.new(0, 0, 1, -48), TextSize = 20 })
			end
			local grid = tileGrid()
			local crate = byId.cosmetic_crate
			if crate and not catalog.randomItemsRestricted then
				viewed(crate)
				tile(grid, "🎁", L("cosmetic_crate"), L("shop_crate_short", { n = catalog.crates[crate.crateId].odds.epicEvery }), price(app, crate), function()
					app:open("odds", { kind = "crate", crateId = crate.crateId, buyProductId = crate.id })
				end)
			end
			local pass = byId.harbor_pass
			if pass and not s.derived.passOwned then
				viewed(pass)
				tile(grid, "🎟️", L("harbor_pass"), L("shop_pass_short"), price(app, pass), function()
					buy(pass)
				end)
			end
			local vault = byId.gems_chest
			if vault then
				viewed(vault)
				tile(grid, "🧰", L(vault.id, { gems = Format.int(vault.gems) }), L("shop_gems_bonus", { pct = bonusPct(vault, byId.gems_handful) }), price(app, vault), function()
					buy(vault)
				end)
			end
		elseif app.shopTab == "gems" then
			Ui.text(container, L("shop_gems"), { TextSize = 15, TextColor3 = c.textDim, FontFace = Theme.fontBody })
			local grid = tileGrid()
			local base = byId.gems_handful
			for _, p in catalog.products do
				if p.kind == "gems" then
					viewed(p)
					local bonus = bonusPct(p, base)
					tile(grid, GEM_ICONS[p.id] or "💎", L(p.id, { gems = Format.int(p.gems) }), if bonus > 0 then L("shop_gems_bonus", { pct = bonus }) else L("shop_gems_base"), price(app, p), function()
						buy(p)
					end)
				end
			end
		elseif app.shopTab == "cosmetics" then
			local crate = byId.cosmetic_crate
			if crate and not catalog.randomItemsRestricted then
				viewed(crate)
				local odds = catalog.crates[crate.crateId].odds
				local card = Ui.card(container)
				Ui.text(card, "🎁  " .. L("cosmetic_crate"), { TextSize = 20 })
				Ui.text(card, L("cosmetic_crate_body", { n = odds.epicEvery }), { TextSize = 14, TextColor3 = c.textDim, FontFace = Theme.fontBody })
				for _, row in odds.rows do
					local r = Ui.row(card, 22)
					Ui.rarity(r, app.cfg, row.rarity, { Size = UDim2.new(0.5, 0, 0, 22), AutomaticSize = Enum.AutomaticSize.None, TextSize = 14 })
					Ui.text(r, Format.pct(row.base), { Size = UDim2.new(0.45, 0, 0, 22), AutomaticSize = Enum.AutomaticSize.None, TextSize = 14, TextXAlignment = Enum.TextXAlignment.Right })
				end
				local buttons = Ui.row(card, 48)
				Ui.button(buttons, L("shop_view_odds"), function()
					app:open("odds", { kind = "crate", crateId = crate.crateId })
				end, { BackgroundColor3 = c.panelLight, Size = UDim2.new(0.5, -4, 0, 48), TextSize = 15 })
				Ui.button(buttons, price(app, crate), function()
					buy(crate)
				end, { BackgroundColor3 = c.good, Size = UDim2.new(0.5, -4, 0, 48), TextSize = 17 })
			elseif crate then
				Ui.text(container, L("shop_random_restricted"), { TextColor3 = c.textDim })
			end
			Ui.text(container, L("shop_gem_items"), { TextSize = 15, TextColor3 = c.textDim, FontFace = Theme.fontBody })
			local grid = tileGrid()
			local icons = { deco_ = "🏮", skin_ = "🎩", rodskin_ = "🎣", storage = "📦", gem_crate = "🎁" }
			for _, item in catalog.gemItems do
				if not (item.kind == "crate" and catalog.randomItemsRestricted) then
					local owned = (s.cosmetics[item.id] or 0) > 0
					local icon = icons[item.id] or icons[string.match(item.id, "^%a+_") or ""] or (if item.kind == "storage" then "📦" else "✨")
					tile(grid, icon, L(item.id), if item.kind == "crate" then L("shop_crate_short", { n = 30 }) else "", if owned then L("owned") else "💎 " .. Format.int(item.gems), function()
						if owned then
							return
						end
						if item.kind == "crate" then
							app:open("odds", { kind = "crate", crateId = item.crateId, buyGemItemId = item.id })
							return
						end
						local reply = app:intent("buyGemItem", { item = item.id })
						if reply.ok then
							app:toast(L("purchase_thanks"))
						end
					end, if owned then c.panelLight else c.purple)
				end
			end
		else
			local grid = tileGrid()
			local pass = byId.harbor_pass
			if pass and not s.derived.passOwned then
				viewed(pass)
				tile(grid, "🎟️", L("harbor_pass"), L("shop_pass_short"), price(app, pass), function()
					buy(pass)
				end)
			end
			local club = byId.harbor_club
			if club and not s.entitlements.club.active then
				viewed(club)
				tile(grid, "⚓", L("harbor_club"), L("shop_club_short", { gems = catalog.harborClub.dailyGems }), price(app, club), function()
					buy(club)
				end)
			end
			local storage = byId.storage_pass
			if storage and not s.entitlements.storagePass then
				viewed(storage)
				tile(grid, "📦", L("storage_pass"), L("shop_storage_short"), price(app, storage), function()
					buy(storage)
				end)
			end
			if s.entitlements.club.active then
				local card = Ui.card(container)
				Ui.text(card, L("harbor_club_member"), { TextSize = 18 })
				Ui.button(card, L("club_claim_daily", { gems = catalog.harborClub.dailyGems }), function()
					app:intent("claimClubDaily")
				end, { Size = UDim2.new(1, 0, 0, 48), BackgroundColor3 = c.good })
				Ui.button(card, L("club_claim_monthly"), function()
					app:intent("claimClubMonthly")
				end, { Size = UDim2.new(1, 0, 0, 48) })
			end
			Ui.text(container, L("harbor_club_body", { gems = catalog.harborClub.dailyGems, storage = catalog.harborClub.storageBonus }), { TextSize = 13, TextColor3 = c.textDim, FontFace = Theme.fontBody })
		end
		Ui.button(container, L("shop_spending"), function()
			app:open("spending")
		end, { Size = UDim2.new(1, 0, 0, 48), BackgroundColor3 = c.panelAlt })
	end,
}
