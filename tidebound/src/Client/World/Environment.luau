--[[
	Lighting and the day/night look. Uses the effects most top Roblox games rely on (Atmosphere, a little
	Bloom, warm colour correction, sun rays) and moves the sun with the global cycle: sunrise at dawn, a long
	golden afternoon, an orange dusk, and a blue moonlit night while the tide rises.
]]

local Lighting = game:GetService("Lighting")
local RunService = game:GetService("RunService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Cycle = require(ReplicatedStorage.Shared.Rules.Cycle)

local Environment = {}

local LOOKS = {
	day = { clock = nil, ambient = Color3.fromRGB(120, 130, 150), outdoor = Color3.fromRGB(150, 150, 160), brightness = 2.6, atmosphere = Color3.fromRGB(200, 225, 255), decay = Color3.fromRGB(120, 160, 210), density = 0.28, tint = Color3.fromRGB(255, 250, 240), saturation = 0.12, exposure = 0 },
	dusk = { clock = nil, ambient = Color3.fromRGB(140, 100, 110), outdoor = Color3.fromRGB(170, 110, 100), brightness = 1.8, atmosphere = Color3.fromRGB(255, 180, 140), decay = Color3.fromRGB(200, 110, 90), density = 0.34, tint = Color3.fromRGB(255, 225, 200), saturation = 0.15, exposure = 0 },
	night = { clock = nil, ambient = Color3.fromRGB(60, 80, 130), outdoor = Color3.fromRGB(70, 90, 150), brightness = 1.2, atmosphere = Color3.fromRGB(80, 110, 180), decay = Color3.fromRGB(40, 60, 120), density = 0.38, tint = Color3.fromRGB(205, 220, 255), saturation = 0.05, exposure = 0.25 },
	dawn = { clock = nil, ambient = Color3.fromRGB(130, 120, 150), outdoor = Color3.fromRGB(170, 140, 160), brightness = 1.8, atmosphere = Color3.fromRGB(255, 200, 190), decay = Color3.fromRGB(180, 130, 160), density = 0.32, tint = Color3.fromRGB(255, 235, 230), saturation = 0.1, exposure = 0 },
}

-- Sun position through the cycle: day 6:30 -> 17:30, dusk to 19:00, night 19:00 -> 5:00, dawn to 6:30.
local function clockFor(phase: string, progress: number): number
	if phase == "day" then
		return 6.5 + 11 * progress
	elseif phase == "dusk" then
		return 17.5 + 1.5 * progress
	elseif phase == "night" then
		return (19 + 10 * progress) % 24
	end
	return 5 + 1.5 * progress
end

local function ensure(className: string, name: string): any
	local inst = Lighting:FindFirstChild(name)
	if not inst then
		inst = Instance.new(className)
		inst.Name = name
		inst.Parent = Lighting
	end
	return inst
end

function Environment.mount(app: any)
	local atmosphere = ensure("Atmosphere", "TideAtmosphere")
	atmosphere.Offset = 0.15
	atmosphere.Glare = 0.4
	atmosphere.Haze = 1.4
	local bloom = ensure("BloomEffect", "TideBloom")
	bloom.Intensity = 0.6
	bloom.Size = 28
	bloom.Threshold = 1.6
	local color = ensure("ColorCorrectionEffect", "TideColor")
	color.Contrast = 0.08
	local rays = ensure("SunRaysEffect", "TideSunRays")
	rays.Intensity = 0.06
	rays.Spread = 0.6
	local sky = Lighting:FindFirstChildOfClass("Sky") or ensure("Sky", "TideSky")
	sky.SunAngularSize = 14
	sky.MoonAngularSize = 9
	sky.StarCount = 3000
	Lighting.EnvironmentDiffuseScale = 0.6
	Lighting.EnvironmentSpecularScale = 0.6
	Lighting.GlobalShadows = true
	Lighting.ShadowSoftness = 0.25

	local current = nil
	RunService.Heartbeat:Connect(function(dt)
		local now = workspace:GetServerTimeNow()
		local p = Cycle.at(app.cfg, now)
		local phase = p.phase
		local progress = 1 - p.secondsLeft / math.max(1, p.endsAt - p.startsAt)
		-- Defending at night always looks like night, including the tutorial night.
		if app.inNight then
			phase, progress = "night", 0.4
		end
		local look = LOOKS[phase]
		local alpha = math.min(1, dt * 0.8)
		if not current then
			current = table.clone(look)
			alpha = 1
		end
		for _, k in { "ambient", "outdoor", "atmosphere", "decay", "tint" } do
			current[k] = current[k]:Lerp(look[k], alpha)
		end
		for _, k in { "brightness", "density", "saturation", "exposure" } do
			current[k] += (look[k] - current[k]) * alpha
		end
		Lighting.ClockTime = clockFor(phase, progress)
		Lighting.Ambient = current.ambient
		Lighting.OutdoorAmbient = current.outdoor
		Lighting.Brightness = current.brightness
		Lighting.ExposureCompensation = current.exposure
		atmosphere.Color = current.atmosphere
		atmosphere.Decay = current.decay
		atmosphere.Density = current.density
		color.TintColor = current.tint
		color.Saturation = current.saturation
	end)
end

return Environment
