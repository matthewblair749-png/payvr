--[[
	Simple squad-mate brain: chase the nearest enemy, hit weak points when the boss is shielded,
	repair the most damaged structure when one is low, and use the ability when enemies cluster.
	Used by tests and by the server's "practice" sector for the tutorial night.
]]

local Bot = {}

local function dist(ax, ay, bx, by)
	return math.sqrt((ax - bx) ^ 2 + (ay - by) ^ 2)
end

function Bot.input(sim: any, userId: any, role: string?): any
	local p = sim.players[userId]
	local input = { attack = false, ability = false, charge = false }
	local tx, ty = nil, nil

	local boss = sim.boss
	if boss and not boss.defeated and sim.phase == "wave" then
		if boss.shielded and #boss.weakPoints > 0 and not (boss.retryAt and sim.t < boss.retryAt) then
			-- Each bot takes the weak point matching its slot so the squad covers all of them.
			local slot = table.find(sim.playerOrder, userId) or 1
			local wp = boss.weakPoints[((slot - 1) % #boss.weakPoints) + 1]
			if wp.hitBy == nil then
				if dist(p.x, p.y, wp.x, wp.y) > 1.5 then
					tx, ty = wp.x, wp.y
				else
					input.attack = true
				end
			end
		end
	end

	if role == "repair" and tx == nil and not input.attack then
		local worst, worstFrac = nil, 0.9
		for _, id in { "dock", "seawall", "lighthouse" } do
			local s = sim.structures[id]
			local frac = s.hp / s.maxHp
			if s.hp > 0 and frac < worstFrac then
				worst, worstFrac = s, frac
			end
		end
		if worst and p.ironScrap > 0 then
			local sx = if worst.id == "seawall" then p.x else worst.x
			local sy = if worst.id == "seawall" then worst.y - 1 else worst.y
			if dist(p.x, p.y, sx, sy) > 1.5 then
				tx, ty = sx, sy
			else
				input.repair = worst.id
			end
		end
	end

	-- Boss focus: stay on The Undertow unless an enemy is right next to us.
	if role == "boss" and tx == nil and not input.attack and not input.repair and boss and not boss.defeated and sim.phase == "wave" and not boss.shielded then
		local nearest = math.huge
		for _, e in sim.enemies do
			nearest = math.min(nearest, dist(p.x, p.y, e.x, e.y))
		end
		if nearest > 2 then
			local bx, by = boss.x, boss.y - sim.cfg.night.boss.radius - 1
			if dist(p.x, p.y, bx, by) > 1.5 then
				tx, ty = bx, by
			else
				input.aimX, input.aimY = 0, 1
				input.attack = true
			end
		end
	end

	if tx == nil and not input.attack and not input.repair then
		local best, bestD = nil, math.huge
		for _, e in sim.enemies do
			local d = dist(p.x, p.y, e.x, e.y)
			if d < bestD then
				best, bestD = e, d
			end
		end
		if best then
			if bestD > sim.cfg.night.player.attackRange * 0.8 then
				tx, ty = best.x, best.y
			else
				input.aimX, input.aimY = best.x - p.x, best.y - p.y
				input.attack = true
			end
			local near = 0
			for _, e in sim.enemies do
				if dist(p.x, p.y, e.x, e.y) < 3 then
					near += 1
				end
			end
			input.ability = near >= 3
		elseif boss and not boss.defeated and sim.phase == "wave" then
			local bx, by = boss.x, boss.y - sim.cfg.night.boss.radius - 1
			if dist(p.x, p.y, bx, by) > 1.5 then
				tx, ty = bx, by
			else
				input.aimX, input.aimY = 0, 1
				input.attack = true
			end
		end
	end

	if tx then
		input.moveX, input.moveY = tx - p.x, ty - p.y
	else
		input.moveX, input.moveY = 0, 0
	end
	-- Release the attack every other tick so presses register as edges.
	if input.attack and p.lastAttack then
		input.attack = false
	end
	return input
end

return Bot
