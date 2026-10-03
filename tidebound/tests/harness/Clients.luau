--[[
	Scripted clients for server integration tests. They talk to the server only through remotes,
	the same way the real client does, and move their characters like a player holding the joystick.
]]

local roblox = require("@lune/roblox")
local CFrame = roblox.CFrame

local Clients = {}

local seqs = setmetatable({}, { __mode = "k" })

-- Sends a day intent with the next sequence number. Returns the server's reply.
function Clients.intent(rt, player, intentType: string, args: any?)
	seqs[player] = (seqs[player] or 0) + 1
	return rt:invoke(player, "Intent", { type = intentType, args = args }, seqs[player])
end

-- Plays the guided tutorial through remotes, like the onboarding overlay does.
function Clients.tutorial(rt, player)
	assert(Clients.intent(rt, player, "onboarding", { action = "start" }).ok, "start failed")
	local cast = Clients.intent(rt, player, "cast")
	assert(cast.ok, "cast failed: " .. tostring(cast.err))
	local now = rt.epoch + rt.clock
	rt:advance(cast.data.biteAt - now + cast.data.zoneCenter + 0.1)
	local reel = Clients.intent(rt, player, "reel", { castId = cast.data.castId, tap = cast.data.zoneCenter })
	assert(reel.ok and reel.data.caught, "tutorial fish not caught")
	local sell = Clients.intent(rt, player, "sellAll")
	assert(sell.ok, "sell failed")
	local hatch = Clients.intent(rt, player, "hatch")
	assert(hatch.ok, "hatch failed: " .. tostring(hatch.err))
	local role = Clients.intent(rt, player, "setRole", { drifter = hatch.data.drifter.id, role = "guardian" })
	assert(role.ok, "role failed: " .. tostring(role.err))
	return hatch.data.drifter
end

--[[
	Drives every player who is in a night room with the shared bot brain: moves the character toward the
	bot's target at the player's speed and sends button inputs at 20 Hz over NightInput.
]]
function Clients.driveNights(rt, roles: any?)
	local NightService = rt:service("NightService")
	local WorldBuilder = rt:service("WorldBuilder")
	local Bot = rt:shared("Night.Bot")
	local sendTimer = 0
	rt.onFrame = function(dt)
		sendTimer += dt
		local send = sendTimer >= 0.05
		if send then
			sendTimer = 0
		end
		for _, player in rt.players do
			local room = NightService.roomOf(player)
			local root = player.Character and player.Character:FindFirstChild("HumanoidRootPart")
			if root then
				-- Server corrections set CFrame only; mirror them into Position like the engine does.
				root.Position = root.CFrame.Position
			end
			if room and root then
				local sim = room.sim
				local sp = sim.players[player.UserId]
				local input = Bot.input(sim, player.UserId, roles and roles[player.UserId])
				local mx, my = input.moveX or 0, input.moveY or 0
				local len = math.sqrt(mx * mx + my * my)
				if len > 0.01 and rt.clock >= 0 and sim.t >= sp.stunnedUntil then
					local step = math.min(len, sp.speed * dt)
					local x = sp.x + mx / len * step
					local y = sp.y + my / len * step
					local cf = CFrame.new(WorldBuilder.toWorld(room.origin, x, y, 3))
					root.CFrame = cf
					root.Position = cf.Position
				end
				if send then
					rt:fire(player, "NightInput", {
						attack = input.attack,
						ability = input.ability,
						charge = input.charge,
						repair = input.repair,
						aimX = input.aimX and math.clamp(input.aimX, -1, 1) or nil,
						aimY = input.aimY and math.clamp(input.aimY, -1, 1) or nil,
					})
				end
			end
		end
	end
end

function Clients.lastEvent(player, kind: string)
	local list = player.inbox.NightEvent or {}
	for i = #list, 1, -1 do
		if list[i][1] == kind then
			return list[i][2]
		end
	end
	return nil
end

return Clients
