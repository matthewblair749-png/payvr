--[[
	Runs the real Tidebound server scripts outside Roblox.

	A runtime is one "game server": it loads a place file built by Rojo, runs Server/Main with mocked
	engine services, and gives tests control over virtual time. Several runtimes can share one DataStore
	backend to act like several servers (used for the session-lock test).

	Mocked: DataStoreService, MessagingService, HttpService, Players (with fake players and characters),
	RunService (Heartbeat driven by advance), MarketplaceService, PolicyService, AnalyticsService,
	ScriptContext, plus task/os.clock/GetServerTimeNow on a virtual clock.
	Real (from the place file): ReplicatedStorage, ServerScriptService, Workspace and every Instance the
	server creates (parts, remotes, prompts), through Lune's Roblox library.
]]

local fs = require("@lune/fs")
local luau = require("@lune/luau")
local roblox = require("@lune/roblox")
local serde = require("@lune/serde")

local Runtime = {}
Runtime.__index = Runtime

-- ---------------------------------------------------------------- engine gaps filled once per process

-- Lune may hand out a new wrapper for the same Instance, so key by a stable id stored as an attribute.
local remoteInvoke = {}
local remoteSignals = {}
local nextRemoteId = 0
local function rid(inst)
	local id = inst:GetAttribute("__testRemoteId")
	if not id then
		nextRemoteId += 1
		id = nextRemoteId
		inst:SetAttribute("__testRemoteId", id)
	end
	return id
end
local currentRuntime = nil -- the runtime whose code is executing (methods below need its clock and inbox)

local function signal()
	local s = { handlers = {} }
	function s:Connect(fn)
		table.insert(self.handlers, fn)
		local handlers = self.handlers
		return {
			Disconnect = function()
				local i = table.find(handlers, fn)
				if i then
					table.remove(handlers, i)
				end
			end,
		}
	end
	function s:Fire(...)
		for _, fn in table.clone(self.handlers) do
			currentRuntime.task.spawn(fn, ...)
		end
	end
	return s
end

roblox.implementMethod("Instance", "WaitForChild", function(self, name)
	local child = self:FindFirstChild(name)
	assert(child, "WaitForChild: " .. self:GetFullName() .. " has no " .. name)
	return child
end)
-- Lune keeps Position as a stored property, so every move here writes both CFrame and Position.
local function placePart(part, cf)
	part.CFrame = cf
	part.Position = cf.Position
end
Runtime.placePart = placePart
roblox.implementMethod("PVInstance", "PivotTo", function(self, cf)
	if self:IsA("BasePart") then
		placePart(self, cf)
	elseif self.PrimaryPart then
		placePart(self.PrimaryPart, cf)
	end
end)
roblox.implementMethod("PVInstance", "GetPivot", function(self)
	if self:IsA("BasePart") then
		return self.CFrame
	end
	return self.PrimaryPart and self.PrimaryPart.CFrame or roblox.CFrame.new()
end)
roblox.implementMethod("Workspace", "GetServerTimeNow", function()
	return currentRuntime.epoch + currentRuntime.clock
end)
roblox.implementProperty("RemoteFunction", "OnServerInvoke", function(self)
	return remoteInvoke[rid(self)]
end, function(self, fn)
	remoteInvoke[rid(self)] = fn
end)
for _, className in { "RemoteEvent", "UnreliableRemoteEvent" } do
	roblox.implementProperty(className, "OnServerEvent", function(self)
		local id = rid(self)
		remoteSignals[id] = remoteSignals[id] or signal()
		return remoteSignals[id]
	end)
	roblox.implementMethod(className, "FireClient", function(self, player, ...)
		player.inbox[self.Name] = player.inbox[self.Name] or {}
		local list = player.inbox[self.Name]
		table.insert(list, table.pack(...))
		if #list > 200 then
			table.remove(list, 1)
		end
	end)
	roblox.implementMethod(className, "FireAllClients", function(self, ...)
		for _, p in currentRuntime.players do
			p.inbox[self.Name] = p.inbox[self.Name] or {}
			table.insert(p.inbox[self.Name], table.pack(...))
		end
	end)
end

-- ---------------------------------------------------------------- shared backends (cross-server)

-- A DataStore backend shared by every runtime created with it.
function Runtime.newBackend()
	return { stores = {}, topics = {}, writes = 0 }
end

