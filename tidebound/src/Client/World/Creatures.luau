--[[
	Builds creature models from parts: Drifters (by species, element and rarity), night enemies, and
	The Undertow. Uploaded models in ReplicatedStorage.Assets (Drifter_<name>, Enemy_<type>, Boss_TheUndertow)
	replace these automatically. All parts are anchored, non-colliding and shadowless for performance.
]]

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Creatures = {}

local ELEMENT = {
	tide = { body = Color3.fromRGB(70, 190, 230), belly = Color3.fromRGB(200, 244, 255), accent = Color3.fromRGB(30, 120, 200) },
	ember = { body = Color3.fromRGB(255, 136, 64), belly = Color3.fromRGB(255, 226, 170), accent = Color3.fromRGB(230, 60, 40) },
	moss = { body = Color3.fromRGB(110, 200, 90), belly = Color3.fromRGB(220, 250, 190), accent = Color3.fromRGB(50, 140, 60) },
	frost = { body = Color3.fromRGB(170, 210, 255), belly = Color3.fromRGB(240, 250, 255), accent = Color3.fromRGB(110, 150, 255) },
}
local RARITY_SIZE = { common = 1, uncommon = 1.1, rare = 1.2, epic = 1.35, legendary = 1.5 }

local function p(m: Model, props: any): BasePart
	local part = Instance.new(props.ClassName or "Part")
	props.ClassName = nil
	part.Anchored = true
	part.CanCollide = false
	part.CanQuery = false
	part.CanTouch = false
	part.CastShadow = false
	part.Material = Enum.Material.SmoothPlastic
	part.TopSurface = Enum.SurfaceType.Smooth
	part.BottomSurface = Enum.SurfaceType.Smooth
	for k, v in props do
		(part :: any)[k] = v
	end
	part.Parent = m
	return part
end

local function ball(m: Model, size: Vector3, offset: CFrame, color: Color3, material: Enum.Material?): BasePart
	return p(m, { Shape = Enum.PartType.Ball, Size = size, CFrame = offset, Color = color, Material = material or Enum.Material.SmoothPlastic })
end

-- Big cute eyes: white, a dark pupil and a light glint.
local function eyes(m: Model, root: CFrame, spread: number, height: number, forward: number, size: number)
	for _, side in { -1, 1 } do
		local eyeCf = root * CFrame.new(side * spread, height, -forward)
		ball(m, Vector3.one * size, eyeCf, Color3.new(1, 1, 1))
		ball(m, Vector3.one * size * 0.6, eyeCf * CFrame.new(0, -size * 0.05, -size * 0.28), Color3.fromRGB(30, 30, 40))
		ball(m, Vector3.one * size * 0.22, eyeCf * CFrame.new(size * 0.12, size * 0.12, -size * 0.45), Color3.new(1, 1, 1), Enum.Material.Neon)
	end
end

-- Uploaded or generated models replace the built ones; they are scaled to `height` studs.
local function template(name: string, height: number?): Model?
	local assets = ReplicatedStorage:FindFirstChild("Assets")
	local t = assets and assets:FindFirstChild(name)
	if t and t:IsA("Model") then
		local clone = t:Clone()
		if height then
			local _, size = clone:GetBoundingBox()
			if size.Y > 0.01 then
				pcall(function()
					clone:ScaleTo(clone:GetScale() * height / size.Y)
				end)
			end
		end
		for _, d in clone:GetDescendants() do
			if d:IsA("BasePart") then
				d.Anchored = true
				d.CanCollide = false
				d.CanQuery = false
			end
		end
		return clone
	end
	return nil
end

