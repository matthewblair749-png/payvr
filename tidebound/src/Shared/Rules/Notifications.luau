--[[
	Chooses which opt-in notifications to send: at most maxPerDay per player per local day, never in quiet hours,
	only types the player left switched on, highest priority (lowest number) first.
	The companion backend runs this before calling Roblox's experience notification API.
]]

local Notifications = {}

-- candidates: { { type, at } } in Unix seconds. utcOffsetHours: the player's offset (0 if unknown).
-- alreadySent: { [dayKey] = count }. Returns the accepted candidates with their adjusted send times.
function Notifications.plan(cfg: any, candidates: { any }, settings: any, alreadySent: { [string]: number }, utcOffsetHours: number): { any }
	local n = cfg.harbor.notifications
	local priority = {}
	for _, t in n.types do
		priority[t.id] = t.priority
	end
	local sorted = table.clone(candidates)
	table.sort(sorted, function(a, b)
		local pa, pb = priority[a.type] or 99, priority[b.type] or 99
		if pa ~= pb then
			return pa < pb
		end
		return a.at < b.at
	end)
	local sent = table.clone(alreadySent)
	local accepted = {}
	for _, c in sorted do
		if settings[c.type] then
			local localTime = c.at + utcOffsetHours * 3600
			local hour = math.floor(localTime % 86400 / 3600)
			local at = c.at
			local inQuiet
			if n.quietStartHour > n.quietEndHour then
				inQuiet = hour >= n.quietStartHour or hour < n.quietEndHour
			else
				inQuiet = hour >= n.quietStartHour and hour < n.quietEndHour
			end
			if inQuiet then
				-- Hold until quiet hours end (crops and income keep; night and season events are dropped).
				if c.type == "night_starting" or c.type == "season_changed" then
					at = nil
				else
					local dayStart = localTime - localTime % 86400
					local endLocal = dayStart + n.quietEndHour * 3600
					if endLocal <= localTime then
						endLocal += 86400
					end
					at = endLocal - utcOffsetHours * 3600
				end
			end
			if at then
				local dayKey = tostring(math.floor((at + utcOffsetHours * 3600) / 86400))
				if (sent[dayKey] or 0) < n.maxPerDay then
					sent[dayKey] = (sent[dayKey] or 0) + 1
					table.insert(accepted, { type = c.type, at = at })
				end
			end
		end
	end
	table.sort(accepted, function(a, b)
		return a.at < b.at
	end)
	return accepted
end

return Notifications
