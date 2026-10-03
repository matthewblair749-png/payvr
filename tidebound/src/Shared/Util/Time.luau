--[[ UTC calendar helpers. All times are Unix seconds (may be fractional). ]]

local Time = {}

local DAY = 86400

function Time.dayIndex(t: number): number
	return math.floor(t / DAY)
end

-- Roblox's os.date only supports "*t" and "!*t", so format by hand.
function Time.utcParts(t: number): any
	return os.date("!*t", math.floor(t))
end

function Time.dateKey(t: number): string
	local d = Time.utcParts(t)
	return string.format("%04d-%02d-%02d", d.year, d.month, d.day)
end

function Time.monthKey(t: number): string
	local d = Time.utcParts(t)
	return string.format("%04d-%02d", d.year, d.month)
end

-- Parses "YYYY-MM-DD" or "YYYY-MM-DDTHH:MM:SSZ" as UTC.
function Time.parseUtc(text: string): number
	local y, m, d = string.match(text, "^(%d+)-(%d+)-(%d+)")
	assert(y, "bad date " .. text)
	local hh, mm, ss = string.match(text, "T(%d+):(%d+):(%d+)")
	-- Days from civil (Howard Hinnant), avoids os.time's local timezone.
	local year, month, day = tonumber(y) :: number, tonumber(m) :: number, tonumber(d) :: number
	if month <= 2 then
		year -= 1
	end
	local era = math.floor(year / 400)
	local yoe = year - era * 400
	local mp = (month + 9) % 12
	local doy = math.floor((153 * mp + 2) / 5) + day - 1
	local doe = yoe * 365 + math.floor(yoe / 4) - math.floor(yoe / 100) + doy
	local days = era * 146097 + doe - 719468
	return days * DAY + (tonumber(hh) or 0) * 3600 + (tonumber(mm) or 0) * 60 + (tonumber(ss) or 0)
end

-- Monday-anchored week key, used for weekly goals.
function Time.weekKey(t: number): string
	local monday = Time.parseUtc("2026-01-05")
	local week = math.floor((t - monday) / (7 * DAY))
	return "W" .. tostring(week)
end

return Time
