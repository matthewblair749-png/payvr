--[[
	Client networking for day intents.
	  * Intents go out in order, one at a time, each with a sequence number. The server applies a
	    sequence number at most once, so a retry after a dropped reply never doubles an action.
	  * Intents with no randomness are predicted locally with the same IntentProcessor the server runs,
	    so taps feel instant; the next server state replaces the prediction (reconciliation).
	  * If a reply takes longer than SLOW_SECONDS, the app shows "Reconnecting..." and keeps retrying.
]]

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local IntentProcessor = require(Shared.Intents.IntentProcessor)
local Cycle = require(Shared.Rules.Cycle)
local Tbl = require(Shared.Util.Tbl)
local Rng = require(Shared.Util.Rng)

local Net = {}
Net.__index = Net

local SLOW_SECONDS = 3
local RETRIES = 5

function Net.new(app: any)
	local self = setmetatable({}, Net)
	self.app = app
	self.remote = ReplicatedStorage:WaitForChild("Remotes"):WaitForChild("Intent")
	self.seq = 0
	self.queue = {}
	self.running = false
	return self
end

local function predict(app: any, intent: any)
	local cfg = app.cfg
	local state = app.state
	if not state or not IntentProcessor.PREDICTABLE[intent.type] then
		return
	end
	local copy = Tbl.deepCopy(state)
	local now = workspace:GetServerTimeNow()
	local ctx = { cfg = cfg, now = now, rng = Rng.new(0), userId = app.userId, mods = state.derived.mods or {}, cycleIndex = Cycle.at(cfg, now).cycleIndex }
	local ok, result = pcall(IntentProcessor.apply, ctx, copy, intent)
	if ok and result.ok then
		app:setState(copy, true)
	end
end

function Net:pump()
	if self.running then
		return
	end
	self.running = true
	while #self.queue > 0 do
		local job = table.remove(self.queue, 1)
		local result = nil
		for attempt = 1, RETRIES do
			local done = false
			task.delay(SLOW_SECONDS, function()
				if not done then
					self.app:setConnection("reconnecting")
				end
			end)
			local ok, reply = pcall(self.remote.InvokeServer, self.remote, job.intent, job.seq)
			done = true
			if ok then
				result = reply
				break
			end
			self.app:setConnection("reconnecting")
			task.wait(math.min(8, 2 ^ attempt * 0.5))
		end
		self.app:setConnection("online")
		if result == nil then
			result = { ok = false, err = "network" }
		end
		job.resolve(result)
	end
	self.running = false
end

-- Sends an intent and yields until the server replies. Returns { ok, err?, data? }.
function Net:send(intentType: string, args: any?): any
	self.seq += 1
	local intent = { type = intentType, args = args }
	predict(self.app, intent)
	local reply = nil
	local thread = coroutine.running()
	table.insert(self.queue, {
		seq = self.seq,
		intent = intent,
		resolve = function(r)
			reply = r
			if coroutine.status(thread) == "suspended" then
				task.spawn(thread)
			end
		end,
	})
	task.spawn(self.pump, self)
	if reply == nil then
		coroutine.yield()
	end
	if not reply.ok and reply.err then
		self.app:toast(self.app.L("err_" .. reply.err))
	end
	return reply
end

return Net