local function dataStore(backend, name)
	backend.stores[name] = backend.stores[name] or {}
	local data = backend.stores[name]
	local store = {}
	local function copy(v)
		-- DataStores store JSON: round-trip so callers never share tables with the "cloud".
		if v == nil then
			return nil
		end
		return serde.decode("json", serde.encode("json", v))
	end
	function store:GetAsync(key)
		return copy(data[key])
	end
	function store:SetAsync(key, value)
		backend.writes += 1
		data[key] = copy(value)
	end
	function store:RemoveAsync(key)
		local old = data[key]
		data[key] = nil
		return copy(old)
	end
	function store:UpdateAsync(key, transform)
		if (backend.failUpdates or 0) > 0 then
			backend.failUpdates -= 1
			error("DataStore request failed (simulated)")
		end
		local result = transform(copy(data[key]))
		if result ~= nil then
			backend.writes += 1
			data[key] = copy(result)
		end
		return copy(result)
	end
	return store
end

-- ---------------------------------------------------------------- runtime

function Runtime.new(placePath: string, opts: any?)
	opts = opts or {}
	local self = setmetatable({}, Runtime)
	self.backend = opts.backend or Runtime.newBackend()
	self.jobId = opts.jobId or "job-1"
	self.unpublished = opts.unpublished == true
	self.epoch = opts.epoch or 1791460800 -- 2026-10-08 12:00 UTC
	self.clock = 0
	self.errors = {}
	self.players = {}
	self.logs = {}
	self.analytics = {}
	self.prompts = {}
	self.ownedPasses = {}
	self.subscriptions = {}
	self.closeHandlers = {}
	self.cache = {}
	self.place = roblox.deserializePlace(fs.readFile(placePath))
	self:_buildScheduler()
	self:_buildServices()
	return self
end

function Runtime:_buildScheduler()
	local rt = self
	local queue = {}
	local seq = 0
	local function report(thread, ok, err)
		if not ok then
			local msg = tostring(err) .. "\n" .. debug.traceback(thread)
			table.insert(rt.errors, msg)
		end
	end
	local function resume(thread, ...)
		local prev = currentRuntime
		currentRuntime = rt
		report(thread, coroutine.resume(thread, ...))
		currentRuntime = prev
	end
	local function schedule(at, thread, ...)
		seq += 1
		table.insert(queue, { at = at, seq = seq, thread = thread, args = table.pack(...) })
	end
	local task = {}
	function task.spawn(fnOrThread, ...)
		local thread = if type(fnOrThread) == "thread" then fnOrThread else coroutine.create(fnOrThread)
		resume(thread, ...)
		return thread
	end
	function task.defer(fn, ...)
		local thread = if type(fn) == "thread" then fn else coroutine.create(fn)
		schedule(rt.clock, thread, ...)
		return thread
	end
	function task.delay(t, fn, ...)
		local thread = coroutine.create(fn)
		schedule(rt.clock + (t or 0), thread, ...)
		return thread
	end
	function task.wait(t)
		local thread = coroutine.running()
		local start = rt.clock
		schedule(rt.clock + math.max(t or 0, 1 / 60), thread)
		coroutine.yield()
		return rt.clock - start
	end
	function task.cancel(thread)
		for i, item in queue do
			if item.thread == thread then
				table.remove(queue, i)
				return
			end
		end
	end
	self.task = task
	-- Runs everything due at or before the current clock.
	function self:_runDue()
		while true do
			local best, bestIndex = nil, nil
			for i, item in queue do
				if item.at <= rt.clock and (not best or item.at < best.at or (item.at == best.at and item.seq < best.seq)) then
					best, bestIndex = item, i
				end
			end
			if not best then
				return
			end
			table.remove(queue, bestIndex)
			if coroutine.status(best.thread) == "suspended" then
				resume(best.thread, table.unpack(best.args, 1, best.args.n))
			end
		end
	end
end

