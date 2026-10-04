-- Prints numbers used in docs/PRICING.md and docs/BALANCE.md, computed from config by the game code.
local Loader = require("../harness/Loader")
Loader.alias("src/Shared/Config", "shared/config")
local Shared = Loader.root("src/Shared")
local cfg = Loader.require(Shared.ConfigLoader).defaults()
local Hatchery = Loader.require(Shared.Rules.Hatchery)
local Crates = Loader.require(Shared.Store.Crates)
local Catalog = Loader.require(Shared.Store.Catalog)
local Progression = Loader.require(Shared.Rules.Progression)
local Drifters = Loader.require(Shared.Rules.Drifters)
print("HATCH")
for _, r in Hatchery.odds(cfg).rows do
	print(("%s base %.2f%% overall %.2f%%"):format(r.rarity, r.base * 100, r.overall * 100))
end
print("CRATE")
local o = Crates.odds(cfg, "crate_tidecomb")
for _, r in o.rows do
	print(("%s base %.2f%% overall %.2f%%"):format(r.rarity, r.base * 100, r.overall * 100))
end
for k, v in o.classes do
	print(("class %s %.2f%%"):format(k, v * 100))
end
for id, v in o.items do
	print(("item %s %.3f%%"):format(id, v * 100))
end
print("PRICES")
for _, p in cfg.catalog.products do
	local v = Catalog.product(cfg, p.id, 1)
	print(p.id, v.usd, v.robux, v.gems or "")
end
print("LEVELS")
local total = 0
for l = 1, 49 do
	total += Progression.xpToNext(cfg, l)
	if l == 4 or l == 9 or l == 19 or l == 49 then
		print("xp to reach", l + 1, total)
	end
end
print("DRIFTER POWER")
for _, lvl in { 1, 5, 10, 20, 30 } do
	local d = { speciesId = "drf_puddlefin", traitId = "trait_brave", level = lvl, happiness = 70 }
	local l = { speciesId = "drf_maelstrom_koi", traitId = "trait_brave", level = lvl, happiness = 70 }
	print(lvl, math.floor(Drifters.stats(cfg, d).power * 10) / 10, math.floor(Drifters.stats(cfg, l).power * 10) / 10)
end
