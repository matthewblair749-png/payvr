--[[ Shoreline forage nodes that respawn on a timer. ]]

local Foraging = {}

function Foraging.readyAt(cfg: any, save: any, nodeId: string): number
	local last = save.forage[nodeId]
	if not last then
		return 0
	end
	return last + cfg.day.foraging.respawnSeconds
end

-- Returns (material, amount) or (nil, errorCode).
function Foraging.harvest(cfg: any, save: any, nodeId: string, now: number, rng: any, mods: any): (string?, any)
	local node = cfg.index.nodes[nodeId]
	if not node then
		return nil, "unknown_node"
	end
	if now < Foraging.readyAt(cfg, save, nodeId) then
		return nil, "not_ready"
	end
	local amount = rng:nextInteger(node.yieldMin, node.yieldMax)
	amount = math.floor(amount * (1 + (mods.forageYieldPct or 0) / 100) + 0.5)
	save.forage[nodeId] = now
	save.materials[node.material] += amount
	return node.material, amount
end

return Foraging
