--[[
	Builds the harbor and the night sectors. Every visual uses a named model from ReplicatedStorage.Assets
	when it exists (see ASSETS.md) and falls back to a simple placeholder part, so the game is playable
	before art arrives. Geometry stays low-poly and anchored, which keeps mobile frame rates high.
]]

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local WorldBuilder = {}

WorldBuilder.STUDS = 3 -- studs per simulation unit
WorldBuilder.SECTOR_ORIGINS = {
	Vector3.new(-160, 0, -200),
	Vector3.new(-40, 0, -200),
	Vector3.new(80, 0, -200),
	Vector3.new(200, 0, -200),
}
WorldBuilder.COVE_ORIGIN = Vector3.new(-160, 0, 400) -- tutorial nights, one cove per player
WorldBuilder.COVE_SPACING = 120
WorldBuilder.HARBOR_SPAWN = CFrame.new(0, 5, 40)

local assets = nil

local function part(props: any): BasePart
	local p = Instance.new("Part")
	p.Anchored = true
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	p.Material = Enum.Material.SmoothPlastic
	for k, v in props do
		(p :: any)[k] = v
	end
	return p
end

-- Clones the named asset if present, otherwise returns a placeholder part. Either way it is named `name`.
function WorldBuilder.place(assetName: string, cframe: CFrame, placeholder: any, parent: Instance): Instance
	local template = assets and assets:FindFirstChild(assetName)
	local inst
	if template then
		inst = template:Clone()
		if inst:IsA("Model") then
			inst:PivotTo(cframe)
		elseif inst:IsA("BasePart") then
			inst.CFrame = cframe
		end
	else
		placeholder.CFrame = cframe
		inst = part(placeholder)
	end
	inst.Name = assetName
	inst.Parent = parent
	return inst
end

function WorldBuilder.toWorld(origin: Vector3, x: number, y: number, height: number?): Vector3
	return origin + Vector3.new(x * WorldBuilder.STUDS, height or 3, -y * WorldBuilder.STUDS)
end

function WorldBuilder.toSim(origin: Vector3, position: Vector3): (number, number)
	return (position.X - origin.X) / WorldBuilder.STUDS, -(position.Z - origin.Z) / WorldBuilder.STUDS
end

function WorldBuilder.buildHarbor(cfg: any): Folder
	local folder = Instance.new("Folder")
	folder.Name = "Harbor"
	WorldBuilder.place("Harbor_Ground", CFrame.new(0, 0, 0), { Size = Vector3.new(300, 2, 200), Color = Color3.fromRGB(226, 205, 160), Material = Enum.Material.Sand }, folder)
	WorldBuilder.place("Harbor_Sea", CFrame.new(0, -1, -160), { Size = Vector3.new(600, 1, 160), Color = Color3.fromRGB(70, 140, 190), Transparency = 0.2, CanCollide = false }, folder)
	WorldBuilder.place("Harbor_Pier", CFrame.new(0, 2, -90), { Size = Vector3.new(12, 1, 60), Color = Color3.fromRGB(140, 100, 60), Material = Enum.Material.WoodPlanks }, folder)
	WorldBuilder.place("Harbor_MarketStall", CFrame.new(40, 4, 10), { Size = Vector3.new(16, 6, 10), Color = Color3.fromRGB(200, 90, 70) }, folder)
	WorldBuilder.place("Harbor_FarmPatch", CFrame.new(-50, 1.2, 20), { Size = Vector3.new(36, 0.4, 24), Color = Color3.fromRGB(110, 80, 50), Material = Enum.Material.Ground }, folder)
	local spawn = Instance.new("SpawnLocation")
	spawn.Name = "HarborSpawn"
	spawn.Anchored = true
	spawn.Size = Vector3.new(10, 1, 10)
	spawn.CFrame = WorldBuilder.HARBOR_SPAWN - Vector3.new(0, 4, 0)
	spawn.Transparency = 1
	spawn.CanCollide = true
	spawn.Neutral = true
	spawn.Parent = folder

	-- Shoreline forage nodes. The client shows each player's own respawn state on them.
	local nodes = Instance.new("Folder")
	nodes.Name = "ForageNodes"
	nodes.Parent = folder
	for i, node in cfg.day.foraging.nodes do
		local x = -120 + i * 34
		local p = WorldBuilder.place("Forage_" .. node.material, CFrame.new(x, 2, -70), { Size = Vector3.new(4, 2, 4), Color = Color3.fromRGB(160, 140, 110) }, nodes)
		p.Name = node.id
		local prompt = Instance.new("ProximityPrompt")
		prompt.Name = "Forage"
		prompt.ActionText = "Gather"
		prompt.ObjectText = node.material
		prompt.HoldDuration = 0.4
		prompt.RequiresLineOfSight = false
		prompt.Parent = if p:IsA("Model") then (p.PrimaryPart or p:FindFirstChildWhichIsA("BasePart")) else p
	end

	-- The five shared buildings. HarborService updates their tier attribute; visuals swap per tier.
	local buildings = Instance.new("Folder")
	buildings.Name = "Buildings"
	buildings.Parent = folder
	for i, b in cfg.harbor.buildings do
		local base = WorldBuilder.place("Building_" .. b.id .. "_T1", CFrame.new(-100 + i * 40, 6, 70), { Size = Vector3.new(14, 10, 14), Color = Color3.fromRGB(230, 230, 220) }, buildings)
		base.Name = b.id
		base:SetAttribute("Tier", 1)
	end
	folder.Parent = workspace
	return folder
