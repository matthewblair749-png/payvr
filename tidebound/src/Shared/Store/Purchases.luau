--[[
	Purchase rules shared by the Roblox receipt handler and the tests.

	Flow on Roblox:
	  1. Client asks to buy a catalog product. Server runs canBuy, then prompts the Roblox purchase.
	  2. Roblox charges and calls ProcessReceipt with a unique PurchaseId.
	  3. Server calls grant(), which is idempotent on PurchaseId, saves, and only then returns PurchaseGranted.
	  4. Support reversals and chargebacks call reverse(), which undoes exactly what the grant gave.
]]

local Ledger = require(script.Parent.Ledger)
local Crates = require(script.Parent.Crates)
local Pass = require(script.Parent.Pass)
local Spending = require(script.Parent.Spending)

local Purchases = {}

--[[
	Checks whether a player may start buying a product. policy comes from PolicyService.
	Returns nil when allowed, or an error code the UI explains.
]]
function Purchases.canBuy(cfg: any, save: any, product: any, now: number, policy: any?): string?
	if not product then
		return "unknown_product"
	end
	if not save.night.firstCompleted then
		-- No purchase prompt of any kind before the first night is finished.
		return "store_locked"
	end
	if product.kind == "starterPack" and save.entitlements.starterPack then
		return "already_owned"
	end
	if product.kind == "storagePass" and save.entitlements.storagePass then
		return "already_owned"
	end
	if product.kind == "subscription" and save.entitlements.club.active then
		return "already_owned"
	end
	if product.kind == "pass" and Pass.ownsPaid(cfg, save, now) then
		return "already_owned"
	end
	if product.kind == "crate" and policy and policy.ArePaidRandomItemsRestricted then
		return "random_items_restricted"
	end
	if product.robloxType ~= "subscription" then
		local limited = Spending.check(save, product.robux, now)
		if limited then
			return limited
		end
	end
	return nil
end

-- Builds the ledger entries for a paid product. Crates roll here, on the server.
local function entriesFor(cfg: any, save: any, product: any, purchaseId: string, now: number, rng: any): ({ any }, any)
	local kind = product.kind
	if kind == "gems" then
		return { { t = "currency", k = "gems", n = product.gems } }, nil
	elseif kind == "starterPack" then
		local entries = { { t = "ent", k = "starterPack" } }
		local g = product.grants or {}
		if (g.eggs or 0) > 0 then
			table.insert(entries, { t = "eggs", n = g.eggs })
		end
		for _, id in g.cosmetics or {} do
			table.insert(entries, { t = "cosmetic", id = id })
		end
		return entries, nil
	elseif kind == "storagePass" then
		return { { t = "ent", k = "storagePass" } }, nil
	elseif kind == "crate" then
		local result, entries = Crates.roll(cfg, save, product.crateId, rng)
		return entries, result
	elseif kind == "pass" then
		Pass.ensureBlock(cfg, save, now)
		return { { t = "passBlock", block = Pass.blockId(cfg, now), purchaseId = purchaseId } }, nil
	end
	error("product kind " .. tostring(kind) .. " is not granted by receipt")
end

--[[
	Grants a purchase exactly once. Returns a result table:
	  { granted = true, entries, crate?, events } on first processing
	  { granted = false, duplicate = true } when this PurchaseId was already granted
]]
function Purchases.grant(cfg: any, save: any, product: any, purchaseId: string, robuxSpent: number, now: number, rng: any): any
	if save.purchases.processed[purchaseId] then
		return { granted = false, duplicate = true, events = {} }
	end
	local entries, crate = entriesFor(cfg, save, product, purchaseId, now, rng)
	Ledger.apply(save, entries)
	Ledger.record(save, purchaseId, {
		productId = product.id,
		variantId = product.variantId,
		experimentId = product.experimentId,
		robux = robuxSpent,
		at = now,
		entries = entries,
	})
	Spending.record(save, robuxSpent, now)
	local events = {
		{
			name = "purchase_completed",
			props = {
				productId = product.id,
				robux = robuxSpent,
				variantId = product.variantId or "control",
				experimentId = product.experimentId,
				purchaseId = purchaseId,
			},
		},
	}
	if crate then
		table.insert(events, { name = "crate_opened", props = { crateId = crate.crateId, itemId = crate.itemId, rarity = crate.rarity, paid = "robux", pity = crate.pity } })
	end
	return { granted = true, entries = entries, crate = crate, events = events }
end

-- Game passes are owned on Roblox; this mirrors ownership into the save once.
function Purchases.grantGamePass(cfg: any, save: any, product: any, now: number): any
	local purchaseId = "gamepass:" .. product.id
	if save.purchases.processed[purchaseId] then
		return { granted = false, duplicate = true, events = {} }
	end
	return Purchases.grant(cfg, save, product, purchaseId, product.robux, now, nil)
end

function Purchases.reverse(cfg: any, save: any, purchaseId: string, reason: string): any
	local record, err = Ledger.reverse(cfg, save, purchaseId)
	if not record then
		return { reversed = false, reason = err, events = {} }
	end
	return {
		reversed = true,
		record = record,
		events = {
			{ name = "purchase_refunded", props = { productId = record.productId, robux = record.robux, purchaseId = purchaseId, reason = reason, variantId = record.variantId or "control" } },
		},
	}
end

return Purchases
