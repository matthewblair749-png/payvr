local Loader = require("../harness/Loader")
Loader.alias("src/Shared/Config", "shared/config")
local Shared = Loader.root("src/Shared")
local cfg = Loader.require(Shared.ConfigLoader).defaults()
local NightSim = Loader.require(Shared.Night.NightSim)
local Bot = Loader.require(Shared.Night.Bot)
local process = require("@lune/process")
local power = tonumber(process.args[1]) or 14
local members = {}
local elements = { "tide", "ember", "moss", "frost", "tide" }
local n = tonumber(process.args[2]) or 5
for i = 1, n do
	members[i] = { userId = i, power = power, speed = 10, element = elements[i], repairPct = 0, ironScrap = 40 }
end
local sim = NightSim.new(cfg, { seed = 11, members = members })
local dt = 1 / 20
local lastWave = 0
while not sim.ended do
	for _, id in sim.playerOrder do
		NightSim.setInput(sim, id, Bot.input(sim, id, (n == 5 and (id == 5 and "repair" or (id <= 3 and "boss" or nil))) or nil))
	end
	NightSim.step(sim, dt)
	for _, e in sim.events do
		if e.name == "wave_ended" or e.name == "boss_phase" or e.name == "boss_stunned" or e.name == "boss_defeated" or e.name == "weak_points_reset" then
			local s = sim.structures
			print(("t=%.1f %s wave=%d lh=%d sw=%d dk=%d enemies=%d boss=%s"):format(sim.t, e.name, sim.wave, s.lighthouse.hp, s.seawall.hp, s.dock.hp, #sim.enemies, sim.boss and tostring(math.floor(sim.boss.hp)) or "-"))
		end
	end
	sim.events = {}
end
print("result", sim.result.survived, sim.result.wavesSurvived, sim.result.bossDefeated)
