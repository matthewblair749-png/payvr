--[[
	Authoritative night simulation for one squad's sector (1 to 5 players).
	A Roblox server runs one of these per squad, so squads can never affect each other.

	Coordinates are sector-local: x runs 0..width along the shore, y runs from land (0) to sea (height).
	Enemies come in from the sea and attack structures; players cannot be damaged, only stunned
	and pushed back by the boss's telegraphed attacks. Attacks never hit other players.

	Per tick the host:
	  1. calls setPosition for each player from their character (or setInput with a move vector in tests),
	  2. calls setInput with the latest buttons,
	  3. calls step(sim, dt),
	  4. reads snapshot(sim, viewerId) and drains sim.events for effects and analytics.
]]

local Rng = require(script.Parent.Parent.Util.Rng)
local WaveMath = require(script.Parent.WaveMath)

local NightSim = {}

local ENEMY_TYPES = { "crawler", "brute", "spitter" }
local STRUCTURE_ORDER = { "lighthouse", "seawall", "dock" }

local function dist(ax: number, ay: number, bx: number, by: number): number
	local dx, dy = ax - bx, ay - by
	return math.sqrt(dx * dx + dy * dy)
end

local function emit(sim: any, name: string, data: any)
	data.name = name
	data.t = sim.t
	table.insert(sim.events, data)
end

--[[
	opts = {
	  seed: number,
	  members: { { userId, power, speed, element?, repairPct, ironScrap, smugglerOptIn } },
	  onboarding: boolean?,
	  mods: { lighthouseHpPct, seawallHpPct, repairPct }?,
	}
]]
function NightSim.new(cfg: any, opts: any): any
	local n = cfg.night
	local onboarding = opts.onboarding == true
	local mods = opts.mods or {}
	local waveCount = if onboarding then n.onboardingNight.waveCount else n.waveCount
	local bossWave = nil
	if n.boss.enabled and (not onboarding or n.onboardingNight.boss) then
		bossWave = math.min(n.boss.wave, waveCount)
	end
	local sim = {
		cfg = cfg,
		rng = Rng.new(opts.seed or 1),
		t = 0,
		phase = "intro",
		wave = 0,
		waveCount = waveCount,
		bossWave = bossWave,
		onboarding = onboarding,
		length = WaveMath.nightLength(cfg, waveCount),
		healthScale = if onboarding then n.onboardingNight.enemyHealthMultiplier else 1,
		countScale = if onboarding then n.onboardingNight.enemyCountMultiplier else 1,
		mods = mods,
		structures = {},
		enemies = {},
		nextEnemyId = 1,
		spawnQueue = {},
		players = {},
		playerOrder = {},
		boss = nil,
		smuggler = nil,
		telegraphs = {},
		events = {},
		wavesCompleted = 0,
		ended = false,
		result = nil,
		waveElement = nil,
		elementOffset = 0,
	}
	sim.elementOffset = sim.rng:nextInteger(0, 3)
	for _, s in n.structures do
		local hpPct = 0
		if s.id == "lighthouse" then
			hpPct = mods.lighthouseHpPct or 0
		elseif s.id == "seawall" then
			hpPct = mods.seawallHpPct or 0
		end
		local maxHp = s.maxHp * (1 + hpPct / 100)
		sim.structures[s.id] = { id = s.id, hp = maxHp, maxHp = maxHp, x = s.x, y = s.y, radius = s.radius, losesNight = s.losesNight }
	end
	for i, m in opts.members do
		NightSim.addPlayer(sim, m, i)
	end
	NightSim.setupSmuggler(sim, opts.members)
	return sim
end

function NightSim.addPlayer(sim: any, m: any, slot: number?)
	local n = sim.cfg.night
	local count = #sim.playerOrder
	local x = n.sector.width * ((slot or (count + 1)) / (math.max(count + 1, 2) + 1))
	sim.players[m.userId] = {
		userId = m.userId,
		x = x,
		y = 8,
		facingX = 0,
		facingY = 1,
		power = m.power,
		speed = n.player.moveSpeed * (1 + n.player.speedPerSpeedPoint * (m.speed or 0)),
		element = m.element,
		repairPct = m.repairPct or 0,
		ironScrap = m.ironScrap or 0,
		ironUsed = 0,
		attackReadyAt = 0,
		abilityReadyAt = 0,
		chargeStartedAt = nil,
		stunnedUntil = -1,
		repairReadyAt = 0,
		input = {},
		lastAttack = false,
		lastAbility = false,
		lastCharge = false,
		contribution = { damage = 0, repair = 0, weakPoints = 0 },
		inspect = nil,
		inspectedWave = -1,
		connected = true,
	}
	table.insert(sim.playerOrder, m.userId)
