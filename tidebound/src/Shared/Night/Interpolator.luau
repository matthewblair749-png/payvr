--[[
	Snapshot interpolation for remote entities (enemies, squad mates). Renders INTERP_DELAY behind the newest
	server snapshot and blends between the two snapshots around that time, so movement stays smooth at
	60 FPS while snapshots arrive at the 20 Hz tick rate (and occasionally drop on mobile networks).
	The local player's own character is never interpolated: Roblox moves it immediately (client prediction)
	and the server only corrects it when it moves impossibly far.
]]

local Interpolator = {}
Interpolator.__index = Interpolator

Interpolator.INTERP_DELAY = 0.1
local MAX_BUFFER = 30

function Interpolator.new()
	return setmetatable({ buffer = {}, offset = nil }, Interpolator)
end

-- Adds a snapshot. serverTime is the sim time in the snapshot; localTime is when it arrived.
function Interpolator:push(serverTime: number, localTime: number, entities: { [any]: { x: number, y: number } })
	local buffer = self.buffer
	if #buffer > 0 and serverTime <= buffer[#buffer].t then
		return -- out of order or duplicate (unreliable channel)
	end
	-- Track the clock offset with light smoothing so jitter does not shake entities.
	local offset = localTime - serverTime
	self.offset = if self.offset then self.offset + (offset - self.offset) * 0.1 else offset
	table.insert(buffer, { t = serverTime, entities = entities })
	if #buffer > MAX_BUFFER then
		table.remove(buffer, 1)
	end
end

-- Returns { [id] = { x, y } } for the render time that corresponds to localTime.
function Interpolator:sample(localTime: number): { [any]: { x: number, y: number } }
	local buffer = self.buffer
	if #buffer == 0 then
		return {}
	end
	local renderTime = localTime - (self.offset or 0) - Interpolator.INTERP_DELAY
	if renderTime <= buffer[1].t then
		return buffer[1].entities
	end
	for i = #buffer - 1, 1, -1 do
		local a, b = buffer[i], buffer[i + 1]
		if renderTime >= a.t and renderTime <= b.t then
			local alpha = (renderTime - a.t) / math.max(1e-6, b.t - a.t)
			local out = {}
			for id, eb in b.entities do
				local ea = a.entities[id]
				if ea then
					-- Keep the newer snapshot's other fields (type, health) and blend the position.
					local e = table.clone(eb)
					e.x = ea.x + (eb.x - ea.x) * alpha
					e.y = ea.y + (eb.y - ea.y) * alpha
					out[id] = e
				else
					out[id] = eb
				end
			end
			return out
		end
	end
	-- Newer than anything buffered (late packets): hold the latest positions rather than guessing.
	return buffer[#buffer].entities
end

return Interpolator
