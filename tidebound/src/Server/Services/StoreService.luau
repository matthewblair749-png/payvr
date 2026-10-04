--[[
	Store: Developer Products (Gems, crates, Harbor Pass), Game Passes (Starter Pack, Storage Pass)
	and the Harbor Club subscription.

	Roblox charges the player and validates the payment; ProcessReceipt is our server-side receipt check.
	A grant is applied exactly once per PurchaseId, saved, written to the audit log, and only then
	confirmed to Roblox. If the save fails the grant is rolled back and Roblox retries later.
	Game pass ownership and subscription status are re-read from Roblox on every join, so a revoked pass
	(refund or chargeback) reverses its grant automatically. Developer Product reversals come from support
	through the companion backend.
]]

local MarketplaceService = game:GetService("MarketplaceService")
local MessagingService = game:GetService("MessagingService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Catalog = require(Shared.Store.Catalog)
local Purchases = require(Shared.Store.Purchases)
local Spending = require(Shared.Store.Spending)
local Market = require(Shared.Rules.Market)
local Club = require(Shared.Store.Club)
local Hatchery = require(Shared.Rules.Hatchery)
local Rng = require(Shared.Util.Rng)
local RateLimiter = require(Shared.Util.RateLimiter)
local Validate = require(Shared.Util.Validate)

local Stores = require(script.Parent.Stores)
local ConfigService = require(script.Parent.ConfigService)
local DataService = require(script.Parent.DataService)
local PlayerService = require(script.Parent.PlayerService)
local Analytics = require(script.Parent.Analytics)
local Remotes = require(script.Parent.Remotes)
local Logger = require(script.Parent.Logger)

local StoreService = {}

local AUDIT_STORE = "PurchaseAudit"
local PENDING_STORE = "PendingReversals"
local REVERSE_TOPIC = "tidebound-reverse"
local PRICE_CACHE_SECONDS = 600
local SAVE_ATTEMPTS = 3

local rng = Rng.fromRandom(Random.new())
local promptLimiter = nil
local audit = nil
local pending = nil
local priceCache: { [string]: any } = {}

local function writeAudit(purchaseId: string, record: any)
	task.spawn(function()
		local ok, err = pcall(audit.SetAsync, audit, purchaseId, record)
		if not ok then
			Logger.error("audit_write_failed", { purchaseId = purchaseId, error = tostring(err) })
		end
	end)
end

-- Live Robux price from Roblox: what the player will actually be charged.
local function livePrice(robloxType: string, robloxId: any): number?
	if robloxType == "subscription" or not robloxId or robloxId == 0 then
		return nil
	end
	local cacheKey = robloxType .. ":" .. tostring(robloxId)
	local cached = priceCache[cacheKey]
	if cached and os.clock() - cached.at < PRICE_CACHE_SECONDS then
		return cached.robux
	end
	local infoType = if robloxType == "gamePass" then Enum.InfoType.GamePass else Enum.InfoType.Product
	local ok, info = pcall(MarketplaceService.GetProductInfo, MarketplaceService, robloxId, infoType)
	local robux = ok and info and info.PriceInRobux or nil
	priceCache[cacheKey] = { robux = robux, at = os.clock() }
	return robux
end

-- Logs any product whose Roblox price differs from the price config expects.
local function checkPrices()
	local cfg = ConfigService.get()
	for _, p in cfg.catalog.products do
		local live = livePrice(p.robloxType, p.robloxId)
		local expected = Catalog.robux(cfg, p.priceTier)
		if live and live ~= expected then
			Logger.warn("price_mismatch", { productId = p.id, configRobux = expected, robloxRobux = live })
		end
	end
end

local function saveWithRetry(player: Player): boolean
	for _ = 1, SAVE_ATTEMPTS do
		if DataService.saveNow(player) then
			return true
		end
		task.wait(1)
	end
	return false
end

local function afterGrant(player: Player, save: any, product: any, result: any, purchaseId: string, robux: number)
	writeAudit(purchaseId, {
		userId = player.UserId,
		productId = product.id,
		variantId = product.variantId or "control",
		experimentId = product.experimentId,
		robux = robux,
		at = os.time(),
		status = "granted",
		crate = result.crate and result.crate.itemId or nil,
	})
	Analytics.trackAll(player, result.events)
	if product.kind == "gems" then
		Analytics.economy(player, true, "Gems", product.gems, save.currencies.gems, Enum.AnalyticsEconomyTransactionType.IAP, product.id)
	end
	PlayerService.notice(player, "purchase_granted", { productId = product.id, crate = result.crate })
	PlayerService.pushState(player)
end

local function processReceipt(receipt: any): Enum.ProductPurchaseDecision
	local player = Players:GetPlayerByUserId(receipt.PlayerId)
	local save = player and DataService.saveOf(player)
	if not player or not save then
		-- Roblox retries when the player is back in a server.
		return Enum.ProductPurchaseDecision.NotProcessedYet
	end
	local cfg = ConfigService.get()
	local product = Catalog.fromRobloxId(cfg, "developerProduct", receipt.ProductId)
	if not product then
		Logger.error("receipt_unknown_product", { userId = player.UserId, productId = receipt.ProductId, purchaseId = receipt.PurchaseId })
		return Enum.ProductPurchaseDecision.NotProcessedYet
	end
	local purchaseId = tostring(receipt.PurchaseId)
	local result = Purchases.grant(cfg, save, product, purchaseId, receipt.CurrencySpent, PlayerService.now(), rng)
	if result.duplicate then
		return Enum.ProductPurchaseDecision.PurchaseGranted
	end
	if not saveWithRetry(player) then
		Purchases.rollback(cfg, save, purchaseId)
		Logger.error("receipt_save_failed", { userId = player.UserId, purchaseId = purchaseId })
		return Enum.ProductPurchaseDecision.NotProcessedYet
	end
	afterGrant(player, save, product, result, purchaseId, receipt.CurrencySpent)
	return Enum.ProductPurchaseDecision.PurchaseGranted
end

-- Mirrors game pass ownership into the save, and reverses passes Roblox no longer reports as owned.
local function syncGamePasses(player: Player)
	local save = DataService.saveOf(player)
	if not save then
		return
	end
	local cfg = ConfigService.get()
	for _, p in cfg.catalog.products do
		if p.robloxType == "gamePass" then
			local view = Catalog.product(cfg, p.id, player.UserId)
			local ids = Catalog.robloxIds(cfg, "gamePass")
			local owned = false
			for _, id in ids do
				local candidate = Catalog.fromRobloxId(cfg, "gamePass", id)
				if candidate and candidate.id == p.id then
					local ok, has = pcall(MarketplaceService.UserOwnsGamePassAsync, MarketplaceService, player.UserId, id)
					if ok and has then
						owned = true
						view = candidate
					end
				end
			end
			local purchaseId = "gamepass:" .. p.id
			local mirrored = save.purchases.processed[purchaseId] and save.purchases.ledger[purchaseId] and not save.purchases.ledger[purchaseId].reversed
			if owned and not mirrored then
				if save.purchases.ledger[purchaseId] then
					-- Bought again after a reversal: forget the old record so it can be granted fresh.
					save.purchases.ledger[purchaseId] = nil
					save.purchases.processed[purchaseId] = nil
				end
				local result = Purchases.grantGamePass(cfg, save, view, PlayerService.now())
				if result.granted and saveWithRetry(player) then
					afterGrant(player, save, view, result, purchaseId, view.robux)
				end
			elseif not owned and mirrored and view.robloxId ~= 0 then
				local reversed = Purchases.reverse(cfg, save, purchaseId, "pass_revoked")
				if reversed.reversed then
					Analytics.trackAll(player, reversed.events)
					writeAudit(purchaseId .. ":" .. player.UserId, { userId = player.UserId, productId = p.id, status = "reversed", at = os.time() })
				end
			end
		end
	end
end

local function syncSubscription(player: Player)
	local save = DataService.saveOf(player)
	if not save then
		return
	end
	local cfg = ConfigService.get()
	local club = cfg.index.products.harbor_club
	if not club or club.robloxId == 0 then
		return
	end
	local ok, status = pcall(MarketplaceService.GetUserSubscriptionStatusAsync, MarketplaceService, player, club.robloxId)
	if not ok or not status then
		return
	end
	local event = Club.applyStatus(save, status.IsSubscribed == true, status.IsRenewing == true, PlayerService.now())
	if event then
		Analytics.track(player, event, { productId = "harbor_club" })
	end
	PlayerService.pushState(player)
end

local function applyReversal(player: Player, purchaseId: string, reason: string)
	local save = DataService.saveOf(player)
	if not save then
		return false
	end
	local result = Purchases.reverse(ConfigService.get(), save, purchaseId, reason)
	if result.reversed then
		Analytics.trackAll(player, result.events)
		writeAudit(purchaseId, { userId = player.UserId, productId = result.record.productId, robux = result.record.robux, status = "reversed", reason = reason, at = os.time() })
		DataService.saveNow(player)
		PlayerService.pushState(player)
	else
		Logger.warn("reversal_skipped", { userId = player.UserId, purchaseId = purchaseId, reason = result.reason })
	end
	return true
end

-- Reversals queued by support while the player was offline.
local function applyPendingReversals(player: Player)
	local key = "u" .. player.UserId
	local ok, list = pcall(pending.GetAsync, pending, key)
	if not ok or type(list) ~= "table" or #list == 0 then
		return
	end
	for _, item in list do
		if type(item) == "table" and type(item.purchaseId) == "string" then
			applyReversal(player, item.purchaseId, tostring(item.reason or "support"))
		end
	end
	pcall(pending.RemoveAsync, pending, key)
end

local function onStore(player: Player, action: any, args: any): any
	local cfg = ConfigService.get()
	local save = DataService.saveOf(player)
	if not save then
		return { ok = false, err = "not_loaded" }
	end
	local session = PlayerService.session(player)
	local policy = session and session.policy or nil
	if action == "catalog" then
		local view = Catalog.clientView(cfg, player.UserId)
		for _, p in view.products do
			p.liveRobux = livePrice(p.robloxType, p.robloxId)
		end
		view.hatchOdds = Hatchery.odds(cfg)
		view.randomItemsRestricted = policy == nil or policy.ArePaidRandomItemsRestricted == true
		view.storeUnlocked = save.night.firstCompleted
		return { ok = true, data = view }
	elseif action == "buy" then
		if type(args) ~= "table" or not Validate.id(args.productId) then
			return { ok = false, err = "bad_args" }
		end
		if not promptLimiter:allow(player, os.clock()) then
			return { ok = false, err = "slow_down" }
		end
		local product = Catalog.product(cfg, args.productId, player.UserId)
		local err = Purchases.canBuy(cfg, save, product, PlayerService.now(), policy)
		if err then
			Analytics.track(player, "purchase_failed", { productId = args.productId, reason = err })
			return { ok = false, err = err }
		end
		if product.robloxId == 0 then
			return { ok = false, err = "not_configured" }
		end
		Analytics.track(player, "purchase_started", { productId = product.id, variantId = product.variantId or "control", robux = product.robux })
		if product.robloxType == "developerProduct" then
			MarketplaceService:PromptProductPurchase(player, product.robloxId)
		elseif product.robloxType == "gamePass" then
			MarketplaceService:PromptGamePassPurchase(player, product.robloxId)
		elseif product.robloxType == "subscription" then
			MarketplaceService:PromptSubscriptionPurchase(player, product.robloxId)
		end
		return { ok = true }
	elseif action == "config" then
		-- Clients merge these overrides onto their baked-in defaults, so they show exactly what the server uses.
		return { ok = true, data = { version = cfg.version, overrides = ConfigService.overrides() } }
	elseif action == "spending" then
		return { ok = true, data = Spending.summary(save, PlayerService.now()) }
	elseif action == "adDouble" then
		-- Rewarded ad placement (config flag, off by default): double one market sale per day.
		local err = Market.canDoubleWithAd(cfg, save, PlayerService.now(), policy ~= nil and policy.AreAdsAllowed == true)
		if err then
			return { ok = false, err = err }
		end
		local AdService = game:GetService("AdService")
		local okAd, completed = pcall(function()
			local reward = AdService:CreateAdRewardFromDevProductId(cfg.catalog.rewardedAds.robloxRewardProductId)
			return AdService:ShowRewardedVideoAdAsync(player, reward) == Enum.ShowAdResult.ShowCompleted
		end)
		if not okAd or not completed then
			return { ok = false, err = "ads_not_allowed" }
		end
		local result = PlayerService.apply(player, { type = "adDoubleSale" })
		PlayerService.pushState(player)
		return { ok = result.ok, err = result.err, data = result.data }
	elseif action == "starterOfferShown" then
		if save.night.firstCompleted and not save.flags.starterOfferShown then
			save.flags.starterOfferShown = true
			Analytics.track(player, "starter_offer_shown", {})
		end
		return { ok = true }
	end
	return { ok = false, err = "unknown_action" }
end

function StoreService.init()
	audit = Stores.get(AUDIT_STORE)
	pending = Stores.get(PENDING_STORE)
	promptLimiter = RateLimiter.new(ConfigService.get().compliance.rateLimits.purchasePromptsPerMinute / 60, 3)
	MarketplaceService.ProcessReceipt = processReceipt
	Remotes.get("Store").OnServerInvoke = onStore

	MarketplaceService.PromptGamePassPurchaseFinished:Connect(function(player, gamePassId, purchased)
		if purchased then
			syncGamePasses(player)
		else
			local view = Catalog.fromRobloxId(ConfigService.get(), "gamePass", gamePassId)
			Analytics.track(player, "purchase_failed", { productId = view and view.id or tostring(gamePassId), reason = "cancelled" })
		end
	end)
	MarketplaceService.PromptProductPurchaseFinished:Connect(function(userId, productId, purchased)
		if not purchased then
			local player = Players:GetPlayerByUserId(userId)
			local view = Catalog.fromRobloxId(ConfigService.get(), "developerProduct", productId)
			if player then
				Analytics.track(player, "purchase_failed", { productId = view and view.id or tostring(productId), reason = "cancelled" })
			end
		end
	end)
	pcall(function()
		Players.UserSubscriptionStatusChanged:Connect(function(player, _subscriptionId)
			syncSubscription(player)
		end)
	end)
	PlayerService.Loaded:Connect(function(player)
		task.spawn(syncGamePasses, player)
		task.spawn(syncSubscription, player)
		task.spawn(applyPendingReversals, player)
	end)
	task.spawn(function()
		pcall(MessagingService.SubscribeAsync, MessagingService, REVERSE_TOPIC, function(message)
			-- Open Cloud publishes strings; decode JSON payloads from the companion backend.
			local data = message.Data
			if type(data) == "string" then
				local ok, decoded = pcall(game:GetService("HttpService").JSONDecode, game:GetService("HttpService"), data)
				data = if ok then decoded else nil
			end
			if type(data) ~= "table" then
				return
			end
			local player = Players:GetPlayerByUserId(tonumber(data.userId) or 0)
			if player and type(data.purchaseId) == "string" then
				applyReversal(player, data.purchaseId, tostring(data.reason or "support"))
			end
		end)
	end)
	task.delay(5, checkPrices)
end

return StoreService