end

-- Updates building visuals when the shared harbor reaches a new tier.
function WorldBuilder.applyHarborTiers(tiers: { [string]: number })
	local buildings = workspace:FindFirstChild("Harbor") and workspace.Harbor:FindFirstChild("Buildings")
	if not buildings then
		return
	end
	for id, tier in tiers do
		local b = buildings:FindFirstChild(id)
		if b and b:GetAttribute("Tier") ~= tier then
			local pivot = if b:IsA("Model") then b:GetPivot() else b.CFrame
			local template = assets and assets:FindFirstChild("Building_" .. id .. "_T" .. tier)
			if template then
				local new = template:Clone()
				new:PivotTo(pivot)
				new.Name = id
				new:SetAttribute("Tier", tier)
				new.Parent = buildings
				b:Destroy()
			elseif b:IsA("BasePart") then
				-- Placeholder: taller and brighter per tier.
				b.Size = Vector3.new(14, 10 + (tier - 1) * 4, 14)
				b.CFrame = CFrame.new(pivot.Position.X, (10 + (tier - 1) * 4) / 2 + 1, pivot.Position.Z)
				b.Color = Color3.fromRGB(230, 230 - tier * 12, 220 - tier * 25)
				b:SetAttribute("Tier", tier)
			end
		end
	end
end

-- One squad sector: sea, beach, structures. Returns the folder; structure parts are named by id.
function WorldBuilder.buildSector(cfg: any, name: string, origin: Vector3): Folder
	local n = cfg.night
	local S = WorldBuilder.STUDS
	local folder = Instance.new("Folder")
	folder.Name = name
	local w, h = n.sector.width * S, n.sector.height * S
	local center = origin + Vector3.new(w / 2, 0, -h / 2)
	WorldBuilder.place("Sector_Ground", CFrame.new(center.X, 0, center.Z + h * 0.15), { Size = Vector3.new(w + 12, 2, h * 0.75), Color = Color3.fromRGB(214, 196, 150), Material = Enum.Material.Sand }, folder)
	WorldBuilder.place("Sector_Sea", CFrame.new(center.X, -0.5, origin.Z - n.sector.seawallY * S - h * 0.2), { Size = Vector3.new(w + 12, 1, h * 0.6), Color = Color3.fromRGB(40, 90, 140), Transparency = 0.15, CanCollide = false }, folder)
	-- Invisible walls keep players inside the sector so squads never mix.
	for _, wall in {
		{ Vector3.new(origin.X - 3, 10, center.Z), Vector3.new(2, 20, h + 12) },
		{ Vector3.new(origin.X + w + 3, 10, center.Z), Vector3.new(2, 20, h + 12) },
		{ Vector3.new(center.X, 10, origin.Z + 3), Vector3.new(w + 12, 20, 2) },
		{ Vector3.new(center.X, 10, origin.Z - n.sector.playerMaxY * S - 2), Vector3.new(w + 12, 20, 2) },
	} do
		local p = part({ Size = wall[2], Transparency = 1, CanCollide = true })
		p.CFrame = CFrame.new(wall[1])
		p.Name = "Bound"
		p.Parent = folder
	end
	for _, s in n.structures do
		local pos = WorldBuilder.toWorld(origin, s.x, s.y, 0)
		local size
		if s.id == "seawall" then
			size = Vector3.new(w, 6, 2)
			pos = Vector3.new(center.X, 3, pos.Z)
		elseif s.id == "lighthouse" then
			size = Vector3.new(s.radius * 2 * S, 24, s.radius * 2 * S)
			pos += Vector3.new(0, 12, 0)
		else
			size = Vector3.new(s.radius * 2 * S, 2, s.radius * 3 * S)
			pos += Vector3.new(0, 1, 0)
		end
		local inst = WorldBuilder.place("Structure_" .. s.id, CFrame.new(pos), { Size = size, Color = Color3.fromRGB(240, 240, 235) }, folder)
		inst.Name = s.id
		inst:SetAttribute("Stage", 0)
	end
	folder.Parent = workspace:FindFirstChild("NightSectors") or (function()
		local f = Instance.new("Folder")
		f.Name = "NightSectors"
		f.Parent = workspace
		return f
	end)()
	return folder
end

function WorldBuilder.init()
	assets = ReplicatedStorage:FindFirstChild("Assets")
end

return WorldBuilder
