--[[ Wave sizing and scaling. Enemy count = base + wave * growth + squadSize * 1.5; health +8% per wave (compounding). ]]

local WaveMath = {}

function WaveMath.enemyCount(cfg: any, wave: number, squadSize: number): number
	local n = cfg.night
	return math.floor(n.enemyCountBase + wave * n.enemyCountGrowth + squadSize * n.enemyCountPerSquadMember + 0.5)
end

function WaveMath.healthMultiplier(cfg: any, wave: number): number
	return (1 + cfg.night.enemyHealthGrowthPerWave) ^ (wave - 1)
end

-- Seconds from night start to the start of a wave.
function WaveMath.waveStart(cfg: any, wave: number): number
	local n = cfg.night
	return n.introSeconds + (wave - 1) * (n.waveSeconds + n.breakSeconds)
end

function WaveMath.nightLength(cfg: any, waveCount: number): number
	local n = cfg.night
	return n.introSeconds + waveCount * n.waveSeconds + (waveCount - 1) * n.breakSeconds
end

function WaveMath.bossHp(cfg: any, squadSize: number, wave: number): number
	local b = cfg.night.boss
	return b.baseHp * (1 + b.hpPerSquadMember * (squadSize - 1)) * WaveMath.healthMultiplier(cfg, wave)
end

return WaveMath
