--[[
	Builds the harbor island and the night beaches from terrain and parts, so the game looks finished
	before any art is uploaded. If ReplicatedStorage.Assets holds a model with a listed name (ASSETS.md),
	that model replaces the built version.

	Gameplay code depends only on these names: Harbor.HarborSpawn, Harbor.ForageNodes.<nodeId> (a BasePart
	holding a ProximityPrompt), Harbor.Buildings.<buildingId> (Tier attribute), and in every night sector the
	BaseParts "lighthouse", "seawall" and "dock" (Stage attribute; the client tints them by damage stage).
	Everything is anchored and most decoration casts no shadow, to keep phones at 60 FPS.
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
WorldBuilder.COVE_ORIGIN = Vector3.new(-160, 0, 420) -- tutorial nights, one cove per player
WorldBuilder.COVE_SPACING = 120
WorldBuilder.HARBOR_SPAWN = CFrame.new(0, 8, 40)

local GROUND_Y = 4 -- top of the island's grass

local assets = nil

local PALETTE = {
	wood = Color3.fromRGB(160, 110, 68),
	woodDark = Color3.fromRGB(112, 74, 44),
	white = Color3.fromRGB(248, 246, 240),
	red = Color3.fromRGB(226, 70, 64),
	stone = Color3.fromRGB(150, 154, 160),
	stoneDark = Color3.fromRGB(104, 110, 120),
	leaf = Color3.fromRGB(70, 176, 84),
	trunk = Color3.fromRGB(150, 108, 70),
	lamp = Color3.fromRGB(255, 214, 140),
	roofs = { Color3.fromRGB(80, 160, 230), Color3.fromRGB(240, 120, 90), Color3.fromRGB(120, 200, 120), Color3.fromRGB(250, 196, 70), Color3.fromRGB(180, 120, 230) },
	walls = { Color3.fromRGB(255, 244, 220), Color3.fromRGB(240, 250, 255), Color3.fromRGB(255, 236, 236), Color3.fromRGB(236, 255, 236), Color3.fromRGB(246, 240, 255) },
}

-- ---------------------------------------------------------------- primitives

local function part(parent: Instance, props: any): BasePart
	local p = Instance.new(props.ClassName or "Part")
	props.ClassName = nil
	p.Anchored = true
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	p.Material = Enum.Material.SmoothPlastic
	p.CastShadow = false
	for k, v in props do
		(p :: any)[k] = v
	end
	p.Parent = parent
	return p
end

local function cylinder(parent: Instance, cf: CFrame, height: number, diameter: number, props: any): BasePart
	props.Shape = Enum.PartType.Cylinder
	props.Size = Vector3.new(height, diameter, diameter)
	props.CFrame = cf * CFrame.Angles(0, 0, math.rad(90)) -- cylinder axis is X; stand it up
	return part(parent, props)
end

local function light(parent: Instance, brightness: number, range: number, color: Color3?)
	local l = Instance.new("PointLight")
	l.Brightness = brightness
	l.Range = range
	l.Color = color or PALETTE.lamp
	l.Shadows = false
	l.Parent = parent
	return l
end

-- Terrain calls are wrapped: terrain is decoration, never a reason to stop the server.
local function terrain(method: string, ...: any)
	local t = workspace:FindFirstChildOfClass("Terrain")
	if t then
		local args = table.pack(...)
		pcall(function()
			(t :: any)[method](t, table.unpack(args, 1, args.n))
		end)
	end
end

local function model(parent: Instance, name: string): Model
	local m = Instance.new("Model")
	m.Name = name
	m.Parent = parent
	return m
end

-- Uses an uploaded asset when one exists with this name; otherwise runs the builder.
local function placeAsset(assetName: string, cframe: CFrame, parent: Instance, build: (Model) -> ()): Instance
	local template = assets and assets:FindFirstChild(assetName)
	if template then
		local inst = template:Clone()
		if inst:IsA("Model") then
			inst:PivotTo(cframe)
		elseif inst:IsA("BasePart") then
			inst.CFrame = cframe
		end
		inst.Parent = parent
		return inst
	end
	local m = model(parent, assetName)
	build(m)
	return m
end

-- ---------------------------------------------------------------- props

local function palmTree(parent: Instance, base: Vector3, height: number, lean: number)
	local m = model(parent, "PalmTree")
	local segments = 6
	local pos = base
	for i = 1, segments do
		local step = height / segments
		local offset = Vector3.new(lean * i * 0.35, step, 0)
		local mid = pos + offset / 2
		local seg = part(m, { Size = Vector3.new(1.6 - i * 0.08, step + 0.3, 1.6 - i * 0.08), CFrame = CFrame.lookAt(mid, mid + offset) * CFrame.Angles(math.rad(90), 0, 0), Color = if i % 2 == 0 then PALETTE.trunk else PALETTE.woodDark, Material = Enum.Material.Wood, CastShadow = true })
		seg.Name = "Trunk"
		pos += offset
	end
	for i = 1, 7 do
		local angle = math.rad(i * (360 / 7))
		local dir = Vector3.new(math.cos(angle), 0, math.sin(angle))
		local leafCenter = pos + dir * 3.2 - Vector3.new(0, 0.8, 0)
		part(m, { ClassName = "WedgePart", Size = Vector3.new(1.6, 0.5, 7), CFrame = CFrame.lookAt(leafCenter, leafCenter + dir) * CFrame.Angles(math.rad(-18), 0, 0), Color = PALETTE.leaf:Lerp(Color3.fromRGB(40, 140, 60), (i % 3) / 3), Material = Enum.Material.Grass, CastShadow = true })
	end
	for i = 1, 3 do
		local a = math.rad(i * 120)
		part(m, { Shape = Enum.PartType.Ball, Size = Vector3.new(1.1, 1.1, 1.1), CFrame = CFrame.new(pos + Vector3.new(math.cos(a) * 0.8, -0.8, math.sin(a) * 0.8)), Color = Color3.fromRGB(110, 80, 50) })
	end
end

local function lantern(parent: Instance, at: Vector3)
	local m = model(parent, "Lantern")
	cylinder(m, CFrame.new(at + Vector3.new(0, 3, 0)), 6, 0.5, { Color = PALETTE.woodDark, Material = Enum.Material.Wood })
	part(m, { Size = Vector3.new(1.4, 0.3, 1.4), CFrame = CFrame.new(at + Vector3.new(0, 6.1, 0)), Color = PALETTE.woodDark })
	local glow = part(m, { Size = Vector3.new(1, 1.2, 1), CFrame = CFrame.new(at + Vector3.new(0, 6.9, 0)), Color = PALETTE.lamp, Material = Enum.Material.Neon })
	part(m, { ClassName = "WedgePart", Size = Vector3.new(1.6, 0.6, 0.8), CFrame = CFrame.new(at + Vector3.new(0, 7.8, 0.4)), Color = PALETTE.woodDark })
	part(m, { ClassName = "WedgePart", Size = Vector3.new(1.6, 0.6, 0.8), CFrame = CFrame.new(at + Vector3.new(0, 7.8, -0.4)) * CFrame.Angles(0, math.rad(180), 0), Color = PALETTE.woodDark })
	light(glow, 1.6, 18)
end

local function crate(parent: Instance, at: Vector3, size: number, color: Color3?)
	part(parent, { Size = Vector3.new(size, size, size), CFrame = CFrame.new(at + Vector3.new(0, size / 2, 0)) * CFrame.Angles(0, math.rad((at.X * 37) % 40), 0), Color = color or PALETTE.wood, Material = Enum.Material.WoodPlanks, CastShadow = true })
end

local function barrel(parent: Instance, at: Vector3)
	cylinder(parent, CFrame.new(at + Vector3.new(0, 1.4, 0)), 2.8, 2.2, { Color = PALETTE.woodDark, Material = Enum.Material.Wood, CastShadow = true })
	cylinder(parent, CFrame.new(at + Vector3.new(0, 0.6, 0)), 0.25, 2.3, { Color = PALETTE.stoneDark, Material = Enum.Material.Metal })
	cylinder(parent, CFrame.new(at + Vector3.new(0, 2.2, 0)), 0.25, 2.3, { Color = PALETTE.stoneDark, Material = Enum.Material.Metal })
end

-- Striped red and white lighthouse tower with a glowing lamp room.
local function lighthouseTower(parent: Instance, base: Vector3, height: number, radius: number): BasePart
	local bands = 6
	local main
	for i = 1, bands do
		local h = height / bands
		local r = radius * (1 - (i - 1) * 0.06)
		local p = cylinder(parent, CFrame.new(base + Vector3.new(0, h * (i - 0.5), 0)), h, r * 2, { Color = if i % 2 == 1 then PALETTE.white else PALETTE.red, CastShadow = true })
		if i == 1 then
			main = p
		end
	end
	local top = base + Vector3.new(0, height, 0)
	cylinder(parent, CFrame.new(top + Vector3.new(0, 0.3, 0)), 0.6, radius * 2.2, { Color = PALETTE.stoneDark, Material = Enum.Material.Metal })
	local lamp = cylinder(parent, CFrame.new(top + Vector3.new(0, 2, 0)), 3, radius * 1.3, { Color = PALETTE.lamp, Material = Enum.Material.Neon })
	part(parent, { Shape = Enum.PartType.Ball, Size = Vector3.new(radius * 1.6, radius * 1.2, radius * 1.6), CFrame = CFrame.new(top + Vector3.new(0, 3.8, 0)), Color = PALETTE.red })
	light(lamp, 3, 40)
	local beam = Instance.new("SpotLight")
	beam.Name = "Beam"
	beam.Brightness = 6
	beam.Range = 60
	beam.Angle = 30
	beam.Color = PALETTE.lamp
	beam.Face = Enum.NormalId.Front
	beam.Parent = lamp
	return main
end

-- Cottage for a shared harbor building; taller with more floors and flags at higher tiers.
local function cottage(m: Model, index: number, tier: number, pivot: CFrame)
	local wallColor = PALETTE.walls[(index - 1) % #PALETTE.walls + 1]
	local roofColor = PALETTE.roofs[(index - 1) % #PALETTE.roofs + 1]
	local floors = math.min(3, 1 + math.floor((tier - 1) / 2))
	local width = 16 + tier
	local floorH = 9
	local walls = part(m, { Name = "Walls", Size = Vector3.new(width, floorH * floors, 14), CFrame = pivot * CFrame.new(0, floorH * floors / 2, 0), Color = wallColor, CastShadow = true })
	m.PrimaryPart = walls
	-- Timber trim
	for _, x in { -width / 2 + 0.3, width / 2 - 0.3 } do
		part(m, { Size = Vector3.new(0.8, floorH * floors, 14.4), CFrame = pivot * CFrame.new(x, floorH * floors / 2, 0), Color = PALETTE.woodDark })
	end
	-- Pitched roof from two wedges
	local roofH = 6 + tier * 0.6
	local roofY = floorH * floors + roofH / 2
	part(m, { ClassName = "WedgePart", Size = Vector3.new(width + 2, roofH, 8.5), CFrame = pivot * CFrame.new(0, roofY, -3.75), Color = roofColor, CastShadow = true })
	part(m, { ClassName = "WedgePart", Size = Vector3.new(width + 2, roofH, 8.5), CFrame = pivot * CFrame.new(0, roofY, 3.75) * CFrame.Angles(0, math.rad(180), 0), Color = roofColor, CastShadow = true })
	-- Door and windows (windows glow at night through bloom)
	part(m, { Size = Vector3.new(3.6, 6, 0.4), CFrame = pivot * CFrame.new(0, 3, -7.1), Color = PALETTE.woodDark, Material = Enum.Material.Wood })
	for f = 1, floors do
		for _, x in { -width / 3, width / 3 } do
			part(m, { Size = Vector3.new(3, 3, 0.3), CFrame = pivot * CFrame.new(x, (f - 0.5) * floorH + 0.5, -7.1), Color = PALETTE.lamp, Material = Enum.Material.Neon, Transparency = 0.15 })
		end
	end
	-- Tier flags on the roof ridge
	for t = 2, tier do
		local x = -width / 2 + (t - 1) * (width / tier)
		cylinder(m, pivot * CFrame.new(x, roofY + roofH / 2 + 2, 0), 4, 0.3, { Color = PALETTE.woodDark })
		part(m, { Size = Vector3.new(0.15, 1.4, 2.2), CFrame = pivot * CFrame.new(x, roofY + roofH / 2 + 3.4, 1.1), Color = roofColor:Lerp(Color3.new(1, 1, 1), 0.2) })
	end
	-- Sign board
	part(m, { Size = Vector3.new(6, 1.6, 0.4), CFrame = pivot * CFrame.new(0, 7.2, -7.3), Color = PALETTE.wood, Material = Enum.Material.Wood })
end

local function marketStall(parent: Instance, at: CFrame)
	local m = model(parent, "Harbor_MarketStall")
	part(m, { Size = Vector3.new(16, 3.4, 5), CFrame = at * CFrame.new(0, 1.7, 0), Color = PALETTE.wood, Material = Enum.Material.WoodPlanks, CastShadow = true })
	for _, x in { -7.5, 7.5 } do
		for _, z in { -2.2, 4 } do
			cylinder(m, at * CFrame.new(x, 4.5, z), 9, 0.6, { Color = PALETTE.woodDark, Material = Enum.Material.Wood })
		end
	end
	-- Striped awning
	for i = 0, 7 do
		part(m, { ClassName = "WedgePart", Size = Vector3.new(2, 1.6, 8), CFrame = at * CFrame.new(-7 + i * 2, 9.6, 1) * CFrame.Angles(0, math.rad(180), 0), Color = if i % 2 == 0 then PALETTE.red else PALETTE.white, CastShadow = true })
	end
	-- Goods on the counter
	for i = 0, 4 do
		part(m, { Shape = Enum.PartType.Ball, Size = Vector3.new(1.2, 1.2, 1.2), CFrame = at * CFrame.new(-5 + i * 2.4, 3.9, 0), Color = ({ Color3.fromRGB(255, 150, 60), Color3.fromRGB(120, 210, 90), Color3.fromRGB(255, 220, 80), Color3.fromRGB(110, 190, 255), Color3.fromRGB(240, 100, 120) })[i + 1] })
	end
	crate(m, (at * CFrame.new(-10, 0, 1)).Position, 2.6)
	crate(m, (at * CFrame.new(-10.5, 2.6, 1.3)).Position, 1.8, Color3.fromRGB(190, 140, 90))
	barrel(m, (at * CFrame.new(10, 0, 0)).Position)
	return m
end

local function pier(parent: Instance, startAt: Vector3, length: number)
	local m = model(parent, "Harbor_Pier")
	local deckY = 3.2
	for i = 0, math.floor(length / 2) - 1 do
		part(m, { Size = Vector3.new(12, 0.6, 1.8), CFrame = CFrame.new(startAt + Vector3.new(0, deckY, -i * 2 - 1)), Color = if i % 2 == 0 then PALETTE.wood else PALETTE.wood:Lerp(PALETTE.woodDark, 0.25), Material = Enum.Material.WoodPlanks, CastShadow = true })
	end
	for i = 0, math.floor(length / 10) do
		for _, x in { -5.6, 5.6 } do
			cylinder(m, CFrame.new(startAt + Vector3.new(x, deckY - 3, -i * 10)), 8, 1, { Color = PALETTE.woodDark, Material = Enum.Material.Wood })
		end
	end
	for _, x in { -5.8, 5.8 } do
		part(m, { Size = Vector3.new(0.4, 0.4, length), CFrame = CFrame.new(startAt + Vector3.new(x, deckY + 2.4, -length / 2)), Color = PALETTE.woodDark })
	end
	lantern(m, startAt + Vector3.new(5, deckY, -length + 2))
	lantern(m, startAt + Vector3.new(-5, deckY, -length / 2))
	-- Two rowboats tied up beside the pier
	for i, x in { -12, 12 } do
		local boat = model(m, "Rowboat")
		local c = CFrame.new(startAt + Vector3.new(x, 0.6, -length * (0.4 + i * 0.2)))
		part(boat, { Size = Vector3.new(4, 1.4, 9), CFrame = c, Color = ({ Color3.fromRGB(80, 150, 220), Color3.fromRGB(230, 110, 80) })[i], CastShadow = true })
		part(boat, { ClassName = "WedgePart", Size = Vector3.new(4, 1.4, 3), CFrame = c * CFrame.new(0, 0, -6), Color = ({ Color3.fromRGB(80, 150, 220), Color3.fromRGB(230, 110, 80) })[i] })
		part(boat, { Size = Vector3.new(3.6, 0.3, 1), CFrame = c * CFrame.new(0, 0.6, 0), Color = PALETTE.wood })
	end
	return m
end

local function farmPatch(parent: Instance, center: Vector3)
	local m = model(parent, "Harbor_FarmPatch")
	for row = 0, 2 do
		for col = 0, 5 do
			local pos = center + Vector3.new(-15 + col * 6, 0.4, -6 + row * 6)
			part(m, { Size = Vector3.new(5, 0.8, 5), CFrame = CFrame.new(pos), Color = Color3.fromRGB(110, 76, 48), Material = Enum.Material.Ground })
			-- Little sprouts so the farm reads as a farm from a distance.
			if row < 2 then
				part(m, { ClassName = "WedgePart", Size = Vector3.new(0.3, 1.2, 0.8), CFrame = CFrame.new(pos + Vector3.new(0, 1, 0)), Color = PALETTE.leaf })
			end
		end
	end
	local w, d = 38, 22
	for i = 0, 18 do
		local x = -w / 2 + i * (w / 18)
		for _, z in { -d / 2, d / 2 } do
			part(m, { Size = Vector3.new(0.5, 2.4, 0.5), CFrame = CFrame.new(center + Vector3.new(x, 1.2, z)), Color = PALETTE.white })
		end
	end
	for _, z in { -d / 2, d / 2 } do
		part(m, { Size = Vector3.new(w, 0.3, 0.3), CFrame = CFrame.new(center + Vector3.new(0, 1.8, z)), Color = PALETTE.white })
	end
	return m
end

local FORAGE_LOOK = {
	driftwood = function(base: BasePart, m: Instance)
		for i = 1, 3 do
			local a = math.rad(i * 70)
			cylinder(m, base.CFrame * CFrame.new(math.cos(a) * 0.6, 0.6 + (i - 1) * 0.7, 0) * CFrame.Angles(0, a, math.rad(90)), 5 - i * 0.6, 0.9, { Color = Color3.fromRGB(176, 150, 118), Material = Enum.Material.Wood })
		end
	end,
	shells = function(base: BasePart, m: Instance)
		for i = 1, 6 do
			local a = math.rad(i * 60)
			part(m, { Shape = Enum.PartType.Ball, Size = Vector3.new(1.2, 0.7, 1.2), CFrame = base.CFrame * CFrame.new(math.cos(a) * 1.2, 0.4, math.sin(a) * 1.2), Color = ({ Color3.fromRGB(255, 200, 210), Color3.fromRGB(255, 236, 200), Color3.fromRGB(220, 240, 255) })[i % 3 + 1] })
		end
	end,
	ironScrap = function(base: BasePart, m: Instance)
		for i = 1, 4 do
			part(m, { Size = Vector3.new(1.6, 0.8, 1.1), CFrame = base.CFrame * CFrame.new((i - 2.5) * 0.9, 0.4 + (i % 2) * 0.6, 0) * CFrame.Angles(0, math.rad(i * 40), math.rad(i * 15)), Color = Color3.fromRGB(120, 116, 112), Material = Enum.Material.CorrodedMetal })
		end
	end,
}

-- ---------------------------------------------------------------- coordinate helpers

function WorldBuilder.toWorld(origin: Vector3, x: number, y: number, height: number?): Vector3
	return origin + Vector3.new(x * WorldBuilder.STUDS, height or 3, -y * WorldBuilder.STUDS)
end

function WorldBuilder.toSim(origin: Vector3, position: Vector3): (number, number)
	return (position.X - origin.X) / WorldBuilder.STUDS, -(position.Z - origin.Z) / WorldBuilder.STUDS
end

-- ---------------------------------------------------------------- harbor

function WorldBuilder.buildHarbor(cfg: any): Folder
	local folder = Instance.new("Folder")
	folder.Name = "Harbor"

	-- Sea everywhere, an island of sand with a grassy town on top, and rocks on the shore.
	terrain("FillBlock", CFrame.new(0, -10, 0), Vector3.new(1400, 20, 1400), Enum.Material.Water)
	terrain("FillCylinder", CFrame.new(0, -4, 0), 12, 175, Enum.Material.Sand)
	terrain("FillCylinder", CFrame.new(0, 0, 10), 8, 130, Enum.Material.Grass)
	terrain("FillCylinder", CFrame.new(0, 3, 30), 2, 40, Enum.Material.Cobblestone)
	for i = 1, 14 do
		local a = math.rad(i * (360 / 14) + 9)
		terrain("FillBall", Vector3.new(math.cos(a) * 168, 0, math.sin(a) * 168), 7 + (i % 3) * 3, Enum.Material.Rock)
	end
	-- Lighthouse point
	terrain("FillCylinder", CFrame.new(-150, -2, -110), 14, 22, Enum.Material.Rock)
	-- A raised walkway for the pier start
	terrain("FillBlock", CFrame.new(0, 1, -150), Vector3.new(14, 4, 30), Enum.Material.Sand)

	-- Always-present ground part so characters never fall if terrain is unavailable (hidden under the grass).
	local ground = cylinder(folder, CFrame.new(0, GROUND_Y - 1.2, 10), 2, 256, { Transparency = 1, CanCollide = true })
	ground.Name = "Harbor_Ground"

	local spawn = Instance.new("SpawnLocation")
	spawn.Name = "HarborSpawn"
	spawn.Anchored = true
	spawn.Size = Vector3.new(12, 1, 12)
	spawn.CFrame = CFrame.new(0, GROUND_Y, 40)
	spawn.Transparency = 1
	spawn.CanCollide = true
	spawn.Neutral = true
	spawn.Duration = 0
	spawn.Parent = folder

	-- Plaza fountain at the spawn
	local plaza = model(folder, "Plaza")
	cylinder(plaza, CFrame.new(0, GROUND_Y + 0.8, 18), 1.6, 14, { Color = PALETTE.stone, Material = Enum.Material.Cobblestone, CastShadow = true })
	cylinder(plaza, CFrame.new(0, GROUND_Y + 1.5, 18), 0.4, 12, { Color = Color3.fromRGB(90, 190, 240), Material = Enum.Material.Glass, Transparency = 0.2 })
	cylinder(plaza, CFrame.new(0, GROUND_Y + 3.5, 18), 4, 2, { Color = PALETTE.stone, Material = Enum.Material.Cobblestone })
	local spout = part(plaza, { Shape = Enum.PartType.Ball, Size = Vector3.new(3, 3, 3), CFrame = CFrame.new(0, GROUND_Y + 6, 18), Color = Color3.fromRGB(120, 210, 255), Material = Enum.Material.Glass, Transparency = 0.3 })
	local water = Instance.new("ParticleEmitter")
	water.Color = ColorSequence.new(Color3.fromRGB(190, 235, 255))
	water.LightEmission = 0.4
	water.Size = NumberSequence.new(0.5, 0.1)
	water.Speed = NumberRange.new(6, 8)
	water.SpreadAngle = Vector2.new(25, 25)
	water.Acceleration = Vector3.new(0, -18, 0)
	water.Lifetime = NumberRange.new(0.8, 1.1)
	water.Rate = 30
	water.Transparency = NumberSequence.new(0.2, 1)
	water.Parent = spout

	if assets and assets:FindFirstChild("Harbor_Pier") then
		placeAsset("Harbor_Pier", CFrame.new(0, 0, -166), folder, function() end)
	else
		pier(folder, Vector3.new(0, 0, -136), 60)
	end
	if not (assets and assets:FindFirstChild("Harbor_MarketStall")) then
		marketStall(folder, CFrame.new(42, GROUND_Y, 8) * CFrame.Angles(0, math.rad(-20), 0))
	else
		placeAsset("Harbor_MarketStall", CFrame.new(42, GROUND_Y, 8), folder, function() end)
	end
	if not (assets and assets:FindFirstChild("Harbor_FarmPatch")) then
		farmPatch(folder, Vector3.new(-52, GROUND_Y, 14))
	else
		placeAsset("Harbor_FarmPatch", CFrame.new(-52, GROUND_Y, 14), folder, function() end)
	end

	-- Landmark lighthouse on the rocky point
	local landmark = model(folder, "Landmark_Lighthouse")
	lighthouseTower(landmark, Vector3.new(-150, 5, -110), 46, 5)

	-- Palms, lanterns and crates around town
	local deco = model(folder, "Decor")
	for i, spot in {
		Vector3.new(-90, GROUND_Y, -40), Vector3.new(-70, GROUND_Y, -70), Vector3.new(80, GROUND_Y, -50), Vector3.new(100, GROUND_Y, -20),
		Vector3.new(-110, GROUND_Y, 40), Vector3.new(115, GROUND_Y, 50), Vector3.new(30, GROUND_Y, -80), Vector3.new(-30, GROUND_Y, -85),
		Vector3.new(60, GROUND_Y, 100), Vector3.new(-60, GROUND_Y, 105),
	} do
		palmTree(deco, spot, 14 + (i % 3) * 3, if i % 2 == 0 then 0.6 else -0.6)
	end
	for _, spot in { Vector3.new(14, GROUND_Y, 30), Vector3.new(-14, GROUND_Y, 30), Vector3.new(14, GROUND_Y, -10), Vector3.new(-14, GROUND_Y, -10), Vector3.new(8, GROUND_Y, -60), Vector3.new(-8, GROUND_Y, -60) } do
		lantern(deco, spot)
	end
	for i = 1, 4 do
		crate(deco, Vector3.new(20 + i * 3, GROUND_Y, -98 + (i % 2) * 2), 2.4)
	end
	barrel(deco, Vector3.new(-18, GROUND_Y, -96))
	barrel(deco, Vector3.new(-21, GROUND_Y, -94))

	-- Shoreline forage nodes. The client shows each player's own respawn timer on them.
	local nodes = Instance.new("Folder")
	nodes.Name = "ForageNodes"
	nodes.Parent = folder
	for i, node in cfg.day.foraging.nodes do
		local a = math.rad(200 + i * 22)
		local pos = Vector3.new(math.cos(a) * 140, 2.4, math.sin(a) * 140)
		local base = part(nodes, { Name = node.id, Size = Vector3.new(5, 1, 5), CFrame = CFrame.new(pos), Transparency = 1, CanCollide = false })
		local template = assets and assets:FindFirstChild("Forage_" .. node.material)
		if template then
			local inst = template:Clone()
			inst:PivotTo(base.CFrame)
			inst.Parent = base
		else
			FORAGE_LOOK[node.material](base, base)
		end
		local sparkle = Instance.new("Sparkles")
		sparkle.SparkleColor = Color3.fromRGB(255, 240, 160)
		sparkle.Parent = base
		local prompt = Instance.new("ProximityPrompt")
		prompt.Name = "Forage"
		prompt.ActionText = "Gather"
		prompt.ObjectText = node.material
		prompt.HoldDuration = 0.4
		prompt.RequiresLineOfSight = false
		prompt.MaxActivationDistance = 12
		prompt.Parent = base
	end

	-- The five shared buildings. HarborService updates their tier; visuals rebuild per tier.
	local buildings = Instance.new("Folder")
	buildings.Name = "Buildings"
	buildings.Parent = folder
	for i, b in cfg.harbor.buildings do
		WorldBuilder.buildBuilding(buildings, b.id, i, 1)
	end
	folder.Parent = workspace
	return folder
end

local BUILDING_PIVOTS = {
	CFrame.new(-80, GROUND_Y, 70) * CFrame.Angles(0, math.rad(200), 0),
	CFrame.new(-40, GROUND_Y, 82) * CFrame.Angles(0, math.rad(190), 0),
	CFrame.new(0, GROUND_Y, 88) * CFrame.Angles(0, math.rad(180), 0),
	CFrame.new(40, GROUND_Y, 82) * CFrame.Angles(0, math.rad(170), 0),
	CFrame.new(80, GROUND_Y, 70) * CFrame.Angles(0, math.rad(160), 0),
}

function WorldBuilder.buildBuilding(parent: Instance, id: string, index: number, tier: number): Instance
	local pivot = BUILDING_PIVOTS[(index - 1) % #BUILDING_PIVOTS + 1]
	local template = assets and assets:FindFirstChild("Building_" .. id .. "_T" .. tier)
	local inst
	if template then
		inst = template:Clone()
		inst:PivotTo(pivot)
	else
		inst = Instance.new("Model")
		cottage(inst, index, tier, pivot)
	end
	inst.Name = id
	inst:SetAttribute("Tier", tier)
	inst:SetAttribute("Index", index)
	inst.Parent = parent
	return inst
end

-- Rebuilds buildings whose shared tier changed.
function WorldBuilder.applyHarborTiers(tiers: { [string]: number })
	local harbor = workspace:FindFirstChild("Harbor")
	local buildings = harbor and harbor:FindFirstChild("Buildings")
	if not buildings then
		return
	end
	for id, tier in tiers do
		local b = buildings:FindFirstChild(id)
		if b and b:GetAttribute("Tier") ~= tier then
			local index = b:GetAttribute("Index") or 1
			b:Destroy()
			WorldBuilder.buildBuilding(buildings, id, index, tier)
		end
	end
end

-- ---------------------------------------------------------------- night sectors

--[[
	One squad's beach: sand from the lighthouse to the seawall, open sea beyond it, a wooden dock
	reaching into the water, and invisible walls so squads never mix.
]]
function WorldBuilder.buildSector(cfg: any, name: string, origin: Vector3): Folder
	local n = cfg.night
	local S = WorldBuilder.STUDS
	local folder = Instance.new("Folder")
	folder.Name = name
	local w, h = n.sector.width * S, n.sector.height * S
	local center = origin + Vector3.new(w / 2, 0, -h / 2)
	local wallZ = origin.Z - n.sector.seawallY * S

	-- Beach (land side of the seawall) and sea (beyond it)
	local landDepth = n.sector.seawallY * S + 6
	terrain("FillBlock", CFrame.new(center.X, -3, origin.Z - landDepth / 2 + 6), Vector3.new(w + 16, 6, landDepth + 12), Enum.Material.Sand)
	terrain("FillBlock", CFrame.new(center.X, -7, wallZ - (h - n.sector.seawallY * S) / 2 - 10), Vector3.new(w + 16, 14, h - n.sector.seawallY * S + 30), Enum.Material.Water)
	part(folder, { Name = "Sector_Ground", Size = Vector3.new(w + 12, 2, landDepth + 6), CFrame = CFrame.new(center.X, -1.05, origin.Z - landDepth / 2 + 3), Transparency = 1, CanCollide = true })
	-- Shallow walkable sand under the water so players can wade out to the dock and the boss.
	part(folder, { Name = "Sector_Shallows", Size = Vector3.new(w, 1, (n.sector.playerMaxY - n.sector.seawallY) * S + 6), CFrame = CFrame.new(center.X, -1.6, wallZ - (n.sector.playerMaxY - n.sector.seawallY) * S / 2), Transparency = 1, CanCollide = true })

	-- Invisible walls keep players inside the sector.
	for _, wall in {
		{ Vector3.new(origin.X - 3, 10, center.Z), Vector3.new(2, 24, h + 12) },
		{ Vector3.new(origin.X + w + 3, 10, center.Z), Vector3.new(2, 24, h + 12) },
		{ Vector3.new(center.X, 10, origin.Z + 3), Vector3.new(w + 12, 24, 2) },
		{ Vector3.new(center.X, 10, origin.Z - n.sector.playerMaxY * S - 2), Vector3.new(w + 12, 24, 2) },
	} do
		part(folder, { Name = "Bound", Size = wall[2], CFrame = CFrame.new(wall[1]), Transparency = 1, CanCollide = true })
	end

	local decor = model(folder, "Decor")
	for _, s in n.structures do
		local pos = WorldBuilder.toWorld(origin, s.x, s.y, 0)
		local main
		if s.id == "seawall" then
			-- Stone wall with battlements
			main = part(folder, { Name = "seawall", Size = Vector3.new(w, 5, 3), CFrame = CFrame.new(center.X, 2.5, wallZ), Color = PALETTE.stone, Material = Enum.Material.Slate, CastShadow = true })
			for i = 0, math.floor(w / 6) do
				part(decor, { Size = Vector3.new(2.6, 2, 3.2), CFrame = CFrame.new(origin.X + i * 6 + 1.5, 6, wallZ), Color = PALETTE.stoneDark, Material = Enum.Material.Slate })
			end
		elseif s.id == "lighthouse" then
			main = lighthouseTower(decor, pos, 26, s.radius * S * 0.6)
			main.Parent = folder
			main.Name = "lighthouse"
		else
			-- Wooden dock out over the water, with posts and a crate
			local dockLen = 18
			main = part(folder, { Name = "dock", Size = Vector3.new(s.radius * 2 * S, 1, dockLen), CFrame = CFrame.new(pos + Vector3.new(0, 1.2, -dockLen / 2 + 4)), Color = PALETTE.wood, Material = Enum.Material.WoodPlanks, CastShadow = true })
			for _, dz in { 0, -dockLen / 2, -dockLen + 2 } do
				for _, dx in { -s.radius * S + 0.6, s.radius * S - 0.6 } do
					cylinder(decor, CFrame.new(pos + Vector3.new(dx, -1, dz + 4)), 5, 0.8, { Color = PALETTE.woodDark, Material = Enum.Material.Wood })
				end
			end
			crate(decor, pos + Vector3.new(1, 1.7, -2), 2)
		end
		main:SetAttribute("Stage", 0)
	end
	-- Torches along the beach for night light
	for i = 1, 3 do
		lantern(decor, origin + Vector3.new(w * i / 4, 0, -12))
	end
	palmTree(decor, origin + Vector3.new(4, 0, -6), 12, 0.5)
	palmTree(decor, origin + Vector3.new(w - 4, 0, -8), 13, -0.5)

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