end

function NightSim.removePlayer(sim: any, userId: any)
	local p = sim.players[userId]
	if p then
		-- Keep the record so the player still gets rewards for what they did.
		p.connected = false
		p.input = {}
	end
end

function NightSim.squadSize(sim: any): number
	local count = 0
	for _, id in sim.playerOrder do
		if sim.players[id].connected then
			count += 1
		end
	end
	return math.max(1, count)
end

-- ---------------------------------------------------------------- smuggler

function NightSim.setupSmuggler(sim: any, members: { any })
	local s = sim.cfg.night.smuggler
	if not s.enabled or sim.onboarding then
		return
	end
	local optIns = {}
	for _, m in members do
		if m.smugglerOptIn then
			table.insert(optIns, m.userId)
		end
	end
	if #optIns < s.minOptIns then
		return
	end
	local w = sim.cfg.night.sector.width
	local maxY = sim.cfg.night.sector.playerMaxY
	local crates = {}
	for i = 1, s.crates do
		crates[i] = { x = sim.rng:nextNumber() * (w - 4) + 2, y = sim.rng:nextNumber() * (maxY - 10) + 6, state = "ground" }
	end
	local corners = { { 1, 3 }, { w - 1, 3 }, { 1, maxY - 1 }, { w - 1, maxY - 1 } }
	local boat = corners[sim.rng:nextInteger(1, #corners)]
	sim.smuggler = {
		userId = optIns[sim.rng:nextInteger(1, #optIns)],
		crates = crates,
		carrying = nil,
		delivered = 0,
		boat = { x = boat[1], y = boat[2] },
		deadline = sim.cfg.night.introSeconds + s.timeLimitSeconds,
		result = nil,
		catchers = {},
	}
	emit(sim, "smuggler_chosen", { userId = sim.smuggler.userId })
end

local function stepSmuggler(sim: any)
	local sm = sim.smuggler
	if not sm or sm.result then
		return
	end
	local cfgS = sim.cfg.night.smuggler
	local p = sim.players[sm.userId]
	if sim.t > sm.deadline or not p or not p.connected then
		sm.result = "timeout"
		emit(sim, "smuggler_timeout", {})
		return
	end
	if sm.carrying == nil then
		for i, c in sm.crates do
			if c.state == "ground" and dist(p.x, p.y, c.x, c.y) <= cfgS.pickupRange then
				c.state = "carried"
				sm.carrying = i
				break
			end
		end
	elseif dist(p.x, p.y, sm.boat.x, sm.boat.y) <= cfgS.deliverRange then
		sm.crates[sm.carrying].state = "delivered"
		sm.carrying = nil
		sm.delivered += 1
		if sm.delivered >= #sm.crates then
			sm.result = "success"
			emit(sim, "smuggler_success", { userId = sm.userId })
		end
	end
end

-- Inspections: once per wave per player, a 2 second channel that breaks if the target walks away.
local function stepInspections(sim: any)
	local cfgS = sim.cfg.night.smuggler
	for _, id in sim.playerOrder do
		local p = sim.players[id]
		local target = p.input.inspect
		if p.inspect == nil and target ~= nil and target ~= id and sim.players[target] and p.inspectedWave ~= sim.wave and sim.t >= p.stunnedUntil then
			local tp = sim.players[target]
			if dist(p.x, p.y, tp.x, tp.y) <= cfgS.inspectRange then
				p.inspect = { target = target, startedAt = sim.t }
				p.inspectedWave = sim.wave
				emit(sim, "inspect_started", { userId = id, target = target })
			end
		end
		if p.inspect then
			local tp = sim.players[p.inspect.target]
			if not tp or dist(p.x, p.y, tp.x, tp.y) > cfgS.inspectBreakRange or sim.t < p.stunnedUntil then
				emit(sim, "inspect_broken", { userId = id })
				p.inspect = nil
			elseif sim.t - p.inspect.startedAt >= cfgS.inspectChannelSeconds then
				local sm = sim.smuggler
				local caught = sm ~= nil and sm.result == nil and sm.userId == p.inspect.target and sm.carrying ~= nil
				if caught then
					sm.result = "caught"
					table.insert(sm.catchers, id)
					emit(sim, "smuggler_caught", { userId = id, smuggler = sm.userId })
				else
					emit(sim, "inspect_clear", { userId = id, target = p.inspect.target })
				end
				p.inspect = nil
			end
		end
	end
end

-- ---------------------------------------------------------------- waves and enemies

local function startWave(sim: any, wave: number)
	local n = sim.cfg.night
	sim.wave = wave
	sim.phase = "wave"
	sim.phaseEndsAt = WaveMath.waveStart(sim.cfg, wave) + n.waveSeconds
	sim.waveElement = sim.cfg.drifters.elements[((wave + sim.elementOffset) % #sim.cfg.drifters.elements) + 1]
	local squad = NightSim.squadSize(sim)
	local count = math.max(1, math.floor(WaveMath.enemyCount(sim.cfg, wave, squad) * sim.countScale + 0.5))
	local weights, order = {}, {}
	for _, id in ENEMY_TYPES do
		local e = sim.cfg.index.enemies[id]
		if e.firstWave <= wave then
			weights[id] = e.spawnShare
			table.insert(order, id)
		end
	end
	for i = 1, count do
		local typeId = Rng.pickWeighted(sim.rng, order, weights)
		local at = sim.t + (n.spawnSpreadSeconds * (i - 1) / math.max(1, count - 1))
		table.insert(sim.spawnQueue, { at = at, type = typeId })
	end
	if sim.bossWave == wave then
		local b = n.boss
		local hp = WaveMath.bossHp(sim.cfg, squad, wave) * sim.healthScale
		sim.boss = {
			hp = hp,
			maxHp = hp,
			x = b.x,
			y = b.y,
			phase = 1,
			shielded = false,
			weakPoints = {},
			windowEndsAt = nil,
			retryAt = nil,
			stunnedUntil = -1,
			nextTelegraphAt = sim.t + b.telegraphIntervalSeconds[1],
			defeated = false,
		}
		emit(sim, "boss_spawned", { hp = hp })
	end
	emit(sim, "wave_started", { wave = wave, element = sim.waveElement, count = count })
end

local function spawnEnemy(sim: any, typeId: string)
	local n = sim.cfg.night
	local e = sim.cfg.index.enemies[typeId]
	local hp = e.hp * WaveMath.healthMultiplier(sim.cfg, sim.wave) * sim.healthScale
	local enemy = {
		id = sim.nextEnemyId,
		type = typeId,
		hp = hp,
		maxHp = hp,
		x = sim.rng:nextNumber() * (n.sector.width - 4) + 2,
		y = n.sector.spawnY,
		element = sim.waveElement,
		attackReadyAt = 0,
		slowUntil = -1,
		slowPct = 0,
	}
	sim.nextEnemyId += 1
	table.insert(sim.enemies, enemy)
end

-- Picks the structure an enemy goes for. While the seawall stands, nothing reaches the lighthouse.
local function targetFor(sim: any, enemy: any): any
	local e = sim.cfg.index.enemies[enemy.type]
	local seawall = sim.structures.seawall
	for _, id in e.targets do
		local s = sim.structures[id]
		if s and s.hp > 0 then
			if id == "lighthouse" and seawall.hp > 0 then
				return seawall
			end
			return s
		end
	end
	return sim.structures.lighthouse
end

-- Point an enemy walks to and the distance at which it can hit the structure.
local function approachPoint(enemy: any, s: any): (number, number, number)
	if s.id == "seawall" then
		return enemy.x, s.y, math.abs(enemy.y - s.y)
	end
	return s.x, s.y, math.max(0, dist(enemy.x, enemy.y, s.x, s.y) - s.radius)
end

local function damageStructure(sim: any, s: any, amount: number)
	if s.hp <= 0 then
		return
	end
	local before = NightSim.damageStage(sim, s)
	s.hp = math.max(0, s.hp - amount)
	local after = NightSim.damageStage(sim, s)
	if after ~= before then
		emit(sim, "structure_stage", { structure = s.id, stage = after })
	end
end

local function stepEnemies(sim: any, dt: number)
	local seawallY = sim.cfg.night.sector.seawallY
	for _, enemy in sim.enemies do
		if enemy.hp > 0 then
			local e = sim.cfg.index.enemies[enemy.type]
			local s = targetFor(sim, enemy)
			local tx, ty, gap = approachPoint(enemy, s)
			if gap <= e.range then
				if sim.t >= enemy.attackReadyAt then
					enemy.attackReadyAt = sim.t + e.attackInterval
					damageStructure(sim, s, e.damage)
				end
			else
				local speed = e.speed
				if sim.t < enemy.slowUntil then
					speed *= 1 - enemy.slowPct / 100
				end
				local d = dist(enemy.x, enemy.y, tx, ty)
				local stepLen = math.min(d - math.min(e.range, d) * 0.9, speed * dt)
				if d > 0 and stepLen > 0 then
					enemy.x += (tx - enemy.x) / d * stepLen
					enemy.y += (ty - enemy.y) / d * stepLen
				end
				-- The standing seawall blocks the way inland.
				if sim.structures.seawall.hp > 0 and enemy.y < seawallY then
					enemy.y = seawallY
				end
			end
		end
	end
end

-- ---------------------------------------------------------------- player actions

local function elementMult(sim: any, attacker: string?, defender: string?): number
	if not attacker or not defender then
		return 1
	end
	local d = sim.cfg.drifters
	if d.elementBeats[attacker] == defender then
		return d.advantageMultiplier
	elseif d.elementBeats[defender] == attacker then
		return d.disadvantageMultiplier
	end
	return 1
end

local function hitEnemy(sim: any, p: any, enemy: any, amount: number)
	if enemy.hp <= 0 then
		return
	end
	local dealt = math.min(enemy.hp, amount * elementMult(sim, p.element, enemy.element))
	enemy.hp -= dealt
	p.contribution.damage += dealt
	if enemy.hp <= 0 then
		emit(sim, "enemy_defeated", { id = enemy.id, by = p.userId, type = enemy.type })
	end
end

local function hitBoss(sim: any, p: any, amount: number)
	local boss = sim.boss
	if not boss or boss.defeated then
		return
	end
	local b = sim.cfg.night.boss
	local mult = 1
	if boss.shielded then
		mult = b.shieldDamageTaken
	elseif sim.t < boss.stunnedUntil then
		mult = b.stunnedDamageTaken
	end
	local dealt = math.min(boss.hp, amount * mult)
	boss.hp -= dealt
	p.contribution.damage += dealt
	if boss.hp <= 0 then
		boss.defeated = true
		boss.hp = 0
		sim.telegraphs = {}
		emit(sim, "boss_defeated", {})
		return
	end
	-- Entering a new phase raises the shield and exposes one weak point per squad member.
	local frac = boss.hp / boss.maxHp
	local newPhase = 1
	if frac <= b.phaseThresholds[2] then
		newPhase = 3
	elseif frac <= b.phaseThresholds[1] then
		newPhase = 2
	end
	if newPhase > boss.phase then
		boss.phase = newPhase
		NightSim.exposeWeakPoints(sim)
		emit(sim, "boss_phase", { phase = newPhase })
	end
end

function NightSim.exposeWeakPoints(sim: any)
	local boss = sim.boss
	local b = sim.cfg.night.boss
	boss.shielded = true
	boss.windowEndsAt = nil
	boss.retryAt = nil
	boss.weakPoints = {}
	local count = NightSim.squadSize(sim)
	for i = 1, count do
		-- Spread along the boss's shore side so each player can reach a different point.
		local angle = math.pi * (i / (count + 1))
		table.insert(boss.weakPoints, {
			x = boss.x - math.cos(angle) * (b.radius + 1.5),
			y = boss.y - math.sin(angle) * (b.radius + 0.5),
			hitBy = nil,
		})
	end
	emit(sim, "weak_points", { count = count })
end

local function tryWeakPoint(sim: any, p: any): boolean
	local boss = sim.boss
	if not boss or not boss.shielded or boss.defeated then
		return false
	end
	if boss.retryAt and sim.t < boss.retryAt then
		return false
	end
	local b = sim.cfg.night.boss
	for _, wp in boss.weakPoints do
		if wp.hitBy == p.userId then
			return false
		end
	end
	for _, wp in boss.weakPoints do
		if wp.hitBy == nil and dist(p.x, p.y, wp.x, wp.y) <= b.weakPointHitRange then
			wp.hitBy = p.userId
			boss.windowEndsAt = boss.windowEndsAt or (sim.t + b.weakPointWindowSeconds)
			p.contribution.weakPoints += 1
			emit(sim, "weak_point_hit", { userId = p.userId })
			local all = true
			for _, other in boss.weakPoints do
				all = all and other.hitBy ~= nil
			end
			if all then
				boss.shielded = false
				boss.weakPoints = {}
				boss.windowEndsAt = nil
				boss.stunnedUntil = sim.t + b.stunSeconds
				emit(sim, "boss_stunned", { seconds = b.stunSeconds })
			end
			return true
		end
	end
	return false
end

local function attack(sim: any, p: any)
	local pc = sim.cfg.night.player
	if tryWeakPoint(sim, p) then
		return
	end
	local cosHalf = math.cos(math.rad(pc.attackArcDegrees / 2))
	for _, enemy in sim.enemies do
		if enemy.hp > 0 then
			local dx, dy = enemy.x - p.x, enemy.y - p.y
			local d = math.sqrt(dx * dx + dy * dy)
			if d <= pc.attackRange then
				local facing = d < 0.01 or (dx * p.facingX + dy * p.facingY) / d >= cosHalf
				if facing then
					hitEnemy(sim, p, enemy, p.power)
				end
			end
		end
	end
	local boss = sim.boss
	if boss and not boss.defeated and dist(p.x, p.y, boss.x, boss.y) <= pc.attackRange + sim.cfg.night.boss.radius then
		hitBoss(sim, p, p.power)
	end
end

local function areaDamage(sim: any, p: any, radius: number, amount: number)
	for _, enemy in sim.enemies do
		if enemy.hp > 0 and dist(p.x, p.y, enemy.x, enemy.y) <= radius then
			hitEnemy(sim, p, enemy, amount)
		end
	end
	local boss = sim.boss
	if boss and not boss.defeated and dist(p.x, p.y, boss.x, boss.y) <= radius + sim.cfg.night.boss.radius then
		hitBoss(sim, p, amount)
	end
end

local function ability(sim: any, p: any)
	local element = p.element or "tide"
	local a = sim.cfg.night.abilities[element]
	areaDamage(sim, p, a.radius, p.power * a.damageMultiplier)
	for _, enemy in sim.enemies do
		if enemy.hp > 0 and dist(p.x, p.y, enemy.x, enemy.y) <= a.radius then
			if a.knockback > 0 then
				enemy.y = math.min(sim.cfg.night.sector.spawnY, enemy.y + a.knockback)
			end
			if a.slowPct > 0 then
				enemy.slowPct = a.slowPct
				enemy.slowUntil = sim.t + a.slowSeconds
			end
		end
	end
	if a.healStructure > 0 then
		local best, bestD = nil, math.huge
		for _, id in STRUCTURE_ORDER do
			local s = sim.structures[id]
			local d = dist(p.x, p.y, s.x, s.y)
			if s.hp > 0 and s.hp < s.maxHp and d < bestD then
				best, bestD = s, d
			end
		end
		if best then
			local healed = math.min(best.maxHp - best.hp, a.healStructure)
			best.hp += healed
			p.contribution.repair += healed
		end
	end
	emit(sim, "ability", { userId = p.userId, element = element })
end

local function repair(sim: any, p: any, structureId: string)
	local r = sim.cfg.night.repair
	local s = sim.structures[structureId]
	if not s or s.hp >= s.maxHp or (s.losesNight and s.hp <= 0) then
		return
	end
	if sim.t < p.repairReadyAt or p.ironScrap < r.ironScrapPerInterval then
		return
	end
	local gap
	if s.id == "seawall" then
		gap = math.abs(p.y - s.y)
	else
		gap = math.max(0, dist(p.x, p.y, s.x, s.y) - s.radius)
	end
	if gap > r.range then
		return
	end
	p.repairReadyAt = sim.t + r.intervalSeconds
	p.ironScrap -= r.ironScrapPerInterval
	p.ironUsed += r.ironScrapPerInterval
	local amount = r.hpPerInterval * (1 + (p.repairPct + (sim.mods.repairPct or 0)) / 100)
	local before = NightSim.damageStage(sim, s)
	local healed = math.min(s.maxHp - s.hp, amount)
	s.hp += healed
	p.contribution.repair += healed
	if NightSim.damageStage(sim, s) ~= before then
		emit(sim, "structure_stage", { structure = s.id, stage = NightSim.damageStage(sim, s) })
	end
end

local function stepPlayers(sim: any, dt: number)
	local pc = sim.cfg.night.player
	local sector = sim.cfg.night.sector
	for _, id in sim.playerOrder do
		local p = sim.players[id]
		local input = p.input
		local stunned = sim.t < p.stunnedUntil
		if input.moveX or input.moveY then
			local mx, my = input.moveX or 0, input.moveY or 0
			local len = math.sqrt(mx * mx + my * my)
			if len > 1 then
				mx, my = mx / len, my / len
			end
			if not stunned and len > 0.01 then
				p.x = math.clamp(p.x + mx * p.speed * dt, 0, sector.width)
				p.y = math.clamp(p.y + my * p.speed * dt, 0, sector.playerMaxY)
				p.facingX, p.facingY = mx / math.max(len, 1e-6), my / math.max(len, 1e-6)
			end
		end
		if input.aimX and input.aimY then
			local len = math.sqrt(input.aimX ^ 2 + input.aimY ^ 2)
			if len > 0.01 then
				p.facingX, p.facingY = input.aimX / len, input.aimY / len
			end
		end
		if not stunned and p.connected then
			if input.attack and not p.lastAttack and sim.t >= p.attackReadyAt then
				p.attackReadyAt = sim.t + pc.attackCooldown
				attack(sim, p)
			end
			if input.charge and not p.lastCharge then
				p.chargeStartedAt = sim.t
			elseif not input.charge and p.lastCharge and p.chargeStartedAt then
				if sim.t - p.chargeStartedAt >= pc.chargeSeconds then
					areaDamage(sim, p, pc.chargedRadius, p.power * pc.chargedMultiplier)
					emit(sim, "charged_attack", { userId = p.userId })
				end
				p.chargeStartedAt = nil
			end
			if input.ability and not p.lastAbility and sim.t >= p.abilityReadyAt then
				p.abilityReadyAt = sim.t + pc.abilityCooldown
				ability(sim, p)
			end
			if input.repair then
				repair(sim, p, input.repair)
			end
		else
			p.chargeStartedAt = nil
		end
		p.lastAttack = input.attack == true
		p.lastAbility = input.ability == true
		p.lastCharge = input.charge == true
	end
end

-- ---------------------------------------------------------------- boss

local function stepBoss(sim: any)
	local boss = sim.boss
	if not boss or boss.defeated then
		return
	end
	local b = sim.cfg.night.boss
	if boss.shielded and boss.windowEndsAt and sim.t > boss.windowEndsAt then
		for _, wp in boss.weakPoints do
			wp.hitBy = nil
		end
		boss.windowEndsAt = nil
		boss.retryAt = sim.t + b.weakPointRetrySeconds
		emit(sim, "weak_points_reset", {})
	end
	if boss.shielded and #boss.weakPoints ~= NightSim.squadSize(sim) and boss.windowEndsAt == nil then
		-- Someone left or joined: re-expose for the current squad size.
		NightSim.exposeWeakPoints(sim)
	end
	if sim.t >= boss.stunnedUntil and sim.t >= boss.nextTelegraphAt then
		boss.nextTelegraphAt = sim.t + b.telegraphIntervalSeconds[boss.phase]
		local count = b.telegraphCount[boss.phase]
		for i = 1, count do
			local tx, ty
			local connected = {}
			for _, id in sim.playerOrder do
				if sim.players[id].connected then
					table.insert(connected, sim.players[id])
				end
			end
			if i % 2 == 1 and #connected > 0 then
				local target = connected[sim.rng:nextInteger(1, #connected)]
				tx, ty = target.x, target.y
			else
				local s = sim.structures[STRUCTURE_ORDER[sim.rng:nextInteger(1, 3)]]
				tx, ty = s.x + sim.rng:nextNumber() * 4 - 2, s.y
			end
			table.insert(sim.telegraphs, { x = tx, y = ty, radius = b.telegraphRadius, hitsAt = sim.t + b.telegraphWarningSeconds })
		end
		emit(sim, "telegraph", { count = count })
	end
	local remaining = {}
	for _, tg in sim.telegraphs do
		if sim.t >= tg.hitsAt then
			for _, id in sim.playerOrder do
				local p = sim.players[id]
				if dist(p.x, p.y, tg.x, tg.y) <= tg.radius then
					p.stunnedUntil = sim.t + sim.cfg.night.player.stunSeconds
					local d = math.max(0.01, dist(p.x, p.y, tg.x, tg.y))
					p.x = math.clamp(p.x + (p.x - tg.x) / d * sim.cfg.night.player.knockback, 0, sim.cfg.night.sector.width)
					p.y = math.clamp(p.y + (p.y - tg.y) / d * sim.cfg.night.player.knockback, 0, sim.cfg.night.sector.playerMaxY)
					emit(sim, "player_stunned", { userId = id })
				end
			end
			for _, sid in STRUCTURE_ORDER do
				local s = sim.structures[sid]
				local gap = if sid == "seawall" then math.abs(tg.y - s.y) else math.max(0, dist(tg.x, tg.y, s.x, s.y) - s.radius)
				if gap <= tg.radius then
					damageStructure(sim, s, b.telegraphStructureDamage)
				end
			end
		else
			table.insert(remaining, tg)
		end
	end
	sim.telegraphs = remaining
end

-- ---------------------------------------------------------------- main loop

local function finish(sim: any, survived: boolean)
	sim.ended = true
	sim.phase = "ended"
	sim.enemies = {}
	sim.spawnQueue = {}
	sim.telegraphs = {}
	sim.result = {
		survived = survived,
		wavesSurvived = sim.wavesCompleted,
		waveCount = sim.waveCount,
		bossDefeated = sim.boss ~= nil and sim.boss.defeated == true,
		onboarding = sim.onboarding,
		smuggler = sim.smuggler and { userId = sim.smuggler.userId, result = sim.smuggler.result or "timeout", catchers = sim.smuggler.catchers } or nil,
	}
	emit(sim, if survived then "night_survived" else "night_failed", { waves = sim.wavesCompleted })
end

local function endWave(sim: any)
	sim.wavesCompleted = sim.wave
	-- The tide recedes and takes the remaining enemies with it.
	sim.enemies = {}
	sim.spawnQueue = {}
	emit(sim, "wave_ended", { wave = sim.wave })
	if sim.boss and sim.bossWave == sim.wave then
		sim.telegraphs = {}
	end
	if sim.wave >= sim.waveCount then
		finish(sim, true)
	else
		sim.phase = "break"
		sim.phaseEndsAt = WaveMath.waveStart(sim.cfg, sim.wave + 1)
	end
end

function NightSim.step(sim: any, dt: number)
	if sim.ended then
		return
	end
	sim.t += dt
	if sim.phase == "intro" and sim.t >= sim.cfg.night.introSeconds then
		startWave(sim, 1)
	elseif sim.phase == "break" and sim.t >= sim.phaseEndsAt then
		startWave(sim, sim.wave + 1)
	end
	if sim.phase == "wave" then
		local pending = {}
		for _, s in sim.spawnQueue do
			if sim.t >= s.at then
				spawnEnemy(sim, s.type)
			else
				table.insert(pending, s)
			end
		end
		sim.spawnQueue = pending
	end
	stepPlayers(sim, dt)
	if sim.phase == "wave" then
		stepEnemies(sim, dt)
		stepBoss(sim)
	end
	stepInspections(sim)
	stepSmuggler(sim)
	-- Drop defeated enemies.
	local alive = {}
	for _, e in sim.enemies do
		if e.hp > 0 then
			table.insert(alive, e)
		end
	end
	sim.enemies = alive
	if sim.structures.lighthouse.hp <= 0 then
		finish(sim, false)
		return
	end
	if sim.phase == "wave" then
		local bossDone = sim.bossWave ~= sim.wave or (sim.boss and sim.boss.defeated)
		if sim.t >= sim.phaseEndsAt or (bossDone and sim.bossWave == sim.wave and #sim.enemies == 0 and #sim.spawnQueue == 0) then
			endWave(sim)
		end
	end
end

-- ---------------------------------------------------------------- host interface

function NightSim.setInput(sim: any, userId: any, input: any)
	local p = sim.players[userId]
	if p and p.connected then
		p.input = input
	end
end

--[[
	Accepts a position from the player's character. Clamped to the sector and to what the player
	could have moved since the last update (with slack for latency), so teleport hacks do nothing.
]]
function NightSim.setPosition(sim: any, userId: any, x: number, y: number, dt: number): boolean
	local p = sim.players[userId]
	if not p or sim.t < p.stunnedUntil then
		return false
	end
	if type(x) ~= "number" or type(y) ~= "number" or x ~= x or y ~= y then
		return false
	end
	local sector = sim.cfg.night.sector
	x = math.clamp(x, 0, sector.width)
	y = math.clamp(y, 0, sector.playerMaxY)
	local maxStep = p.speed * dt * 1.5 + 0.5
	local d = dist(p.x, p.y, x, y)
	local ok = d <= maxStep
	if not ok then
		x = p.x + (x - p.x) / d * maxStep
		y = p.y + (y - p.y) / d * maxStep
	end
	if d > 0.01 then
		p.facingX, p.facingY = (x - p.x) / math.max(d, 1e-6), (y - p.y) / math.max(d, 1e-6)
	end
	p.x, p.y = x, y
	return ok
end

function NightSim.damageStage(sim: any, s: any): number
	if s.hp <= 0 then
		return 3
	end
	local th = sim.cfg.night.damageStageThresholds
	local frac = s.hp / s.maxHp
	if frac > th[1] then
		return 0
	elseif frac > th[2] then
		return 1
	end
	return 2
end

function NightSim.drainEvents(sim: any): { any }
	local events = sim.events
	sim.events = {}
	return events
end

local TYPE_INDEX = { crawler = 1, brute = 2, spitter = 3 }

--[[
	Compact state for one viewer, sent over an UnreliableRemoteEvent at the tick rate.
	Only the Smuggler receives crate and boat positions.
]]
function NightSim.snapshot(sim: any, viewerId: any): any
	local structures = {}
	for i, id in STRUCTURE_ORDER do
		local s = sim.structures[id]
		structures[i] = { math.floor(s.hp + 0.5), math.floor(s.maxHp + 0.5), NightSim.damageStage(sim, s) }
	end
	local enemies = table.create(#sim.enemies)
	for i, e in sim.enemies do
		enemies[i] = { e.id, TYPE_INDEX[e.type], math.floor(e.x * 10) / 10, math.floor(e.y * 10) / 10, math.floor(e.hp / e.maxHp * 100) }
	end
	local players = {}
	for _, id in sim.playerOrder do
		local p = sim.players[id]
		table.insert(players, { id, math.floor(p.x * 10) / 10, math.floor(p.y * 10) / 10, sim.t < p.stunnedUntil, p.inspect ~= nil, math.max(0, p.abilityReadyAt - sim.t), p.ironScrap })
	end
	local boss = nil
	if sim.boss then
		local wps = {}
		for _, wp in sim.boss.weakPoints do
			table.insert(wps, { wp.x, wp.y, wp.hitBy ~= nil })
		end
		boss = {
			math.floor(sim.boss.hp / sim.boss.maxHp * 1000) / 10,
			sim.boss.phase,
			sim.boss.shielded,
			sim.t < sim.boss.stunnedUntil,
			wps,
			sim.boss.windowEndsAt and math.max(0, sim.boss.windowEndsAt - sim.t) or nil,
			sim.boss.defeated,
		}
	end
	local telegraphs = {}
	for _, tg in sim.telegraphs do
		table.insert(telegraphs, { tg.x, tg.y, tg.radius, math.max(0, tg.hitsAt - sim.t) })
	end
	local smuggler = nil
	if sim.smuggler then
		local sm = sim.smuggler
		smuggler = { isMe = sm.userId == viewerId, result = sm.result, delivered = sm.delivered, total = #sm.crates, timeLeft = math.max(0, sm.deadline - sim.t) }
		if sm.userId == viewerId then
			local crates = {}
			for _, c in sm.crates do
				if c.state == "ground" then
					table.insert(crates, { c.x, c.y })
				end
			end
			smuggler.crates = crates
			smuggler.boat = { sm.boat.x, sm.boat.y }
			smuggler.carrying = sm.carrying ~= nil
		end
	end
	local phaseLeft = 0
	if sim.phase == "intro" then
		phaseLeft = sim.cfg.night.introSeconds - sim.t
	elseif sim.phaseEndsAt then
		phaseLeft = math.max(0, sim.phaseEndsAt - sim.t)
	end
	return {
		t = math.floor(sim.t * 100) / 100,
		phase = sim.phase,
		wave = sim.wave,
		waveCount = sim.waveCount,
		phaseLeft = phaseLeft,
		element = sim.waveElement,
		s = structures,
		e = enemies,
		p = players,
		b = boss,
		tg = telegraphs,
		sm = smuggler,
	}
end

return NightSim
