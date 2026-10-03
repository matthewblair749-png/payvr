--[[
	Every grant is a list of ledger entries stored under the purchase id that caused it.
	Reversing a purchase (refund, chargeback, or support reversal) applies the inverse entries.
	Nothing the player earned by playing is touched. If a reversed currency was already spent,
	the shortfall becomes debt that future grants of that currency pay off first.

	Entry kinds:
	  { t = "currency", k = "gems" | "silver" | "pearls", n = amount }
	  { t = "material", k = "driftwood" | "shells" | "ironScrap", n = amount }
	  { t = "cosmetic", id = cosmeticId }
	  { t = "ent", k = "starterPack" | "storagePass" }
	  { t = "eggs", n = count }
	  { t = "gemStorage", n = slots }
	  { t = "passBlock", block = blockId }
]]

local Ledger = {}

local MAX_RECORDS = 300

-- Adds currency, paying off debt first. Returns the amount that reached the balance.
function Ledger.addCurrency(save: any, key: string, n: number): number
	local debt = save.debt[key] or 0
	if debt > 0 then
		local pay = math.min(debt, n)
		save.debt[key] = debt - pay
		n -= pay
	end
	save.currencies[key] += n
	return n
end

function Ledger.addCosmetic(save: any, id: string)
	save.cosmetics[id] = (save.cosmetics[id] or 0) + 1
end

function Ledger.apply(save: any, entries: { any })
	for _, e in entries do
		if e.t == "currency" then
			Ledger.addCurrency(save, e.k, e.n)
		elseif e.t == "material" then
			save.materials[e.k] += e.n
		elseif e.t == "cosmetic" then
			Ledger.addCosmetic(save, e.id)
		elseif e.t == "ent" then
			save.entitlements[e.k] = true
		elseif e.t == "eggs" then
			save.hatch.eggs += e.n
		elseif e.t == "gemStorage" then
			save.entitlements.gemStorage += e.n
		elseif e.t == "passBlock" then
			save.pass.paid[tostring(e.block)] = e.purchaseId or true
		else
			error("unknown ledger entry " .. tostring(e.t))
		end
	end
end

local function unequip(save: any, id: string)
	if save.equipped.rodSkin == id then
		save.equipped.rodSkin = nil
	end
	local decorations = save.equipped.decorations
	local i = table.find(decorations, id)
	if i then
		table.remove(decorations, i)
	end
	for _, d in save.drifters do
		if d.skinId == id then
			d.skinId = nil
		end
	end
end

function Ledger.reverseEntries(cfg: any, save: any, entries: { any })
	for i = #entries, 1, -1 do
		local e = entries[i]
		if e.t == "currency" then
			local take = math.min(save.currencies[e.k], e.n)
			save.currencies[e.k] -= take
			if e.k ~= "pearls" then
				save.debt[e.k] = (save.debt[e.k] or 0) + (e.n - take)
			end
		elseif e.t == "material" then
			save.materials[e.k] = math.max(0, save.materials[e.k] - e.n)
		elseif e.t == "cosmetic" then
			local count = (save.cosmetics[e.id] or 0) - 1
			if count <= 0 then
				save.cosmetics[e.id] = nil
				unequip(save, e.id)
			else
				save.cosmetics[e.id] = count
			end
		elseif e.t == "ent" then
			save.entitlements[e.k] = false
		elseif e.t == "eggs" then
			local take = math.min(save.hatch.eggs, e.n)
			save.hatch.eggs -= take
			-- Eggs already hatched stay hatched (no Drifter is ever removed); their Silver value becomes debt.
			save.debt.silver += (e.n - take) * cfg.economy.eggPriceSilver
		elseif e.t == "gemStorage" then
			save.entitlements.gemStorage = math.max(0, save.entitlements.gemStorage - e.n)
		elseif e.t == "passBlock" then
			save.pass.paid[tostring(e.block)] = nil
		end
	end
end

function Ledger.record(save: any, purchaseId: string, record: any)
	local p = save.purchases
	p.ledger[purchaseId] = record
	p.processed[purchaseId] = true
	table.insert(p.order, purchaseId)
	-- Keep the save small: forget the oldest records but keep their ids as processed.
	while #p.order > MAX_RECORDS do
		local old = table.remove(p.order, 1)
		p.ledger[old] = nil
	end
end

-- Adds follow-up entries (for example paid pass rewards) to an existing purchase record.
function Ledger.attach(save: any, purchaseId: string, entries: { any })
	local record = save.purchases.ledger[purchaseId]
	if record then
		for _, e in entries do
			table.insert(record.entries, e)
		end
	end
end

-- Returns the reversed record, or nil plus a reason.
function Ledger.reverse(cfg: any, save: any, purchaseId: string): (any, string?)
	local record = save.purchases.ledger[purchaseId]
	if not record then
		return nil, if save.purchases.processed[purchaseId] then "record_expired" else "unknown_purchase"
	end
	if record.reversed then
		return nil, "already_reversed"
	end
	Ledger.reverseEntries(cfg, save, record.entries)
	record.reversed = true
	return record, nil
end

return Ledger