-- A Drifter: round body, belly, big eyes, and an element feature on top.
function Creatures.drifter(cfg: any, speciesId: string): Model
	local species = cfg.index.species[speciesId]
	local custom = template("Drifter_" .. string.sub(speciesId, 5), 2.8 * (RARITY_SIZE[species and species.rarity or "common"] or 1))
	if custom then
		return custom
	end
	local element = species and species.element or "tide"
	local rarity = species and species.rarity or "common"
	local colors = ELEMENT[element]
	-- Each species gets its own shade so the collection looks varied.
	local h, sat, v = colors.body:ToHSV()
	local shift = (#speciesId % 7 - 3) * 0.015
	local body = Color3.fromHSV((h + shift) % 1, sat, v)
	local s = RARITY_SIZE[rarity] or 1
	local m = Instance.new("Model")
	m.Name = speciesId
	local root = CFrame.new()
	local core = ball(m, Vector3.new(2.6, 2.3, 2.6) * s, root, body)
	core.Name = "Body"
	m.PrimaryPart = core
	ball(m, Vector3.new(1.8, 1.5, 1) * s, root * CFrame.new(0, -0.25 * s, -0.95 * s), colors.belly)
	eyes(m, root, 0.55 * s, 0.35 * s, 1.0 * s, 0.75 * s)
	-- Little feet
	for _, side in { -1, 1 } do
		ball(m, Vector3.new(0.8, 0.5, 1) * s, root * CFrame.new(side * 0.7 * s, -1.05 * s, -0.2 * s), colors.accent)
	end
	if element == "tide" then
		p(m, { ClassName = "WedgePart", Size = Vector3.new(0.3, 1.1, 1.4) * s, CFrame = root * CFrame.new(0, 1.35 * s, 0.2 * s), Color = colors.accent })
		p(m, { ClassName = "WedgePart", Size = Vector3.new(0.3, 1, 1.2) * s, CFrame = root * CFrame.new(0, 0, 1.6 * s) * CFrame.Angles(0, math.rad(180), 0), Color = colors.accent })
	elseif element == "ember" then
		local flame = ball(m, Vector3.new(0.8, 1.3, 0.8) * s, root * CFrame.new(0, 1.45 * s, 0), Color3.fromRGB(255, 190, 60), Enum.Material.Neon)
		local fire = Instance.new("Fire")
		fire.Size = 2 * s
		fire.Heat = 4
		fire.Color = Color3.fromRGB(255, 150, 60)
		fire.SecondaryColor = Color3.fromRGB(255, 230, 120)
		fire.Parent = flame
	elseif element == "moss" then
		for i = -1, 1 do
			p(m, { ClassName = "WedgePart", Size = Vector3.new(0.25, 1.2, 0.8) * s, CFrame = root * CFrame.new(i * 0.35 * s, 1.5 * s, 0) * CFrame.Angles(0, 0, math.rad(i * 25)), Color = colors.accent, Material = Enum.Material.Grass })
		end
		ball(m, Vector3.new(0.5, 0.5, 0.5) * s, root * CFrame.new(0.5 * s, 1.1 * s, 0.6 * s), Color3.fromRGB(255, 120, 170))
	elseif element == "frost" then
		for i = -1, 1 do
			p(m, { ClassName = "WedgePart", Size = Vector3.new(0.25, 1.1, 0.6) * s, CFrame = root * CFrame.new(i * 0.4 * s, 1.4 * s, 0) * CFrame.Angles(0, 0, math.rad(-i * 18)), Color = Color3.fromRGB(200, 240, 255), Material = Enum.Material.Ice })
		end
	end
	-- Rare and better Drifters shimmer; Legendaries glow.
	if rarity == "epic" or rarity == "legendary" then
		local sparkle = Instance.new("ParticleEmitter")
		sparkle.Texture = "rbxasset://textures/particles/sparkles_main.dds"
		sparkle.Color = ColorSequence.new(if rarity == "legendary" then Color3.fromRGB(255, 220, 90) else Color3.fromRGB(200, 140, 255))
		sparkle.LightEmission = 1
		sparkle.Size = NumberSequence.new(0.35, 0)
		sparkle.Lifetime = NumberRange.new(0.6, 1)
		sparkle.Rate = if rarity == "legendary" then 10 else 5
		sparkle.Speed = NumberRange.new(0.5, 1.5)
		sparkle.SpreadAngle = Vector2.new(180, 180)
		sparkle.Parent = core
	end
	if rarity == "legendary" then
		local glow = Instance.new("PointLight")
		glow.Color = Color3.fromRGB(255, 220, 120)
		glow.Range = 8
		glow.Brightness = 1.2
		glow.Parent = core
	end
	return m
end

local ENEMY_EYES = { tide = Color3.fromRGB(80, 220, 255), ember = Color3.fromRGB(255, 120, 40), moss = Color3.fromRGB(140, 255, 90), frost = Color3.fromRGB(190, 230, 255) }

-- Night enemies: a scuttling crab, a rock brute, and a spiky puffer. Eye colour shows the wave's element.
function Creatures.enemy(typeId: string, element: string?): Model
	local custom = template("Enemy_" .. typeId, ({ crawler = 2, brute = 5.5, spitter = 3 })[typeId])
	if custom then
		return custom
	end
	local m = Instance.new("Model")
	m.Name = typeId
	local eye = ENEMY_EYES[element or "tide"] or ENEMY_EYES.tide
	local root = CFrame.new()
	local core
	if typeId == "crawler" then
		core = ball(m, Vector3.new(3, 1.4, 2.4), root, Color3.fromRGB(220, 80, 70))
		for _, side in { -1, 1 } do
			ball(m, Vector3.new(1.1, 0.8, 1.1), root * CFrame.new(side * 1.7, 0.2, -1.1), Color3.fromRGB(200, 60, 50))
			for leg = -1, 1 do
				p(m, { Size = Vector3.new(1.2, 0.25, 0.25), CFrame = root * CFrame.new(side * 1.5, -0.5, leg * 0.6) * CFrame.Angles(0, 0, math.rad(side * -30)), Color = Color3.fromRGB(170, 50, 40) })
			end
			ball(m, Vector3.one * 0.45, root * CFrame.new(side * 0.4, 0.9, -0.8), eye, Enum.Material.Neon)
		end
	elseif typeId == "brute" then
		core = p(m, { Size = Vector3.new(4.4, 4.6, 3.6), CFrame = root, Color = Color3.fromRGB(110, 104, 120), Material = Enum.Material.Slate })
		p(m, { Size = Vector3.new(3.4, 1.6, 3), CFrame = root * CFrame.new(0, 3, 0), Color = Color3.fromRGB(90, 84, 100), Material = Enum.Material.Slate })
		for _, side in { -1, 1 } do
			p(m, { Size = Vector3.new(1.4, 3.6, 1.4), CFrame = root * CFrame.new(side * 3, -0.4, 0), Color = Color3.fromRGB(96, 90, 106), Material = Enum.Material.Slate })
			p(m, { Size = Vector3.new(0.7, 0.5, 0.2), CFrame = root * CFrame.new(side * 0.8, 3.1, -1.55), Color = eye, Material = Enum.Material.Neon })
		end
		for i = 1, 3 do
			p(m, { Size = Vector3.new(0.6, 0.6, 0.6), CFrame = root * CFrame.new(-1 + i * 0.6, 1.8, 1.9), Color = Color3.fromRGB(90, 160, 90), Material = Enum.Material.Grass })
		end
	else
		core = ball(m, Vector3.new(2.6, 2.6, 2.6), root, Color3.fromRGB(120, 200, 110))
		for i = 1, 10 do
			local a = math.rad(i * 36)
			p(m, { ClassName = "WedgePart", Size = Vector3.new(0.3, 0.9, 0.5), CFrame = root * CFrame.Angles(a, 0, math.rad(i * 70)) * CFrame.new(0, 1.5, 0), Color = Color3.fromRGB(240, 230, 150) })
		end
		ball(m, Vector3.new(0.9, 0.6, 0.6), root * CFrame.new(0, -0.2, -1.3), Color3.fromRGB(240, 120, 140))
		for _, side in { -1, 1 } do
			ball(m, Vector3.one * 0.55, root * CFrame.new(side * 0.55, 0.5, -1.1), eye, Enum.Material.Neon)
		end
	end
	core.Name = "Body"
	m.PrimaryPart = core
	return m
end

-- The Undertow: a towering water giant with glowing eyes, a crown of coral and swaying tentacles.
function Creatures.boss(radius: number): Model
	local custom = template("Boss_TheUndertow", radius * 2.6)
	if custom then
		return custom
	end
	local m = Instance.new("Model")
	m.Name = "TheUndertow"
	local d = radius * 2
	local root = CFrame.new()
	local core = ball(m, Vector3.new(d, d * 1.2, d), root, Color3.fromRGB(30, 90, 150), Enum.Material.Glass)
	core.Transparency = 0.15
	core.Name = "Body"
	m.PrimaryPart = core
	ball(m, Vector3.new(d * 0.7, d * 0.8, d * 0.7), root * CFrame.new(0, 0, 0), Color3.fromRGB(20, 50, 100))
	for _, side in { -1, 1 } do
		ball(m, Vector3.new(d * 0.18, d * 0.12, d * 0.1), root * CFrame.new(side * d * 0.18, d * 0.15, -d * 0.48), Color3.fromRGB(120, 255, 240), Enum.Material.Neon)
	end
	for i = 1, 5 do
		local a = math.rad(-60 + i * 20)
		p(m, { ClassName = "WedgePart", Size = Vector3.new(d * 0.08, d * 0.3, d * 0.12), CFrame = root * CFrame.new(math.sin(a) * d * 0.3, d * 0.62, -math.cos(a) * d * 0.1), Color = Color3.fromRGB(255, 120, 140), Material = Enum.Material.Neon })
	end
	for i = 1, 6 do
		local a = math.rad(i * 60)
		local t = p(m, { Shape = Enum.PartType.Cylinder, Size = Vector3.new(d * 0.9, d * 0.18, d * 0.18), CFrame = root * CFrame.new(math.cos(a) * d * 0.5, -d * 0.45, math.sin(a) * d * 0.5) * CFrame.Angles(0, -a, math.rad(-35)), Color = Color3.fromRGB(40, 120, 170) })
		t.Name = "Tentacle"
	end
	local glow = Instance.new("PointLight")
	glow.Color = Color3.fromRGB(100, 230, 255)
	glow.Range = 30
	glow.Brightness = 2
	glow.Parent = core
	return m
end

-- Shows a creature in a ViewportFrame; spins it gently unless Reduce Motion is on.
function Creatures.viewport(parent: Instance, m: Model, size: UDim2, spin: boolean, theme: any): ViewportFrame
	local vp = Instance.new("ViewportFrame")
	vp.BackgroundTransparency = 1
	vp.Size = size
	vp.Ambient = Color3.fromRGB(200, 200, 210)
	vp.LightColor = Color3.fromRGB(255, 250, 240)
	vp.LightDirection = Vector3.new(-1, -1, -1)
	m.Parent = vp
	local _, extents = m:GetBoundingBox()
	local cam = Instance.new("Camera")
	cam.FieldOfView = 30
	local dist = extents.Magnitude * 1.7
	cam.CFrame = CFrame.lookAt(Vector3.new(0, extents.Y * 0.15, -dist), Vector3.zero)
	cam.Parent = vp
	vp.CurrentCamera = cam
	vp.Parent = parent
	if spin and not theme.reducedMotion then
		task.spawn(function()
			local angle = 0
			while vp.Parent do
				angle += 0.03
				m:PivotTo(CFrame.Angles(0, math.sin(angle) * 0.6 + math.pi, 0))
				task.wait()
			end
		end)
	else
		m:PivotTo(CFrame.Angles(0, math.pi, 0))
	end
	return vp
end

return Creatures
