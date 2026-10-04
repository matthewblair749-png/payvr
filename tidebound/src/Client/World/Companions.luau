--[[
	Every player's active Drifters follow them around the harbor, bobbing along behind like pets.
	The server publishes each player's active species in the "Drifters" attribute; every client renders them,
	so players see each other's collections.
]]

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")

local Creatures = require(script.Parent.Creatures)
local Theme = require(script.Parent.Parent.Ui.Theme)

local Companions = {}

local MAX_PER_PLAYER = 4

function Companions.mount(app: any)
	local folder = Instance.new("Folder")
	folder.Name = "Companions"
	folder.Parent = workspace
	local byPlayer: { [Player]: { key: string, models: { Model }, positions: { Vector3 } } } = {}

	local function rebuild(player: Player)
		local entry = byPlayer[player]
		local key = player:GetAttribute("Drifters") or ""
		if entry and entry.key == key then
			return
		end
		if entry then
			for _, m in entry.models do
				m:Destroy()
			end
		end
		entry = { key = key, models = {}, positions = {} }
		byPlayer[player] = entry
		local i = 0
		for speciesId in string.gmatch(key, "[^,]+") do
			i += 1
			if i > MAX_PER_PLAYER then
				break
			end
			if app.cfg.index.species[speciesId] then
				local m = Creatures.drifter(app.cfg, speciesId)
				m.Parent = folder
				table.insert(entry.models, m)
				table.insert(entry.positions, Vector3.zero)
			end
		end
	end

	local function track(player: Player)
		rebuild(player)
		player:GetAttributeChangedSignal("Drifters"):Connect(function()
			rebuild(player)
		end)
	end
	for _, p in Players:GetPlayers() do
		track(p)
	end
	Players.PlayerAdded:Connect(track)
	Players.PlayerRemoving:Connect(function(p)
		local entry = byPlayer[p]
		if entry then
			for _, m in entry.models do
				m:Destroy()
			end
		end
		byPlayer[p] = nil
	end)

	RunService.RenderStepped:Connect(function(dt)
		local t = os.clock()
		for player, entry in byPlayer do
			local root = player.Character and player.Character:FindFirstChild("HumanoidRootPart")
			for i, m in entry.models do
				if root and m.PrimaryPart then
					-- Fan out behind the owner, then ease toward the slot.
					local side = (i % 2 == 0) and 1 or -1
					local row = math.ceil(i / 2)
					local slot = (root.CFrame * CFrame.new(side * 3.2 * row, -1.2, 4 + row * 2.5)).Position
					local current = entry.positions[i]
					if current.Magnitude == 0 or (current - slot).Magnitude > 60 then
						current = slot
					end
					current = current:Lerp(slot, math.min(1, dt * 6))
					entry.positions[i] = current
					local bob = if Theme.reducedMotion then 0 else math.sin(t * 5 + i) * 0.35
					local look = (root.Position - current) * Vector3.new(1, 0, 1)
					local facing = if look.Magnitude > 0.1 then CFrame.lookAt(current, current + look) else CFrame.new(current)
					m:PivotTo(facing + Vector3.new(0, bob, 0))
				end
			end
		end
	end)
end

return Companions
