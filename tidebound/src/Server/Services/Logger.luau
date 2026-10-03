--[[
	Structured server logs: one JSON object per line, prefixed so they are easy to filter in the
	Developer Console and in the server log export. Errors also go to the companion backend when configured.
]]

local HttpService = game:GetService("HttpService")

local Logger = {}

local sink: ((level: string, entry: any) -> ())? = nil

function Logger.setSink(fn: (level: string, entry: any) -> ())
	sink = fn
end

local function write(level: string, event: string, fields: any?)
	local entry = { level = level, event = event, at = os.time(), job = game.JobId, place = game.PlaceVersion }
	if fields then
		for k, v in fields do
			entry[k] = v
		end
	end
	local ok, line = pcall(HttpService.JSONEncode, HttpService, entry)
	line = if ok then line else event
	if level == "error" then
		warn("[tidebound] " .. line)
	else
		print("[tidebound] " .. line)
	end
	if sink then
		task.spawn(sink, level, entry)
	end
end

function Logger.info(event: string, fields: any?)
	write("info", event, fields)
end

function Logger.warn(event: string, fields: any?)
	write("warn", event, fields)
end

function Logger.error(event: string, fields: any?)
	write("error", event, fields)
end

return Logger
