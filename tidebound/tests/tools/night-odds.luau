-- Survival rate over many seeds: lune run tests/tools/night-odds <power> <squad> [seeds] [overridesJson]
local process = require("@lune/process")
local serde = require("@lune/serde")
local Loader = require("../harness/Loader")
Loader.alias("src/Shared/Config", "shared/config")
local Shared = Loader.root("src/Shared")
local ConfigLoader = Loader.require(Shared.ConfigLoader)
local overrides = process.args[4] and serde.decode("json", process.args[4]) or nil
local cfg = ConfigLoader.build(ConfigLoader.defaultSections(), overrides)
local NightSim = Loader.require(Shared.Night.NightSim)
local Bot = Loader.require(Shared.Night.Bot)
local power, n, seeds = tonumber(process.args[1]) or 11, tonumber(process.args[2]) or 3, tonumber(process.args[3]) or 40
local elements = { "tide", "ember", "moss", "frost", "tide" }
local survived, waves, boss = 0, 0, 0
for seed = 1, seeds do
	local members = {}
	for i = 1, n do
		members[i] = { userId = i, power = power, speed = 10, element = elements[i], repairPct = 0, ironScrap = 30 }
	end
	local sim = NightSim.new(cfg, { seed = seed * 7919, members = members, onboarding = process.args[5] == "tutorial" })
	while not sim.ended do
		for _, id in sim.playerOrder do
			NightSim.setInput(sim, id, Bot.input(sim, id, nil))
		end
		NightSim.step(sim, 1 / 20)
	end
	survived += sim.result.survived and 1 or 0
	waves += sim.result.wavesSurvived
	boss += sim.result.bossDefeated and 1 or 0
end
print(("power %d squad %d: survived %d%%, avg waves %.1f, boss %d%%"):format(power, n, survived * 100 // seeds, waves / seeds, boss * 100 // seeds))
