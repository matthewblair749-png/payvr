--[[
	Night rewards. Silver scales with waves survived and each player's share of the squad's contribution
	(damage, repairs, weak points), so supporters who repair earn as fairly as damage dealers.
	A survived night adds the streak bonus (+5% per consecutive night, up to +30%).
	A failed night pays 25% and resets the streak. Nothing is ever taken away.
]]

local Rewards = {}

function Rewards.contributionScore(cfg: any, c: any): number
	local w = cfg.night.rewards.contribution
	return c.damage * w.damagePoint + c.repair * w.repairHpPoint + c.weakPoints * w.weakPointHit
end

function Rewards.streakBonus(cfg: any, streakAfter: number): number
	return math.min(cfg.cycle.streakBonusPerNight * streakAfter, cfg.cycle.streakBonusCap)
end

--[[
	sim: a finished NightSim. streaks: { [userId] = consecutive survived nights before tonight }.
	mods: season and harbor modifiers. Returns { [userId] = reward }.
]]
function Rewards.compute(cfg: any, sim: any, streaks: { [any]: number }, mods: any): { [any]: any }
	local r = cfg.night.rewards
	local result = sim.result
	assert(result, "night has not ended")
	local waves = result.wavesSurvived
	local scores, total, count = {}, 0, 0
	for _, id in sim.playerOrder do
		local s = Rewards.contributionScore(cfg, sim.players[id].contribution)
		scores[id] = s
		total += s
		count += 1
	end
	local mean = if count > 0 then total / count else 0
	local out = {}
	for _, id in sim.playerOrder do
		local share = 1
		if mean > 0 then
			share = math.clamp((1 - r.contributionWeight) + r.contributionWeight * scores[id] / mean, r.minShare, r.maxShare)
		end
		local streakBefore = streaks[id] or 0
		local multiplier, streakAfter, bonus
		if result.survived then
			streakAfter = streakBefore + 1
			bonus = Rewards.streakBonus(cfg, streakAfter)
			multiplier = 1 + bonus
		else
			streakAfter = 0
			bonus = 0
			multiplier = cfg.cycle.failedNightRewardMultiplier
		end
		local silver = r.silverPerWave * waves * share * (1 + (mods.nightSilverPct or 0) / 100)
		local pearls = 0
		if result.bossDefeated then
			silver += r.bossSilver
			pearls = r.bossPearls
		end
		silver *= multiplier
		local materials = {}
		for m, n in r.materialsPerWave do
			materials[m] = math.floor(n * waves * multiplier)
		end
		local smugglerSilver = 0
		if result.smuggler then
			local sm = result.smuggler
			if sm.result == "success" and sm.userId == id then
				smugglerSilver = cfg.night.smuggler.smugglerSuccessSilver
			elseif sm.result == "caught" and table.find(sm.catchers, id) then
				smugglerSilver = cfg.night.smuggler.catchSilver
			end
		end
		local xp = cfg.economy.xpRewards.waveSurvived * waves + (if result.bossDefeated then cfg.economy.xpRewards.bossDefeated else 0)
		out[id] = {
			silver = math.floor(silver) + smugglerSilver,
			pearls = pearls,
			materials = materials,
			passXp = r.passXpPerWave * waves,
			xp = xp,
			share = share,
			contribution = scores[id],
			streakBefore = streakBefore,
			streakAfter = streakAfter,
			streakBonus = bonus,
			survived = result.survived,
			wavesSurvived = waves,
			bossDefeated = result.bossDefeated,
			ironUsed = sim.players[id].ironUsed,
			repairHp = math.floor(sim.players[id].contribution.repair),
		}
	end
	return out
end

--[[
	A player who leaves mid-night keeps per-wave rewards for the waves already finished, at full rate,
	with their streak unchanged (a dropped connection is never punished). No boss reward.
]]
function Rewards.partial(cfg: any, sim: any, userId: any, streakBefore: number, mods: any): any
	local saved = sim.result
	sim.result = { survived = true, wavesSurvived = sim.wavesCompleted, bossDefeated = false }
	local all = Rewards.compute(cfg, sim, { [userId] = 0 }, mods)
	sim.result = saved
	local r = all[userId]
	local base = 1 + Rewards.streakBonus(cfg, 1)
	r.silver = math.floor(r.silver / base)
	for m, n in r.materials do
		r.materials[m] = math.floor(n / base)
	end
	r.streakBefore = streakBefore
	r.streakAfter = streakBefore
	r.streakBonus = 0
	r.survived = false
	r.partial = true
	return r
end

return Rewards
