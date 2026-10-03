--[[ Drifter stats, levels, care, roles, slots, and storage. ]]

local Drifters = {}

function Drifters.rarityOf(cfg: any, drifter: any): string
	return cfg.index.species[drifter.speciesId].rarity
end

function Drifters.elementOf(cfg: any, drifter: any): string
	return cfg.index.species[drifter.speciesId].element
end

-- Damage multiplier for an attacker element hitting a defender element.
function Drifters.elementMultiplier(cfg: any, attacker: string, defender: string): number
	local d = cfg.drifters
	if d.elementBeats[attacker] == defender then
		return d.advantageMultiplier
	elseif d.elementBeats[defender] == attacker then
		return d.disadvantageMultiplier
	end
	return 1
end

function Drifters.happinessMultiplier(cfg: any, happiness: number): number
	local h = cfg.economy.happiness
	return h.outputMinMultiplier + (h.outputMaxMultiplier - h.outputMinMultiplier) * math.clamp(happiness, 0, 100) / 100
end

function Drifters.stats(cfg: any, drifter: any): { power: number, speed: number, income: number }
	local species = cfg.index.species[drifter.speciesId]
	local rarity = cfg.index.rarities[species.rarity]
	local trait = cfg.index.traits[drifter.traitId] or {}
	local growth = 1 + cfg.economy.drifterLevel.statGrowthPerLevel * (drifter.level - 1)
	local m = rarity.statMultiplier * growth
	return {
		power = species.power * m * (1 + (trait.powerPct or 0) / 100),
		speed = species.speed * m * (1 + (trait.speedPct or 0) / 100),
		income = species.income * m * (1 + (trait.incomePct or 0) / 100),
	}
end

function Drifters.xpToNext(cfg: any, level: number): number
	local l = cfg.economy.drifterLevel
	return math.floor(l.xpBase * level ^ l.xpExponent)
end

-- Feeding adds XP and happiness. Returns levels gained.
function Drifters.feed(cfg: any, drifter: any, silverValue: number): number
	local l = cfg.economy.drifterLevel
	local trait = cfg.index.traits[drifter.traitId] or {}
	local xp = math.floor(silverValue * l.feedXpPerSilverValue * (1 + (trait.xpPct or 0) / 100))
	drifter.happiness = math.min(100, drifter.happiness + cfg.economy.happiness.feedGain)
	local gained = 0
	drifter.xp += xp
	while drifter.level < l.maxLevel and drifter.xp >= Drifters.xpToNext(cfg, drifter.level) do
		drifter.xp -= Drifters.xpToNext(cfg, drifter.level)
		drifter.level += 1
		gained += 1
	end
	if drifter.level >= l.maxLevel then
		drifter.xp = 0
	end
	return gained
end

function Drifters.decayHappiness(cfg: any, drifter: any, seconds: number, seasonDecayPct: number)
	local trait = cfg.index.traits[drifter.traitId] or {}
	local rate = cfg.economy.happiness.decayPerHour * (1 + (trait.happinessDecayPct or 0) / 100) * (1 + seasonDecayPct / 100)
	drifter.happiness = math.max(0, drifter.happiness - rate * seconds / 3600)
end

function Drifters.activeSlots(cfg: any, playerLevel: number): number
	local slots = 0
	for _, u in cfg.economy.activeSlotUnlocks do
		if playerLevel >= u.level then
			slots = u.slots
		end
	end
	return math.min(slots, cfg.drifters.maxActiveSlots)
end

-- Paid storage only gets a player to the same cap that silver upgrades reach.
function Drifters.storageCapacity(cfg: any, save: any): number
	local s = cfg.economy.storage
	local ent = save.entitlements
	local paid = ent.gemStorage
	if ent.storagePass then
		local pass = cfg.index.products.storage_pass
		paid += pass and pass.grants and pass.grants.storageBonus or 0
	end
	if ent.club.active then
		paid += cfg.catalog.harborClub.storageBonus
	end
	return math.min(s.cap, s.base + s.upgradeAmount * save.storageUpgrades + paid)
