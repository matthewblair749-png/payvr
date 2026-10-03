--[[
	Builds the live game config from the default JSON sections (shared/config, baked into the place by Rojo)
	plus optional remote overrides (JSON Merge Patches published by the companion backend).

	If an override produces an invalid config, the loader keeps the defaults and reports why,
	so a bad remote push can never break running servers.
]]

local Tbl = require(script.Parent.Util.Tbl)
local Hash = require(script.Parent.Util.Hash)
local ConfigValidator = require(script.Parent.ConfigValidator)

local ConfigLoader = {}

ConfigLoader.SECTIONS = { "cycle", "day", "economy", "drifters", "night", "harbor", "catalog", "compliance" }

function ConfigLoader.defaultSections(): { [string]: any }
	local folder = script.Parent.Config
	local sections = {}
	for _, name in ConfigLoader.SECTIONS do
		sections[name] = Tbl.deepCopy(require(folder[name]))
	end
	return sections
end

-- Stable text form for hashing (keys sorted).
local function canonical(value: any): string
	local t = type(value)
	if t == "table" then
		if value[1] ~= nil or next(value) == nil then
			local parts = {}
			for _, v in value do
				table.insert(parts, canonical(v))
			end
			return "[" .. table.concat(parts, ",") .. "]"
		end
		local parts = {}
		for _, k in Tbl.sortedKeys(value) do
			table.insert(parts, k .. ":" .. canonical(value[k]))
		end
		return "{" .. table.concat(parts, ",") .. "}"
	end
	return tostring(value)
end

-- Adds lookup tables so rules never scan lists in hot paths.
local function index(cfg: any)
	local ix = {}
	ix.fish = {}
	for _, f in cfg.day.fishing.fish do
		ix.fish[f.id] = f
	end
	ix.fish[cfg.day.fishing.onboardingFish.id] = cfg.day.fishing.onboardingFish
	ix.rodsByTier = {}
	for _, r in cfg.day.fishing.rods do
		ix.rodsByTier[r.tier] = r
	end
	ix.crops = {}
	for _, c in cfg.day.farming.crops do
		ix.crops[c.id] = c
	end
	ix.nodes = {}
	for _, n in cfg.day.foraging.nodes do
		ix.nodes[n.id] = n
	end
	ix.species = {}
	ix.speciesByRarity = {}
	for _, s in cfg.drifters.species do
		ix.species[s.id] = s
		ix.speciesByRarity[s.rarity] = ix.speciesByRarity[s.rarity] or {}
		table.insert(ix.speciesByRarity[s.rarity], s)
	end
	ix.traits = {}
	for _, t in cfg.drifters.traits do
		ix.traits[t.id] = t
	end
	ix.rarities = {}
	for _, r in cfg.drifters.rarities do
		ix.rarities[r.id] = r
	end
	ix.products = {}
	for _, p in cfg.catalog.products do
		ix.products[p.id] = p
	end
	ix.gemItems = {}
	for _, g in cfg.catalog.gemItems do
		ix.gemItems[g.id] = g
	end
	ix.crates = {}
	for _, c in cfg.catalog.crates do
		ix.crates[c.id] = c
	end
	ix.enemies = {}
	for _, e in cfg.night.enemies do
		ix.enemies[e.id] = e
	end
	ix.structures = {}
	for _, s in cfg.night.structures do
		ix.structures[s.id] = s
	end
	ix.buildings = {}
	for _, b in cfg.harbor.buildings do
		ix.buildings[b.id] = b
	end
	ix.quests = {}
	for _, q in cfg.harbor.quests.pool do
		ix.quests[q.id] = q
	end
	ix.quests[cfg.harbor.quests.weekly.id] = cfg.harbor.quests.weekly
	cfg.index = ix
	return cfg
end

-- Returns (config, errors). On invalid overrides the defaults are returned along with the errors.
function ConfigLoader.build(sections: { [string]: any }, overrides: { [string]: any }?): (any, { string })
	local merged = {}
	for _, name in ConfigLoader.SECTIONS do
		assert(sections[name], "missing config section " .. name)
		local value = Tbl.deepCopy(sections[name])
		if overrides and overrides[name] ~= nil then
			value = Tbl.mergePatch(value, overrides[name])
		end
		merged[name] = value
	end

	local errors = ConfigValidator.validate(merged)
	if #errors > 0 then
		if overrides then
			local fallback = ConfigLoader.build(sections, nil)
			return fallback, errors
		end
		error("default config is invalid:\n  " .. table.concat(errors, "\n  "))
	end

	merged.version = string.format("%08x", Hash.fnv1a(canonical(merged)))
	return index(merged), errors
end

function ConfigLoader.defaults(): any
	return (ConfigLoader.build(ConfigLoader.defaultSections(), nil))
end

return ConfigLoader
