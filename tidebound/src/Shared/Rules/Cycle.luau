--[[
	The global day/night clock. Every server derives the phase from UTC, so all servers share nights
	and the companion backend can schedule "night starting" notifications without asking a server.
]]

local Time = require(script.Parent.Parent.Util.Time)

local Cycle = {}

export type Phase = {
	phase: string,
	cycleIndex: number,
	startsAt: number,
	endsAt: number,
	secondsLeft: number,
}

local function epoch(cfg: any): number
	if not cfg.index.cycleEpoch then
		cfg.index.cycleEpoch = Time.parseUtc(cfg.cycle.cycleEpochUtc)
	end
	return cfg.index.cycleEpoch
end

function Cycle.length(cfg: any): number
	local c = cfg.cycle
	return c.daySeconds + c.duskSeconds + c.nightSeconds + c.dawnSeconds
end

function Cycle.at(cfg: any, now: number): Phase
	local c = cfg.cycle
	local len = Cycle.length(cfg)
	local since = now - epoch(cfg)
	local index = math.floor(since / len)
	local offset = since - index * len
	local cycleStart = epoch(cfg) + index * len
	local bounds = {
		{ "day", 0, c.daySeconds },
		{ "dusk", c.daySeconds, c.daySeconds + c.duskSeconds },
		{ "night", c.daySeconds + c.duskSeconds, c.daySeconds + c.duskSeconds + c.nightSeconds },
		{ "dawn", c.daySeconds + c.duskSeconds + c.nightSeconds, len },
	}
	for _, b in bounds do
		if offset >= b[2] and offset < b[3] then
			return {
				phase = b[1],
				cycleIndex = index,
				startsAt = cycleStart + b[2],
				endsAt = cycleStart + b[3],
				secondsLeft = cycleStart + b[3] - now,
			}
		end
	end
	return { phase = "day", cycleIndex = index + 1, startsAt = cycleStart + len, endsAt = cycleStart + len + c.daySeconds, secondsLeft = 0 }
end

function Cycle.nextNightStart(cfg: any, now: number): number
	local p = Cycle.at(cfg, now)
	local c = cfg.cycle
	local cycleStart = epoch(cfg) + p.cycleIndex * Cycle.length(cfg)
	local nightStart = cycleStart + c.daySeconds + c.duskSeconds
	if nightStart <= now then
		nightStart += Cycle.length(cfg)
	end
	return nightStart
end

-- A new player's own first night: firstDaySeconds after the tutorial ends, plus dusk.
function Cycle.firstNightAt(cfg: any, tutorialDoneAt: number): number
	return tutorialDoneAt + cfg.cycle.firstDaySeconds + cfg.cycle.duskSeconds
end

return Cycle