end

function Drifters.find(save: any, drifterId: string): any
	for _, d in save.drifters do
		if d.id == drifterId then
			return d
		end
	end
	return nil
end

function Drifters.activeCount(save: any): number
	local n = 0
	for _, d in save.drifters do
		if d.active then
			n += 1
		end
	end
	return n
end

function Drifters.create(cfg: any, save: any, speciesId: string, traitId: string, now: number): any
	local drifter = {
		id = "d" .. save.nextDrifterNum,
		speciesId = speciesId,
		traitId = traitId,
		level = 1,
		xp = 0,
		happiness = cfg.economy.happiness.start,
		role = "worker",
		active = false,
		lastRoleSwitchCycle = -1,
		skinId = nil,
		hatchedAt = now,
	}
	save.nextDrifterNum += 1
	table.insert(save.drifters, drifter)
	save.collection[speciesId] = true
	-- New drifters fill free active slots so a first hatch is useful right away.
	if Drifters.activeCount(save) < Drifters.activeSlots(cfg, save.progress.level) then
		drifter.active = true
	end
	return drifter
end

-- Returns nil on success or an error code.
function Drifters.setRole(cfg: any, save: any, drifterId: string, role: string, cycleIndex: number): string?
	if role ~= "worker" and role ~= "guardian" then
		return "bad_role"
	end
	local d = Drifters.find(save, drifterId)
	if not d then
		return "not_owned"
	end
	if d.role == role then
		return nil
	end
	if cfg.cycle.roleSwitchesPerCycle <= 0 then
		return "role_locked"
	end
	if d.lastRoleSwitchCycle == cycleIndex then
		return "role_switch_cooldown"
	end
	d.role = role
	d.lastRoleSwitchCycle = cycleIndex
	return nil
end

function Drifters.setActive(cfg: any, save: any, drifterId: string, active: boolean): string?
	local d = Drifters.find(save, drifterId)
	if not d then
		return "not_owned"
	end
	if active and not d.active and Drifters.activeCount(save) >= Drifters.activeSlots(cfg, save.progress.level) then
		return "no_free_slot"
	end
	d.active = active
	return nil
end

-- Total worker income in Silver per minute.
function Drifters.workerIncomePerMinute(cfg: any, save: any): number
	local total = 0
	for _, d in save.drifters do
		if d.active and d.role == "worker" then
			total += Drifters.stats(cfg, d).income * Drifters.happinessMultiplier(cfg, d.happiness)
		end
	end
	return total * cfg.economy.worker.silverPerIncomePointPerMinute
end

--[[
	Night combat profile: the strongest active Guardian leads (its element sets the damage matchup),
	other active Guardians add a share of their power. Free players and payers use the same formula;
	the only bonus is catch-up power for new players.
]]
function Drifters.guardianProfile(cfg: any, save: any): { power: number, speed: number, element: string?, repairPct: number }
	local p = cfg.night.player
	local lead, leadStats
	local others = 0
	local repairPct = 0
	for _, d in save.drifters do
		if d.active and d.role == "guardian" then
			local s = Drifters.stats(cfg, d)
			s.power *= Drifters.happinessMultiplier(cfg, d.happiness)
			if not lead or s.power > leadStats.power then
				if lead then
					others += leadStats.power
				end
				lead, leadStats = d, s
			else
				others += s.power
			end
			local trait = cfg.index.traits[d.traitId] or {}
			repairPct = math.max(repairPct, trait.repairPct or 0)
		end
	end
	local power = p.basePower
	local speed = 0
	local element = nil
	if lead then
		power = math.max(p.basePower, leadStats.power) + others * p.supportGuardianShare
		speed = leadStats.speed
		element = Drifters.elementOf(cfg, lead)
	end
	local catchUp = cfg.economy.catchUp
	if save.progress.playSeconds < catchUp.underTotalHours * 3600 then
		power *= 1 + catchUp.nightPowerBonus
	end
	return { power = power, speed = speed, element = element, repairPct = repairPct }
end

return Drifters