function Runtime:_buildServices()
	local rt = self
	local place = self.place
	local backend = self.backend

	local Players = {
		ClassName = "Players",
		PlayerAdded = signal(),
		PlayerRemoving = signal(),
		UserSubscriptionStatusChanged = signal(),
		CharacterAutoLoads = true,
	}
	function Players:GetPlayers()
		return table.clone(rt.players)
	end
	function Players:GetPlayerByUserId(id)
		for _, p in rt.players do
			if p.UserId == id then
				return p
			end
		end
		return nil
	end
	function Players:GetNameFromUserIdAsync(id)
		return "Player" .. id
	end

	local Marketplace = { PromptGamePassPurchaseFinished = signal(), PromptProductPurchaseFinished = signal() }
	function Marketplace:PromptProductPurchase(player, id)
		table.insert(rt.prompts, { kind = "product", userId = player.UserId, id = id })
	end
	function Marketplace:PromptGamePassPurchase(player, id)
		table.insert(rt.prompts, { kind = "gamePass", userId = player.UserId, id = id })
	end
	function Marketplace:PromptSubscriptionPurchase(player, id)
		table.insert(rt.prompts, { kind = "subscription", userId = player.UserId, id = id })
	end
	function Marketplace:GetProductInfo(id, _infoType)
		return { PriceInRobux = rt.livePrices and rt.livePrices[id] or nil }
	end
	function Marketplace:UserOwnsGamePassAsync(userId, id)
		return rt.ownedPasses[userId .. ":" .. id] == true
	end
	function Marketplace:GetUserSubscriptionStatusAsync(player, _id)
		return rt.subscriptions[player.UserId] or { IsSubscribed = false, IsRenewing = false }
	end

	local DataStoreService = {}
	function DataStoreService:GetDataStore(name)
		if rt.unpublished then
			error("You must publish this place to the web to access DataStore.")
		end
		return dataStore(backend, name)
	end
	function DataStoreService:GetRequestBudgetForRequestType()
		return 100
	end

	local MessagingService = {}
	function MessagingService:SubscribeAsync(topic, cb)
		backend.topics[topic] = backend.topics[topic] or {}
		table.insert(backend.topics[topic], { runtime = rt, cb = cb })
	end
	function MessagingService:PublishAsync(topic, data)
		for _, sub in backend.topics[topic] or {} do
			sub.runtime.task.spawn(sub.cb, { Data = data, Sent = rt.clock })
		end
	end

	local HttpService = {}
	function HttpService:JSONEncode(v)
		return serde.encode("json", v)
	end
	function HttpService:JSONDecode(s)
		return serde.decode("json", s)
	end
	local guid = 0
	function HttpService:GenerateGUID()
		guid += 1
		return "guid-" .. guid
	end
	function HttpService:GetSecret()
		error("no secrets in tests")
	end
	function HttpService:RequestAsync()
		error("no network in tests")
	end

	local RunService = { Heartbeat = signal() }
	function RunService:IsStudio()
		return true
	end

	local PolicyService = {}
	function PolicyService:GetPolicyInfoForPlayerAsync(player)
		return player.policy or { ArePaidRandomItemsRestricted = false, AreAdsAllowed = false }
	end

	local AnalyticsService = {}
	function AnalyticsService:LogCustomEvent(player, name, value, fields)
		table.insert(rt.analytics, { userId = player.UserId, name = name, value = value, fields = fields })
	end
	function AnalyticsService:LogEconomyEvent() end
	function AnalyticsService:LogOnboardingFunnelStepEvent(player, step, name)
		table.insert(rt.analytics, { userId = player.UserId, name = "funnel", value = step, fields = { step = name } })
	end

	local mocks = {
		Players = Players,
		MarketplaceService = Marketplace,
		DataStoreService = DataStoreService,
		MessagingService = MessagingService,
		HttpService = HttpService,
		RunService = RunService,
		PolicyService = PolicyService,
		AnalyticsService = AnalyticsService,
		ScriptContext = { Error = signal() },
	}
	self.services = mocks

	local game = setmetatable({ JobId = self.jobId, PlaceVersion = 1, PlaceId = 1 }, {
		__index = function(_, key)
			if key == "GetService" then
				return function(_, name)
					return mocks[name] or place:GetService(name)
				end
			elseif key == "BindToClose" then
				return function(_, fn)
					table.insert(rt.closeHandlers, fn)
				end
			end
			return nil
		end,
	})
	self.game = game

	local Random = {}
	function Random.new(seed)
		local r = { state = seed or 12345 }
		function r:NextNumber(min, max)
			local x = math.random()
			if min then
				return min + (max - min) * x
			end
			return x
		end
		function r:NextInteger(min, max)
			return math.random(min, max)
		end
		return r
	end

	local rtOs = table.clone(os)
	rtOs.clock = function()
		return rt.clock
	end
	rtOs.time = function()
		return math.floor(rt.epoch + rt.clock)
	end

	self.env = {
		game = game,
		workspace = place:GetService("Workspace"),
		Instance = roblox.Instance,
		Enum = roblox.Enum,
		Vector3 = roblox.Vector3,
		Vector2 = roblox.Vector2,
		CFrame = roblox.CFrame,
		Color3 = roblox.Color3,
		UDim = roblox.UDim,
		UDim2 = roblox.UDim2,
		Font = roblox.Font,
		Random = Random,
		task = self.task,
		os = rtOs,
		warn = function(...)
			table.insert(rt.logs, table.concat({ ... }, " "))
		end,
		print = function(...)
			table.insert(rt.logs, table.concat({ ... }, " "))
		end,
	}
end

-- Loads a ModuleScript or Script instance with the runtime's globals.
function Runtime:require(inst)
	local key = inst:GetFullName()
	if self.cache[key] ~= nil then
		return self.cache[key]
	end
	local env = table.clone(self.env)
	env.script = inst
	env.require = function(target)
		return self:require(target)
	end
	local chunk = luau.load(inst.Source, { debugName = inst:GetFullName(), environment = env, injectGlobals = true })
	local result = chunk()
	self.cache[key] = if result == nil then true else result
	return result
