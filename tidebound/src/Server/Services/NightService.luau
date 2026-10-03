--[[
	Night defense rooms. One Roblox server is one room: up to 4 squads of up to 5, each in its own sector.
	The server runs one NightSim per squad at the configured tick rate (authoritative: damage, enemies,
	rewards). Players move their own characters (Roblox replicates and predicts local movement); the server
	reads positions, clamps impossible moves, and applies attacks from button intents only.

	Flow per global cycle:
	  dusk  -> form squads (friends together, then fill), announce rosters
	  night -> teleport squads to sectors, run sims, stream snapshots
	  end   -> rewards (settled once per player per night), return to the harbor
	New players get a private tutorial night (3 waves, no boss) when their countdown ends.
]]

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local HttpService = game:GetService("HttpService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local NightSim = require(Shared.Night.NightSim)
local Rewards = require(Shared.Night.Rewards)
local Session = require(Shared.Session)
local Cycle = require(Shared.Rules.Cycle)
local Drifters = require(Shared.Rules.Drifters)
local Onboarding = require(Shared.Onboarding)
local Validate = require(Shared.Util.Validate)
local RateLimiter = require(Shared.Util.RateLimiter)

local ConfigService = require(script.Parent.ConfigService)
local DataService = require(script.Parent.DataService)
local PlayerService = require(script.Parent.PlayerService)
local WorldBuilder = require(script.Parent.WorldBuilder)
local Analytics = require(script.Parent.Analytics)
local Remotes = require(script.Parent.Remotes)
local Logger = require(script.Parent.Logger)

local NightService = {}

local rooms: { any } = {} -- active sims: { id, sim, players = { Player }, origin, sectorIndex?, cove? }
local playerRoom: { [Player]: any } = {}
local squadsForming: { { Player } } = {}
local lastPhase = nil
local lastCycleIndex = -1
local inputs: { [Player]: any } = {}
local inputLimiter = RateLimiter.new(40, 60)
local coveSlots: { [number]: Player } = {}

local STRUCTURE_IDS = { "lighthouse", "seawall", "dock" }

function NightService.roomOf(player: Player): any
	return playerRoom[player]
end

-- Squad mates for quick chat during the night.
function NightService.squadOf(player: Player): { Player }
	local room = playerRoom[player]
	return room and room.players or { player }
end

local function memberFor(player: Player, save: any): any
	local cfg = ConfigService.get()
	local g = Drifters.guardianProfile(cfg, save)
	return {
		userId = player.UserId,
		power = g.power,
		speed = g.speed,
		element = g.element,
		repairPct = g.repairPct,
		ironScrap = save.materials.ironScrap,
		smugglerOptIn = save.settings.smugglerOptIn == true,
	}
end

local function moveCharacter(player: Player, cframe: CFrame, walkSpeed: number?)
	local character = player.Character
	if character then
		character:PivotTo(cframe)
		local humanoid = character:FindFirstChildOfClass("Humanoid")
		if humanoid then
			humanoid.WalkSpeed = walkSpeed or 16
		end
	end
end

-- Groups players into squads: Roblox friends together first, then fill up to the max size.
local function formSquads(candidates: { Player }): { { Player } }
	local cfg = ConfigService.get()
	local maxSize = cfg.night.maxSquadSize
	local squads: { { Player } } = {}
	local placed: { [Player]: boolean } = {}
	for _, p in candidates do
		if not placed[p] then
			local squad = { p }
			placed[p] = true
			for _, q in candidates do
				if #squad >= maxSize then
					break
				end
				if not placed[q] then
					local ok, friends = pcall(p.IsFriendsWith, p, q.UserId)
					if ok and friends then
						table.insert(squad, q)
						placed[q] = true
					end
				end
			end
			table.insert(squads, squad)
		end
	end
	-- Merge small squads so nobody defends alone when others are around.
	table.sort(squads, function(a, b)
		return #a > #b
	end)
	local merged = {}
	for _, squad in squads do
		local target = nil
		for _, m in merged do
			if #m + #squad <= maxSize then
				target = m
				break
			end
		end
		if target and (#squad < 3 or #target < 3) then
			for _, p in squad do
				table.insert(target, p)
			end
		else
			table.insert(merged, squad)
		end
	end
	while #merged > cfg.night.maxSquadsPerRoom do
		-- Rooms cap at 4 sectors; extra players join the smallest squads (server MaxPlayers keeps this rare).
		local extra = table.remove(merged)
		for _, p in extra do
			table.sort(merged, function(a, b)
				return #a < #b
			end)
			table.insert(merged[1], p)
		end
	end
	return merged
end

local function eligibleForGlobalNight(player: Player): boolean
	local save = DataService.saveOf(player)
	if not save or playerRoom[player] then
		return false
	end
	-- New players finish their own tutorial night first.
	return save.night.firstCompleted or save.onboarding.skipped
end

local function startRoom(players: { Player }, origin: Vector3, onboarding: boolean, label: string, sectorIndex: number?): any
	local cfg = ConfigService.get()
	local members = {}
	for _, p in players do
		local save = DataService.saveOf(p)
		if save then
			table.insert(members, memberFor(p, save))
		end
	end
	if #members == 0 then
		return nil
	end
	local now = PlayerService.now()
	local mods = PlayerService.mods(now)
	local sim = NightSim.new(cfg, { seed = math.random(1, 2 ^ 30), members = members, onboarding = onboarding, mods = mods })
	local room = {
		id = label .. ":" .. HttpService:GenerateGUID(false),
		sim = sim,
		players = players,
		origin = origin,
		sectorIndex = sectorIndex,
		onboarding = onboarding,
		accumulator = 0,
		streaks = {},
	}
	for i, p in players do
		local save = DataService.saveOf(p)
		room.streaks[p.UserId] = save and save.night.streak or 0
		playerRoom[p] = room
		local sp = sim.players[p.UserId]
		local speed = sp and sp.speed * WorldBuilder.STUDS or 16
		moveCharacter(p, CFrame.new(WorldBuilder.toWorld(origin, sp and sp.x or 12, sp and sp.y or 8, 4)), speed)
		Analytics.track(p, "night_started", { squadSize = #players, onboarding = onboarding })
		Remotes.get("NightEvent"):FireClient(p, "night_started", {
			roomId = room.id,
			origin = origin,
			studs = WorldBuilder.STUDS,
			squad = (function()
				local ids = {}
				for _, q in players do
					table.insert(ids, q.UserId)
				end
				return ids
			end)(),
			onboarding = onboarding,
			slot = i,
		})
	end
	table.insert(rooms, room)
	Logger.info("night_started", { room = room.id, squad = #players, onboarding = onboarding })
	return room
end

local function settle(room: any)
	local cfg = ConfigService.get()
	local sim = room.sim
	local now = PlayerService.now()
	local rewards = Rewards.compute(cfg, sim, room.streaks, PlayerService.mods(now))
	for _, p in room.players do
		if playerRoom[p] == room then
			playerRoom[p] = nil
			inputs[p] = nil
			local save = DataService.saveOf(p)
			local reward = rewards[p.UserId]
			if save and reward then
				local events = Session.settleNight(cfg, save, room.id, reward, now)
				Analytics.trackAll(p, events)
				Analytics.economy(p, true, "Silver", reward.silver, save.currencies.silver, Enum.AnalyticsEconomyTransactionType.Gameplay, "night_reward")
				DataService.saveNow(p)
				Remotes.get("NightEvent"):FireClient(p, "night_result", reward)
				PlayerService.pushState(p)
			end
			moveCharacter(p, WorldBuilder.HARBOR_SPAWN, 16)
		end
	end
	if room.coveSlot then
		coveSlots[room.coveSlot] = nil
	end
	Logger.info("night_ended", { room = room.id, survived = sim.result.survived, waves = sim.result.wavesSurvived, boss = sim.result.bossDefeated })
end

local function sanitizeInput(raw: any): any
	if type(raw) ~= "table" or getmetatable(raw) ~= nil then
		return {}
	end
	local input = {
		attack = raw.attack == true,
		charge = raw.charge == true,
		ability = raw.ability == true,
	}
	if Validate.oneOf(raw.repair, STRUCTURE_IDS) then
		input.repair = raw.repair
	end
	if Validate.int(raw.inspect, 1, 1e15) then
		input.inspect = raw.inspect
	end
	if Validate.number(raw.aimX, -1, 1) and Validate.number(raw.aimY, -1, 1) then
		input.aimX, input.aimY = raw.aimX, raw.aimY
	end
	return input
end

local function stepRooms(dt: number)
	local cfg = ConfigService.get()
	local tickDt = 1 / cfg.night.tickRate
	local snapshotRemote = Remotes.get("NightSnapshot")
	local eventRemote = Remotes.get("NightEvent")
	local finished = {}
	for _, room in rooms do
		room.accumulator += dt
		local steps = 0
		while room.accumulator >= tickDt and steps < 4 do
			room.accumulator -= tickDt
			steps += 1
			local sim = room.sim
			for _, p in room.players do
				if playerRoom[p] == room then
					local character = p.Character
					local root = character and character:FindFirstChild("HumanoidRootPart")
					if root then
						local x, y = WorldBuilder.toSim(room.origin, root.Position)
						if not NightSim.setPosition(sim, p.UserId, x, y, tickDt) then
							-- Moved further than possible: put the character back where the server has it.
							local sp = sim.players[p.UserId]
							root.CFrame = CFrame.new(WorldBuilder.toWorld(room.origin, sp.x, sp.y, root.Position.Y - room.origin.Y))
						end
					end
					NightSim.setInput(sim, p.UserId, inputs[p] or {})
				end
			end
			NightSim.step(sim, tickDt)
			local events = NightSim.drainEvents(sim)
			if #events > 0 then
				for _, p in room.players do
					if playerRoom[p] == room then
						eventRemote:FireClient(p, "sim_events", events)
					end
				end
			end
			if sim.ended then
				table.insert(finished, room)
				break
			end
		end
		-- One snapshot per server frame batch keeps bandwidth near the tick rate.
		for _, p in room.players do
			if playerRoom[p] == room then
				snapshotRemote:FireClient(p, NightSim.snapshot(room.sim, p.UserId))
			end
		end
	end
	for _, room in finished do
		local i = table.find(rooms, room)
		if i then
			table.remove(rooms, i)
		end
		task.spawn(settle, room)
	end
end

local function globalNight(phase: any)
	local cfg = ConfigService.get()
	if phase.phase == "dusk" and lastPhase ~= "dusk" then
		local candidates = {}
		for _, p in Players:GetPlayers() do
			if eligibleForGlobalNight(p) then
				table.insert(candidates, p)
			end
		end
		squadsForming = formSquads(candidates)
		for _, squad in squadsForming do
			local ids = {}
			for _, p in squad do
				table.insert(ids, p.UserId)
			end
			for _, p in squad do
				Remotes.get("NightEvent"):FireClient(p, "squad_formed", { squad = ids, startsAt = phase.endsAt })
			end
		end
	elseif phase.phase == "night" and lastCycleIndex ~= phase.cycleIndex then
		lastCycleIndex = phase.cycleIndex
		if #squadsForming == 0 then
			local candidates = {}
			for _, p in Players:GetPlayers() do
				if eligibleForGlobalNight(p) then
					table.insert(candidates, p)
				end
			end
			squadsForming = formSquads(candidates)
		end
		for i, squad in squadsForming do
			local present = {}
			for _, p in squad do
				if p.Parent and eligibleForGlobalNight(p) then
					table.insert(present, p)
				end
			end
			if #present > 0 and i <= #WorldBuilder.SECTOR_ORIGINS then
				startRoom(present, WorldBuilder.SECTOR_ORIGINS[i], false, "night" .. phase.cycleIndex .. "s" .. i, i)
			end
		end
		squadsForming = {}
	elseif phase.phase == "night" and phase.secondsLeft > cfg.night.waveSeconds then
		-- Late joiners slot into a squad with space while the first waves run.
		local since = cfg.cycle.nightSeconds - phase.secondsLeft
		if since <= cfg.cycle.nightJoinLateSeconds then
			for _, p in Players:GetPlayers() do
				if eligibleForGlobalNight(p) then
					for _, room in rooms do
						if not room.onboarding and #room.players < cfg.night.maxSquadSize then
							local save = DataService.saveOf(p)
							NightSim.addPlayer(room.sim, memberFor(p, save))
							table.insert(room.players, p)
							room.streaks[p.UserId] = save.night.streak
							playerRoom[p] = room
							local sp = room.sim.players[p.UserId]
							moveCharacter(p, CFrame.new(WorldBuilder.toWorld(room.origin, sp.x, sp.y, 4)), sp.speed * WorldBuilder.STUDS)
							Remotes.get("NightEvent"):FireClient(p, "night_started", { roomId = room.id, origin = room.origin, studs = WorldBuilder.STUDS, squad = {}, onboarding = false, late = true })
							break
						end
					end
				end
			end
		end
	end
	lastPhase = phase.phase
end

-- Starts tutorial nights for new players whose countdown has ended.
local function tutorialNights(now: number)
	for _, p in Players:GetPlayers() do
		local save = DataService.saveOf(p)
		if save and not playerRoom[p] and not save.night.firstCompleted and save.onboarding.firstNightAt and now >= save.onboarding.firstNightAt and save.onboarding.step >= Onboarding.index("countdown") then
			local slot = 1
			while coveSlots[slot] do
				slot += 1
			end
			coveSlots[slot] = p
			local origin = WorldBuilder.COVE_ORIGIN + Vector3.new((slot - 1) * WorldBuilder.COVE_SPACING, 0, 0)
			if not workspace:FindFirstChild("NightSectors") or not workspace.NightSectors:FindFirstChild("Cove" .. slot) then
				WorldBuilder.buildSector(ConfigService.get(), "Cove" .. slot, origin)
			end
			local room = startRoom({ p }, origin, true, "tutorial" .. p.UserId, nil)
			if room then
				room.coveSlot = slot
			else
				coveSlots[slot] = nil
			end
		end
	end
end

local function onLeaving(player: Player, save: any)
	local room = playerRoom[player]
	if not room then
		return
	end
	local cfg = ConfigService.get()
	local reward = Rewards.partial(cfg, room.sim, player.UserId, room.streaks[player.UserId] or 0, PlayerService.mods(PlayerService.now()))
	Session.settleNight(cfg, save, room.id, reward, PlayerService.now())
	NightSim.removePlayer(room.sim, player.UserId)
	playerRoom[player] = nil
	inputs[player] = nil
	if room.coveSlot and coveSlots[room.coveSlot] == player then
		local i = table.find(rooms, room)
		if i then
			table.remove(rooms, i)
		end
		coveSlots[room.coveSlot] = nil
	end
end

local function onControl(player: Player, action: any, _args: any): any
	if action == "status" then
		local room = playerRoom[player]
		return { ok = true, inNight = room ~= nil, roomId = room and room.id or nil }
	end
	return { ok = false, err = "unknown_action" }
end

function NightService.init()
	local cfg = ConfigService.get()
	for i, origin in WorldBuilder.SECTOR_ORIGINS do
		if i <= cfg.night.maxSquadsPerRoom then
			WorldBuilder.buildSector(cfg, "Sector" .. i, origin)
		end
	end
	Remotes.get("NightInput").OnServerEvent:Connect(function(player, raw)
		if playerRoom[player] and inputLimiter:allow(player, os.clock()) then
			inputs[player] = sanitizeInput(raw)
		end
	end)
	Remotes.get("NightControl").OnServerInvoke = onControl
	PlayerService.Leaving:Connect(onLeaving)
	Players.PlayerRemoving:Connect(function(player)
		inputLimiter:forget(player)
	end)
	RunService.Heartbeat:Connect(stepRooms)
	task.spawn(function()
		while true do
			task.wait(0.5)
			local now = PlayerService.now()
			local ok, err = pcall(function()
				globalNight(Cycle.at(ConfigService.get(), now))
				tutorialNights(now)
			end)
			if not ok then
				Logger.error("night_loop_error", { error = tostring(err) })
			end
		end
	end)
end

-- Debug panel: start a night for the caller's squad right now.
function NightService.debugStartNow(player: Player, onboarding: boolean)
	if playerRoom[player] then
		return
	end
	local index = 1
	for _, room in rooms do
		if room.sectorIndex == index then
			index += 1
		end
	end
	startRoom({ player }, WorldBuilder.SECTOR_ORIGINS[math.min(index, #WorldBuilder.SECTOR_ORIGINS)], onboarding, "debug" .. player.UserId, index)
end

return NightService
