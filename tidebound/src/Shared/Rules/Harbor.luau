--[[
	The shared harbor: five buildings, five tiers each, funded by every player's materials.
	The state lives in one global record (DataStore, updated atomically); this module is the pure math.
]]

local Harbor = {}

function Harbor.newState(cfg: any): any
	local tiers, progress = {}, {}
	for _, b in cfg.harbor.buildings do
		tiers[b.id] = 1
		progress[b.id] = { driftwood = 0, shells = 0, ironScrap = 0 }
	end
	return { tiers = tiers, progress = progress, contributors = 0 }
end

function Harbor.nextCost(cfg: any, state: any, buildingId: string): any
	local tier = state.tiers[buildingId]
	if not tier or tier >= cfg.harbor.maxTier then
		return nil
	end
	return cfg.harbor.tierCosts[tier]
end

-- Validates and removes materials from the player. Returns (contribution) or (nil, errorCode).
function Harbor.takeFromPlayer(cfg: any, save: any, buildingId: string, materials: any): (any, string?)
	if not cfg.index.buildings[buildingId] then
		return nil, "unknown_building"
	end
	if type(materials) ~= "table" then
		return nil, "bad_materials"
	end
	local total = 0
	local clean = {}
	for _, m in { "driftwood", "shells", "ironScrap" } do
		local n = materials[m] or 0
		if type(n) ~= "number" or n < 0 or n % 1 ~= 0 then
			return nil, "bad_materials"
		end
		if n > save.materials[m] then
			return nil, "not_enough_materials"
		end
		clean[m] = n
		total += n
	end
	if total == 0 then
		return nil, "nothing_to_contribute"
	end
	if total > cfg.harbor.maxContributionPerRequest then
		return nil, "too_much_at_once"
	end
	for m, n in clean do
		save.materials[m] -= n
	end
	return { buildingId = buildingId, materials = clean, total = total }, nil
end

--[[
	Adds a contribution to the shared state (inside the atomic update). Materials beyond what the next tier
	needs carry into the tier after. Returns the list of tiers unlocked.
]]
function Harbor.applyContribution(cfg: any, state: any, contribution: any): { any }
	local id = contribution.buildingId
	local unlocked = {}
	local progress = state.progress[id]
	for m, n in contribution.materials do
		progress[m] += n
	end
	while true do
		local cost = Harbor.nextCost(cfg, state, id)
		if not cost then
			break
		end
		if progress.driftwood >= cost.driftwood and progress.shells >= cost.shells and progress.ironScrap >= cost.ironScrap then
			progress.driftwood -= cost.driftwood
			progress.shells -= cost.shells
			progress.ironScrap -= cost.ironScrap
			state.tiers[id] += 1
			table.insert(unlocked, { buildingId = id, tier = state.tiers[id] })
		else
			break
		end
	end
	return unlocked
end

return Harbor
