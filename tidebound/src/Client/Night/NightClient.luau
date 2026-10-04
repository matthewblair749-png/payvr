--[[
	Night defense on the client.
	  * Renders the server's simulation: enemies (interpolated 100 ms behind), the boss, telegraphed attacks,
	    weak points, structure damage stages, and the Smuggler's crates (only for the Smuggler).
	  * The local character moves immediately (Roblox client movement = prediction for the local player);
	    the server corrects only impossible moves.
	  * Controls: on-screen joystick (Roblox default), attack, charged attack (hold), Guardian ability,
	    repair (hold) and inspect. Keyboard and gamepad bindings through ContextActionService.
	  * No purchase prompts or shop access while a night is running.
]]

local ContextActionService = game:GetService("ContextActionService")
local RunService = game:GetService("RunService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Interpolator = require(ReplicatedStorage.Shared.Night.Interpolator)
local Creatures = require(script.Parent.Parent.World.Creatures)
local Ui = require(script.Parent.Parent.Ui.Ui)
local Theme = require(script.Parent.Parent.Ui.Theme)
local Format = require(script.Parent.Parent.Ui.Format)

local NightClient = {}

local ENEMY_TYPES = { "crawler", "brute", "spitter" }
local STRUCTURES = { "lighthouse", "seawall", "dock" }
local SEND_RATE = 20

function NightClient.mount(app: any, gui: ScreenGui)
	local L = app.L
	local remotes = app.remotes
	local player = Players.LocalPlayer

	local session = nil -- { origin, studs, squad, onboarding, folder, interp, enemies = {id -> part}, latest }
	local input = { attack = false, charge = false, ability = false }
	local pressFrames = { attack = 0, ability = 0 }

	-- ------------------------------------------------------------------ HUD (concept art layout)
	local c = Theme.colors
	local hud = Ui.frame(gui, { Name = "NightHud", BackgroundTransparency = 1, Size = UDim2.fromScale(1, 1), Visible = false })
	Ui.text(hud, L("night_title"), { TextSize = 22, FontFace = Theme.fontBold, Size = UDim2.fromOffset(420, 28), AutomaticSize = Enum.AutomaticSize.None, Position = UDim2.fromOffset(12, 10) })
	local waveText = Ui.text(hud, "", { TextSize = 28, FontFace = Theme.fontBold, Size = UDim2.fromOffset(360, 34), AutomaticSize = Enum.AutomaticSize.None, Position = UDim2.new(1, -12, 0, 8), AnchorPoint = Vector2.new(1, 0), TextXAlignment = Enum.TextXAlignment.Right })

	-- Squad list: avatar, name, ability readiness bar (red while stunned)
	local squadPanel = Ui.glass(hud, { Size = UDim2.fromOffset(200, 0), AutomaticSize = Enum.AutomaticSize.Y, Position = UDim2.fromOffset(12, 46) })
	Ui.padding(squadPanel, 8)
	Ui.list(squadPanel, 6)
	local squadRows = {}
	local function squadRow(userId: number)
		if squadRows[userId] then
			return squadRows[userId]
		end
		local row = Ui.frame(squadPanel, { BackgroundTransparency = 1, Size = UDim2.new(1, 0, 0, 40), LayoutOrder = if userId == player.UserId then 0 else #squadPanel:GetChildren() })
		Ui.avatar(row, userId, 38)
		local other = Players:GetPlayerByUserId(userId)
		local name = Ui.text(row, if userId == player.UserId then L("night_you") elseif other then other.DisplayName else "?", { TextSize = 14, Size = UDim2.new(1, -46, 0, 18), AutomaticSize = Enum.AutomaticSize.None, Position = UDim2.fromOffset(46, 2) })
		name.TextTruncate = Enum.TextTruncate.AtEnd
		local fill = Ui.progress(row, 1, c.blue, { Size = UDim2.new(1, -46, 0, 8), Position = UDim2.fromOffset(46, 24) })
		squadRows[userId] = { row = row, fill = fill, name = name }
		return squadRows[userId]
	end

	-- Structures
	local structurePanel = Ui.glass(hud, { Size = UDim2.fromOffset(200, 0), AutomaticSize = Enum.AutomaticSize.Y, Position = UDim2.new(0, 12, 1, -150), AnchorPoint = Vector2.new(0, 1) })
	Ui.padding(structurePanel, 8)
	Ui.list(structurePanel, 6)
	local structureRows = {}
	for i, id in STRUCTURES do
		local row = Ui.frame(structurePanel, { BackgroundTransparency = 1, Size = UDim2.new(1, 0, 0, 32), LayoutOrder = i })
		local label = Ui.text(row, "", { TextSize = 13, Size = UDim2.new(1, 0, 0, 16), AutomaticSize = Enum.AutomaticSize.None })
		local bar = Ui.progress(row, 1, c.good, { Size = UDim2.new(1, 0, 0, 9), Position = UDim2.fromOffset(0, 20) })
		structureRows[id] = { label = label, bar = bar }
	end

	-- Boss bar
	local bossPanel = Ui.glass(hud, { Size = UDim2.new(0.42, 0, 0, 52), Position = UDim2.new(0.5, 0, 0, 48), AnchorPoint = Vector2.new(0.5, 0), Visible = false })
	Ui.padding(bossPanel, 8)
	local bossText = Ui.text(bossPanel, "", { TextSize = 15, Size = UDim2.new(1, 0, 0, 18), AutomaticSize = Enum.AutomaticSize.None, TextXAlignment = Enum.TextXAlignment.Center })
	local bossBar = Ui.progress(bossPanel, 1, c.bad, { Size = UDim2.new(1, 0, 0, 12), Position = UDim2.fromOffset(0, 22) })

	local infoText = Ui.text(hud, "", { TextSize = 15, Position = UDim2.new(0.5, 0, 1, -66), AnchorPoint = Vector2.new(0.5, 0), Size = UDim2.fromOffset(360, 0), TextXAlignment = Enum.TextXAlignment.Center })
	local smugglerText = Ui.text(hud, "", { TextSize = 16, Position = UDim2.new(0.5, 0, 0, 106), AnchorPoint = Vector2.new(0.5, 0), Size = UDim2.fromOffset(420, 0), TextColor3 = c.gold, TextXAlignment = Enum.TextXAlignment.Center })
	local squadButton = Ui.button(hud, "👥", function()
		app:open("squad")
	end, { BackgroundColor3 = c.panelAlt, Size = UDim2.fromOffset(48, 48), Position = UDim2.fromOffset(222, 46), TextSize = 20 })
	squadButton.Visible = true

	-- ------------------------------------------------------------------ world visuals
	local function newEnemy(typeId: string): Instance
		local element = session and session.latest and session.latest.element or "tide"
		return Creatures.enemy(typeId, element)
	end

	local function toWorld(x: number, y: number, h: number?): Vector3
		return session.origin + Vector3.new(x * session.studs, h or 2, -y * session.studs)
	end

	local function flatDisc(radius: number, color: Color3, transparency: number): Part
		local p = Instance.new("Part")
		p.Shape = Enum.PartType.Cylinder
		p.Size = Vector3.new(0.2, radius * 2 * session.studs, radius * 2 * session.studs)
		p.Color = color
		p.Material = Enum.Material.Neon
		p.Transparency = transparency
		p.Anchored = true
		p.CanCollide = false
		p.CanQuery = false
		p.CastShadow = false
		return p
	end

	-- ------------------------------------------------------------------ snapshot handling
	local function onSnapshot(snap: any)
		if not session then
			return
		end
		session.latest = snap
		local entities = {}
		for _, e in snap.e do
			entities[e[1]] = { x = e[3], y = e[4], type = e[2], hp = e[5] }
		end
		session.interp:push(snap.t, os.clock(), entities)

		-- HUD text
		local key = if snap.phase == "intro" then "night_intro" elseif snap.phase == "break" then "night_break" else "night_wave"
		waveText.Text = L(key, { wave = snap.wave, waves = snap.waveCount, time = Format.duration(snap.phaseLeft), element = L("element_" .. tostring(snap.element)) })
		for i, id in STRUCTURES do
			local s = snap.s[i]
			local row = structureRows[id]
			row.label.Text = L("structure_" .. id) .. "  " .. L("stage_" .. s[3])
			row.bar.Size = UDim2.fromScale(s[1] / math.max(1, s[2]), 1)
			row.bar:FindFirstChildOfClass("UIGradient").Color = ColorSequence.new(if s[3] == 0 then Theme.colors.good elseif s[3] == 1 then Theme.colors.gold else Theme.colors.bad)
			-- Three visible damage stages on the structure itself.
			local part = session.sector and session.sector:FindFirstChild(id)
			if part and part:IsA("BasePart") and part:GetAttribute("ClientStage") ~= s[3] then
				part:SetAttribute("ClientStage", s[3])
				part.Color = ({ Color3.fromRGB(240, 240, 235), Color3.fromRGB(220, 190, 140), Color3.fromRGB(170, 120, 90), Color3.fromRGB(80, 70, 70) })[s[3] + 1]
				part.Transparency = if s[3] == 3 then 0.6 else 0
			end
		end
		local me = nil
		local abilityCooldown = app.cfg.night.player.abilityCooldown
		for _, p in snap.p do
			if p[1] == player.UserId then
				me = p
			end
			local r = squadRow(p[1])
			r.fill.Size = UDim2.fromScale(1 - math.clamp(p[6] / abilityCooldown, 0, 1), 1)
			r.fill:FindFirstChildOfClass("UIGradient").Color = ColorSequence.new(if p[4] then Theme.colors.bad else Theme.colors.blue)
		end
		if me then
			infoText.Text = L("night_info", { iron = me[7], ability = if me[6] > 0 then Format.duration(me[6]) else L("ready") }) .. (if me[4] then "\n" .. L("night_stunned") else "")
		end
		local b = snap.b
		bossPanel.Visible = b ~= nil and not b[7]
		if b then
			bossBar.Size = UDim2.fromScale(b[1] / 100, 1)
			local status = if b[3] then L("boss_shielded") elseif b[4] then L("boss_stunned") else L("boss_phase", { phase = b[2] })
			bossText.Text = L("the_undertow") .. "  " .. status .. (if b[6] then "  " .. L("boss_window", { time = string.format("%.1f", b[6]) }) else "")
		end
		if snap.sm then
			local sm = snap.sm
			if sm.isMe then
				smugglerText.Text = L("smuggler_you", { delivered = sm.delivered, total = sm.total, time = Format.duration(sm.timeLeft) }) .. (if sm.carrying then "  " .. L("smuggler_carrying") else "")
			elseif sm.result == nil then
				smugglerText.Text = L("smuggler_among_us")
			else
				smugglerText.Text = L("smuggler_result_" .. sm.result)
			end
		else
			smugglerText.Text = ""
		end
	end

	-- ------------------------------------------------------------------ render loop
	local telegraphParts = {}
	local weakParts = {}
	local crateParts = {}
	local bossPart = nil
	local renderConn = nil

	local function render()
		if not session or not session.latest then
			return
		end
		local positions = session.interp:sample(os.clock())
		local seen = {}
		for id, e in positions do
			seen[id] = true
			local inst = session.enemies[id]
			if not inst then
				inst = newEnemy(ENEMY_TYPES[e.type] or "crawler")
				inst.Parent = session.folder
				session.enemies[id] = inst
			end
			local pos = toWorld(e.x, e.y, 1.6)
			local last = session.lastPos[id] or pos
			session.lastPos[id] = pos
			local dir = (pos - last) * Vector3.new(1, 0, 1)
			local facing = session.facing[id] or Vector3.new(0, 0, 1)
			if dir.Magnitude > 0.01 then
				facing = dir.Unit
				session.facing[id] = facing
			end
			local bob = if Theme.reducedMotion then 0 else math.abs(math.sin(os.clock() * 8 + id)) * 0.4
			inst:PivotTo(CFrame.lookAt(pos + Vector3.new(0, bob, 0), pos + Vector3.new(0, bob, 0) + facing))
		end
		for id, inst in session.enemies do
			if not seen[id] then
				inst:Destroy()
				session.enemies[id] = nil
				session.lastPos[id] = nil
				session.facing[id] = nil
			end
		end
		local snap = session.latest
		-- Boss, weak points and telegraphs follow the newest snapshot (they barely move).
		local b = snap.b
		if b and not b[7] then
			local cfgBoss = app.cfg.night.boss
			if not bossPart then
				bossPart = Creatures.boss(cfgBoss.radius * session.studs * 0.9)
				bossPart.Parent = session.folder
				bossPart:PivotTo(CFrame.new(toWorld(cfgBoss.x, cfgBoss.y, cfgBoss.radius * session.studs * 0.7)) * CFrame.Angles(0, math.rad(180), 0))
			end
			-- Shielded: glassy force field; stunned: sinks and tilts; otherwise a slow menacing sway.
			local body = bossPart.PrimaryPart
			if body then
				body.Material = if b[3] then Enum.Material.ForceField else Enum.Material.Glass
			end
			if not Theme.reducedMotion then
				local sway = if b[4] then -2 else math.sin(os.clock() * 1.5) * 0.8
				bossPart:PivotTo(CFrame.new(toWorld(cfgBoss.x, cfgBoss.y, cfgBoss.radius * session.studs * 0.7 + sway)) * CFrame.Angles(if b[4] then math.rad(12) else 0, math.rad(180 + math.sin(os.clock() * 0.7) * 10), 0))
			end
			for i, wp in b[5] do
				local p = weakParts[i]
				if not p then
					p = Instance.new("Part")
					p.Shape = Enum.PartType.Ball
					p.Size = Vector3.one * 3
					p.Material = Enum.Material.Neon
					p.Anchored = true
					p.CanCollide = false
					p.Parent = session.folder
					weakParts[i] = p
				end
				p.Color = if wp[3] then Theme.colors.good else Theme.colors.accent
				p.CFrame = CFrame.new(toWorld(wp[1], wp[2], 3))
			end
			for i = #b[5] + 1, #weakParts do
				weakParts[i]:Destroy()
				weakParts[i] = nil
			end
		elseif bossPart then
			bossPart:Destroy()
			bossPart = nil
		end
		for i, tg in snap.tg do
			local p = telegraphParts[i]
			if not p then
				p = flatDisc(tg[3], Theme.colors.bad, 0.5)
				p.Parent = session.folder
				telegraphParts[i] = p
			end
			p.CFrame = CFrame.new(toWorld(tg[1], tg[2], 0.3)) * CFrame.Angles(0, 0, math.rad(90))
			-- Pulse faster as the hit approaches; steady when reduced motion is on.
			p.Transparency = if Theme.reducedMotion then 0.4 else 0.25 + 0.35 * math.abs(math.sin(os.clock() * (8 - tg[4] * 3)))
		end
		for i = #snap.tg + 1, #telegraphParts do
			telegraphParts[i]:Destroy()
			telegraphParts[i] = nil
		end
		local crates = snap.sm and snap.sm.crates or {}
		for i, c in crates do
			local p = crateParts[i]
			if not p then
				p = Instance.new("Part")
				p.Size = Vector3.new(2, 2, 2)
				p.Color = Color3.fromRGB(160, 110, 60)
				p.Anchored = true
				p.CanCollide = false
				p.Parent = session.folder
				crateParts[i] = p
			end
			p.CFrame = CFrame.new(toWorld(c[1], c[2], 1))
		end
		for i = #crates + 1, #crateParts do
			crateParts[i]:Destroy()
			crateParts[i] = nil
		end
		if snap.sm and snap.sm.boat and not session.boatPart then
			local boat = Instance.new("Part")
			boat.Size = Vector3.new(6, 2, 10)
			boat.Color = Color3.fromRGB(110, 80, 50)
			boat.Anchored = true
			boat.CanCollide = false
			boat.CFrame = CFrame.new(toWorld(snap.sm.boat[1], snap.sm.boat[2], 1))
			boat.Parent = session.folder
			session.boatPart = boat
		end
	end

	-- ------------------------------------------------------------------ controls
	local function nearestStructure(): string?
		local snap = session and session.latest
		local character = player.Character
		local root = character and character:FindFirstChild("HumanoidRootPart")
		if not snap or not root then
			return nil
		end
		local best, bestD = nil, math.huge
		for _, s in app.cfg.night.structures do
			local pos = toWorld(s.x, s.y, root.Position.Y - session.origin.Y)
			local d = if s.id == "seawall" then math.abs(root.Position.Z - pos.Z) else (root.Position - pos).Magnitude
			if d < bestD then
				best, bestD = s.id, d
			end
		end
		return best
	end

	local function nearestSquadMate(): number?
		local character = player.Character
		local root = character and character:FindFirstChild("HumanoidRootPart")
		if not root then
			return nil
		end
		local best, bestD = nil, math.huge
		for _, userId in session.squad do
			local other = Players:GetPlayerByUserId(userId)
			local r = other and other ~= player and other.Character and other.Character:FindFirstChild("HumanoidRootPart")
			if r then
				local d = (r.Position - root.Position).Magnitude
				if d < bestD then
					best, bestD = userId, d
				end
			end
		end
		return best
	end

	local function bind()
		ContextActionService:BindAction("TideAttack", function(_, state)
			if state == Enum.UserInputState.Begin then
				pressFrames.attack = 2
			end
			return Enum.ContextActionResult.Sink
		end, false, Enum.KeyCode.F, Enum.KeyCode.ButtonR2)
		ContextActionService:BindAction("TideCharge", function(_, state)
			input.charge = state == Enum.UserInputState.Begin or state == Enum.UserInputState.Change
			return Enum.ContextActionResult.Sink
		end, false, Enum.KeyCode.E, Enum.KeyCode.ButtonL2)
		ContextActionService:BindAction("TideAbility", function(_, state)
			if state == Enum.UserInputState.Begin then
				pressFrames.ability = 2
			end
			return Enum.ContextActionResult.Sink
		end, false, Enum.KeyCode.Q, Enum.KeyCode.ButtonY)
		ContextActionService:BindAction("TideRepair", function(_, state)
			input.repair = if state == Enum.UserInputState.Begin or state == Enum.UserInputState.Change then nearestStructure() else nil
			return Enum.ContextActionResult.Sink
		end, false, Enum.KeyCode.R, Enum.KeyCode.ButtonX)
		if app.cfg.night.smuggler.enabled then
			ContextActionService:BindAction("TideInspect", function(_, state)
				if state == Enum.UserInputState.Begin then
					input.inspect = nearestSquadMate()
				elseif state == Enum.UserInputState.End then
					input.inspect = nil
				end
				return Enum.ContextActionResult.Sink
			end, false, Enum.KeyCode.T, Enum.KeyCode.ButtonB)
		end
	end

	local function unbind()
		for _, action in { "TideAttack", "TideCharge", "TideAbility", "TideRepair", "TideInspect" } do
			ContextActionService:UnbindAction(action)
		end
	end

	-- On-screen controls (touch and mouse), styled like the concept: a big round attack button
	-- with square skill buttons labelled with their keys.
	local controls = Ui.frame(hud, { BackgroundTransparency = 1, Size = UDim2.fromOffset(300, 220), Position = UDim2.new(1, -12, 1, -12), AnchorPoint = Vector2.new(1, 1) })
	local function skill(icon: string, key: string, color: Color3, pos: UDim2, size: number): TextButton
		local b = Ui.button(controls, icon, function() end, { BackgroundColor3 = color, Size = UDim2.fromOffset(size, size), Position = pos, TextSize = math.floor(size * 0.42), FontFace = Theme.fontEmoji })
		local tag = Ui.text(b, key, { TextSize = 13, Size = UDim2.fromOffset(size, 16), AutomaticSize = Enum.AutomaticSize.None, Position = UDim2.new(0, 0, 1, 2), TextXAlignment = Enum.TextXAlignment.Center })
		local _ = tag
		return b
	end
	local attackBtn = skill("⚔️", "F", c.accent, UDim2.new(1, -110, 1, -110), 104)
	attackBtn:FindFirstChildOfClass("UICorner").CornerRadius = UDim.new(1, 0)
	local chargeBtn = skill("💥", "E", c.coral, UDim2.new(1, -186, 1, -76), 64)
	local abilityBtn = skill("✨", "Q", c.purple, UDim2.new(1, -186, 1, -160), 64)
	local repairBtn = skill("🔧", "R", c.good, UDim2.new(1, -104, 1, -196), 64)
	local inspectBtn = skill("🔍", "T", c.gold, UDim2.new(1, -262, 1, -76), 64)
	inspectBtn.Visible = app.cfg.night.smuggler.enabled
	attackBtn.MouseButton1Down:Connect(function()
		pressFrames.attack = 2
	end)
	abilityBtn.MouseButton1Down:Connect(function()
		pressFrames.ability = 2
	end)
	chargeBtn.MouseButton1Down:Connect(function()
		input.charge = true
	end)
	chargeBtn.MouseButton1Up:Connect(function()
		input.charge = false
	end)
	chargeBtn.MouseLeave:Connect(function()
		input.charge = false
	end)
	repairBtn.MouseButton1Down:Connect(function()
		input.repair = nearestStructure()
	end)
	repairBtn.MouseButton1Up:Connect(function()
		input.repair = nil
	end)
	repairBtn.MouseLeave:Connect(function()
		input.repair = nil
	end)
	inspectBtn.MouseButton1Down:Connect(function()
		input.inspect = nearestSquadMate()
	end)
	inspectBtn.MouseButton1Up:Connect(function()
		input.inspect = nil
	end)

	-- ------------------------------------------------------------------ lifecycle
	local sendConn = nil
	local function start(info: any)
		if app.closeLobby then
			app.closeLobby()
		end
		app.inNight = true
		app:close()
		local folder = Instance.new("Folder")
		folder.Name = "NightView"
		folder.Parent = workspace
		local sectors = workspace:FindFirstChild("NightSectors")
		local sector = nil
		if sectors then
			for _, f in sectors:GetChildren() do
				local lh = f:FindFirstChild("lighthouse")
				if lh and lh:IsA("BasePart") and (Vector3.new(lh.Position.X, 0, lh.Position.Z) - info.origin).Magnitude < 120 then
					sector = f
				end
			end
		end
		session = { origin = info.origin, studs = info.studs, squad = info.squad, onboarding = info.onboarding, folder = folder, sector = sector, interp = Interpolator.new(), enemies = {}, lastPos = {}, facing = {}, latest = nil }
		hud.Visible = true
		bind()
		renderConn = RunService.RenderStepped:Connect(render)
		local acc = 0
		sendConn = RunService.Heartbeat:Connect(function(dt)
			acc += dt
			if acc < 1 / SEND_RATE then
				return
			end
			acc = 0
			local character = player.Character
			local root = character and character:FindFirstChild("HumanoidRootPart")
			if root then
				local look = root.CFrame.LookVector
				input.aimX = math.clamp(look.X, -1, 1)
				input.aimY = math.clamp(-look.Z, -1, 1)
			end
			input.attack = pressFrames.attack > 0
			input.ability = pressFrames.ability > 0
			pressFrames.attack = math.max(0, pressFrames.attack - 1)
			pressFrames.ability = math.max(0, pressFrames.ability - 1)
			if input.repair then
				input.repair = nearestStructure()
			end
			remotes.NightInput:FireServer(input)
		end)
		app.StateChanged:Fire(app.state)
	end

	local function stop()
		unbind()
		if renderConn then
			renderConn:Disconnect()
		end
		if sendConn then
			sendConn:Disconnect()
		end
		if session then
			session.folder:Destroy()
		end
		session = nil
		bossPart = nil
		table.clear(telegraphParts)
		table.clear(weakParts)
		table.clear(crateParts)
		hud.Visible = false
		for _, r in squadRows do
			r.row:Destroy()
		end
		table.clear(squadRows)
		app.inNight = false
		app.StateChanged:Fire(app.state)
	end

	app.nightSquad = function()
		return session and session.squad or {}
	end

	remotes.NightSnapshot.OnClientEvent:Connect(onSnapshot)
	remotes.NightEvent.OnClientEvent:Connect(function(kind, data)
		if kind == "night_started" then
			start(data)
		elseif kind == "squad_formed" then
			app:toast(L("night_squad_formed", { count = #data.squad }))
		elseif kind == "sim_events" then
			for _, e in data do
				if e.name == "smuggler_chosen" and e.userId == player.UserId then
					app:toast(L("smuggler_chosen"))
				elseif e.name == "boss_stunned" then
					app:haptic(0.8)
				elseif e.name == "player_stunned" and e.userId == player.UserId then
					app:haptic(0.6)
				end
			end
		elseif kind == "night_result" then
			stop()
			app:open("nightResult", data)
		end
	end)
end

return NightClient