end

-- Starts the server (runs Server/Main).
function Runtime:start()
	local main = self.place:GetService("ServerScriptService").Server.Main
	self:run(function()
		self:require(main)
	end)
	self:assertNoErrors()
end

-- Runs fn inside the scheduler and advances virtual time until it finishes (max `limit` seconds).
function Runtime:run(fn, limit: number?)
	local done, results = false, nil
	self.task.spawn(function()
		results = table.pack(fn())
		done = true
	end)
	local waited = 0
	while not done and waited < (limit or 120) do
		self:advance(0.1)
		waited += 0.1
	end
	assert(done, "runtime:run timed out")
	return table.unpack(results, 1, results.n)
end

-- Advances virtual time, firing Heartbeat every frame and resuming due threads.
function Runtime:advance(seconds: number, frame: number?)
	frame = frame or 1 / 30
	local target = self.clock + seconds
	local prev = currentRuntime
	currentRuntime = self
	while self.clock < target - 1e-9 do
		local dt = math.min(frame, target - self.clock)
		self.clock += dt
		self.services.RunService.Heartbeat:Fire(dt)
		if self.onFrame then
			self.onFrame(dt)
		end
		self:_runDue()
	end
	currentRuntime = prev
end

function Runtime:assertNoErrors()
	if #self.errors > 0 then
		error("server errors:\n" .. table.concat(self.errors, "\n---\n"), 2)
	end
end

-- Adds a fake player with a character standing at the harbor spawn.
function Runtime:join(userId: number, opts: any?)
	local rt = self
	local character = roblox.Instance.new("Model")
	character.Name = "Player" .. userId
	local root = roblox.Instance.new("Part")
	root.Name = "HumanoidRootPart"
	placePart(root, roblox.CFrame.new(0, 5, 40))
	root.Parent = character
	character.PrimaryPart = root
	local humanoid = roblox.Instance.new("Humanoid")
	humanoid.Parent = character
	local player = {
		UserId = userId,
		Name = "Player" .. userId,
		DisplayName = "Player" .. userId,
		Parent = self.services.Players,
		Character = character,
		inbox = {},
		kicked = nil,
		policy = opts and opts.policy,
		joinData = opts and opts.joinData or {},
	}
	function player:Kick(message)
		player.kicked = message
		local i = table.find(rt.players, player)
		if i then
			table.remove(rt.players, i)
			rt.services.Players.PlayerRemoving:Fire(player)
		end
		player.Parent = nil
	end
	function player:GetJoinData()
		return player.joinData
	end
	function player:IsFriendsWith(_otherId)
		return false
	end
	table.insert(self.players, player)
	self:run(function()
		self.services.Players.PlayerAdded:Fire(player)
	end)
	self:advance(0.5)
	return player
end

function Runtime:leave(player)
	local i = table.find(self.players, player)
	if i then
		table.remove(self.players, i)
	end
	self:run(function()
		self.services.Players.PlayerRemoving:Fire(player)
	end)
	self:advance(0.5)
	player.Parent = nil
end

-- Calls a RemoteFunction as the client would.
function Runtime:invoke(player, remoteName: string, ...)
	local remote = self.place:GetService("ReplicatedStorage").Remotes[remoteName]
	local handler = remoteInvoke[rid(remote)]
	assert(handler, "no OnServerInvoke for " .. remoteName)
	local args = table.pack(...)
	return self:run(function()
		return handler(player, table.unpack(args, 1, args.n))
	end)
end

-- Fires a RemoteEvent from the client.
function Runtime:fire(player, remoteName: string, ...)
	local remote = self.place:GetService("ReplicatedStorage").Remotes[remoteName]
	local args = table.pack(...)
	self:run(function()
		remote.OnServerEvent:Fire(player, table.unpack(args, 1, args.n))
	end)
end

-- Server modules, for white-box checks.
function Runtime:service(name: string)
	return self:require(self.place:GetService("ServerScriptService").Server.Services[name])
end

function Runtime:shared(path: string)
	local inst = self.place:GetService("ReplicatedStorage").Shared
	for part in string.gmatch(path, "[^%.]+") do
		inst = inst[part]
	end
	return self:require(inst)
end

-- Latest state pushed to a player.
function Runtime:state(player)
	local list = player.inbox.State
	return list and list[#list][1] or nil
end

function Runtime:shutdown()
	for _, fn in self.closeHandlers do
		self:run(fn)
	end
end

function Runtime:eventCount(name: string, userId: number?): number
	local n = 0
	for _, e in self.analytics do
		if e.name == name and (userId == nil or e.userId == userId) then
			n += 1
		end
	end
	return n
end

return Runtime
