--[[
	Player lifecycle and day intents.
	  * Join: load (session-locked), migrate, catch up offline progress, send state.
	  * Every TICK seconds: advance timers, push state if anything changed.
	  * Intent remote: rate limit, validate, apply via IntentProcessor, reply with result and state.
	  * Leave: log session length, schedule opt-in notifications, save and release the lock.
]]

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local PolicyService = game:GetService("PolicyService")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Session = require(Shared.Session)
local IntentProcessor = require(Shared.Intents.IntentProcessor)
local ClientState = require(Shared.ClientState)
local Modifiers = require(Shared.Rules.Modifiers)
local Cycle = require(Shared.Rules.Cycle)
local Farming = require(Shared.Rules.Farming)
local TimeSim = require(Shared.Rules.TimeSim)
local Drifters = require(Shared.Rules.Drifters)
local Ledger = require(Shared.Store.Ledger)
local Rng = require(Shared.Util.Rng)
local RateLimiter = require(Shared.Util.RateLimiter)
local Signal = require(Shared.Util.Signal)

local ConfigService = require(script.Parent.ConfigService)
local DataService = require(script.Parent.DataService)
local HarborService = require(script.Parent.HarborService)
local Analytics = require(script.Parent.Analytics)
local Remotes = require(script.Parent.Remotes)
local Logger = require(script.Parent.Logger)
local Backend = require(script.Parent.Backend)

local PlayerService = {}
PlayerService.Loaded = Signal.new() -- (player, save)
PlayerService.Leaving = Signal.new() -- (player, save)

local TICK = 5
local MAX_INTENT_BYTES = 2000

local rng = Rng.fromRandom(Random.new())
local limiter = nil
local sessions: { [Player]: any } = {}

function PlayerService.now(): number
	return workspace:GetServerTimeNow()
end

function PlayerService.mods(now: number): any
	return Modifiers.current(ConfigService.get(), now, HarborService.tiers())
end

function PlayerService.session(player: Player): any
	return sessions[player]
end

function PlayerService.save(player: Player): any
	return DataService.saveOf(player)
end

-- Records a rule violation. Repeated violations kick the player and are logged for review.
function PlayerService.flag(player: Player, reason: string)
	local s = sessions[player]
	local save = DataService.saveOf(player)
	if not s or not save then
		return
	end
	s.violations += 1
	save.flags.violations = (save.flags.violations or 0) + 1
	Logger.warn("violation", { userId = player.UserId, reason = reason, count = s.violations })
	if s.violations >= ConfigService.get().compliance.rateLimits.violationsBeforeKick then
		player:Kick("Connection problem. Please rejoin.")
	end
end

function PlayerService.pushState(player: Player)
	local save = DataService.saveOf(player)
	if not save then
		return
	end
	local now = PlayerService.now()
	local cfg = ConfigService.get()
	Remotes.get("State"):FireClient(player, ClientState.build(cfg, save, now, PlayerService.mods(now), HarborService.tiers()), cfg.version)
end

function PlayerService.notice(player: Player, kind: string, data: any?)
	Remotes.get("Notice"):FireClient(player, kind, data)
end

local function context(player: Player, now: number): any
	local cfg = ConfigService.get()
	local s = sessions[player]
	return {
		cfg = cfg,
		now = now,
		rng = rng,
		userId = player.UserId,
		mods = PlayerService.mods(now),
		cycleIndex = Cycle.at(cfg, now).cycleIndex,
		adsAllowed = s and s.policy and s.policy.AreAdsAllowed == true or false,
	}
end

-- Applies an intent on the server's authority. Other services (Store, Night) reuse this.
function PlayerService.apply(player: Player, intent: any): any
	local save = DataService.saveOf(player)
	if not save then
		return { ok = false, err = "not_loaded", events = {} }
	end
	local now = PlayerService.now()
	local result = IntentProcessor.apply(context(player, now), save, intent)
	if result.ok and intent.type == "contribute" then
		local contribution = result.data.contribution
		local shared, unlocked = HarborService.contribute(contribution)
		if not shared then
			-- Give the materials back: the shared write failed.
			for m, n in contribution.materials do
				save.materials[m] += n
			end
			return { ok = false, err = "harbor_busy", events = {} }
		end
		for _, u in unlocked do
			table.insert(result.events, { name = "harbor_tier_unlocked", props = u })
		end
	end
	Analytics.trackAll(player, result.events)
	if result.ok and intent.type == "sellAll" then
		Analytics.economy(player, true, "Silver", result.data.silver, save.currencies.silver, Enum.AnalyticsEconomyTransactionType.Gameplay, "market_sell_all")
	elseif result.ok and intent.type == "hatch" then
		Analytics.economy(player, false, "Silver", ConfigService.get().economy.eggPriceSilver, save.currencies.silver, Enum.AnalyticsEconomyTransactionType.Shop, "egg")
	elseif result.ok and intent.type == "buyGemItem" then
		Analytics.economy(player, false, "Gems", result.data.item.gems, save.currencies.gems, Enum.AnalyticsEconomyTransactionType.Shop, result.data.item.id)
	end
	if sessions[player] then
		sessions[player].dirty = true
	end
	return result
end

local function onIntent(player: Player, intent: any, seq: any): any
	local s = sessions[player]
	if not s then
		return { ok = false, err = "not_loaded" }
	end
	local now = os.clock()
	if not limiter:allow(player, now) then
		PlayerService.flag(player, "rate_limited")
		return { ok = false, err = "slow_down" }
	end
	if type(seq) ~= "number" or seq ~= seq or seq % 1 ~= 0 then
		PlayerService.flag(player, "bad_seq")
		return { ok = false, err = "bad_seq" }
	end
	-- Replays after a reconnect: each sequence number is applied at most once.
	if seq <= s.lastSeq then
		return { ok = true, duplicate = true, seq = s.lastSeq }
	end
	local okSize, encoded = pcall(game:GetService("HttpService").JSONEncode, game:GetService("HttpService"), intent)
	if not okSize or #encoded > MAX_INTENT_BYTES then
		PlayerService.flag(player, "oversized_intent")
		return { ok = false, err = "bad_intent" }
	end
	if type(intent) == "table" and intent.type == "adDoubleSale" then
		-- Ad rewards are granted by AdService callbacks only.
		return { ok = false, err = "server_only" }
	end
	s.lastSeq = seq
	local result = PlayerService.apply(player, intent)
	if not result.ok and (result.err == "bad_args" or result.err == "bad_intent" or result.err == "too_early" or result.err == "unknown_intent") then
		PlayerService.flag(player, result.err)
	end
	PlayerService.pushState(player)
	return { ok = result.ok, err = result.err, data = result.data, seq = seq }
end

local function loadPolicy(player: Player): any
	local ok, policy = pcall(PolicyService.GetPolicyInfoForPlayerAsync, PolicyService, player)
	if ok then
		return policy
	end
	-- Unknown policy: assume the strictest settings.
	return { ArePaidRandomItemsRestricted = true, AreAdsAllowed = false }
end

local function onPlayerAdded(player: Player)
	local raw, ok = DataService.load(player.UserId)
	if not ok then
		player:Kick("We couldn't load your harbor. Please try again in a minute.")
		return
	end
	if not player.Parent then
		return
	end
	local cfg = ConfigService.get()
	local now = PlayerService.now()
	local okJoin, save, summary = pcall(Session.join, cfg, raw, player.UserId, now, PlayerService.mods(now))
	if not okJoin then
		Logger.error("join_failed", { userId = player.UserId, error = tostring(save) })
		player:Kick("Your save needs a newer version of the game. Please rejoin shortly.")
		return
	end
	DataService.attach(player, save)
	sessions[player] = {
		joinedAt = os.clock(),
		lastSeq = 0,
		violations = 0,
		dirty = true,
		policy = loadPolicy(player),
		platform = "unknown",
	}
	if summary.migratedFrom then
		Logger.info("save_migrated", { userId = player.UserId, from = summary.migratedFrom })
	end
	if summary.login then
		Analytics.economy(player, true, "Silver", summary.login.entries[1] and summary.login.entries[1].n or 0, save.currencies.silver, Enum.AnalyticsEconomyTransactionType.TimedReward, "login_streak")
	end
	Analytics.track(player, "session_started", { isNew = summary.isNew })
	-- Opened from an experience notification: the launch data names the type.
	local joinData = player:GetJoinData()
	local launch = joinData and joinData.LaunchData
	if type(launch) == "string" and string.sub(launch, 1, 6) == "notif:" then
		Analytics.track(player, "notification_opened", { type = string.sub(launch, 7, 40) })
	end
	PlayerService.pushState(player)
	PlayerService.notice(player, "welcome", { isNew = summary.isNew, away = summary.away, login = summary.login })
	PlayerService.Loaded:Fire(player, save)
end

-- Upcoming "crops ready" and "worker income full" times for opt-in notifications.
local function scheduleNotifications(player: Player, save: any)
	if not Backend.enabled() then
		return
	end
	local cfg = ConfigService.get()
	local now = PlayerService.now()
	local mods = PlayerService.mods(now)
	local candidates = {}
	local latest = 0
	for _, plot in save.plots do
		local ready = Farming.readyAt(cfg, plot, mods)
		if ready and ready > now then
			latest = math.max(latest, ready)
		end
	end
	if latest > 0 then
		table.insert(candidates, { type = "crops_ready", at = latest })
	end
	local cap = TimeSim.workerCap(cfg, save)
	local perMinute = Drifters.workerIncomePerMinute(cfg, save)
	if perMinute > 0 and save.worker.pending < cap then
		table.insert(candidates, { type = "worker_income_full", at = now + (cap - save.worker.pending) / perMinute * 60 })
	end
	task.spawn(Backend.post, "/v1/notifications/schedule", { userId = player.UserId, candidates = candidates, settings = save.settings.notifications })
end

local function onPlayerRemoving(player: Player)
	local s = sessions[player]
	local save = DataService.saveOf(player)
	if s and save then
		PlayerService.Leaving:Fire(player, save)
		local now = PlayerService.now()
		Session.tick(ConfigService.get(), save, now, PlayerService.mods(now))
		Session.leave(save, now)
		Analytics.track(player, "session_length", { seconds = math.floor(os.clock() - s.joinedAt), platform = s.platform })
		scheduleNotifications(player, save)
	end
	sessions[player] = nil
	limiter:forget(player)
	DataService.release(player)
end

function PlayerService.grantEntries(player: Player, entries: { any })
	local save = DataService.saveOf(player)
	if save then
		Ledger.apply(save, entries)
		if sessions[player] then
			sessions[player].dirty = true
		end
	end
end

function PlayerService.init()
	local rl = ConfigService.get().compliance.rateLimits
	limiter = RateLimiter.new(rl.intentsPerSecond, rl.intentBurst)
	Remotes.get("Intent").OnServerInvoke = onIntent
	Players.PlayerAdded:Connect(onPlayerAdded)
	Players.PlayerRemoving:Connect(onPlayerRemoving)
	for _, player in Players:GetPlayers() do
		task.spawn(onPlayerAdded, player)
	end
	Remotes.get("Track").OnServerEvent:Connect(function(player, name, props)
		-- Only UI events may come from clients; everything else is logged by the server itself.
		local allowed = { store_opened = true, product_viewed = true, starter_offer_shown = true }
		if type(name) ~= "string" or not allowed[name] or not limiter:allow(player, os.clock(), 0.5) then
			return
		end
		local clean = {}
		if type(props) == "table" then
			for _, k in { "source", "productId", "variantId" } do
				if type(props[k]) == "string" and #props[k] <= 64 then
					clean[k] = props[k]
				end
			end
		end
		Analytics.track(player, name, clean)
	end)
	Remotes.get("ClientError").OnServerEvent:Connect(function(player, message, trace)
		if limiter:allow(player, os.clock(), 2) and type(message) == "string" then
			Logger.error("client_error", { userId = player.UserId, message = string.sub(message, 1, 500), trace = type(trace) == "string" and string.sub(trace, 1, 1000) or nil })
		end
	end)
	task.spawn(function()
		while true do
			task.wait(TICK)
			local cfg = ConfigService.get()
			local now = PlayerService.now()
			local mods = PlayerService.mods(now)
			for player, s in sessions do
				local save = DataService.saveOf(player)
				if save then
					local summary = Session.tick(cfg, save, now, mods)
					if summary.autoCollected and summary.autoCollected > 0 then
						s.dirty = true
					end
					-- Clients count down timers locally; a periodic push keeps them honest.
					if s.dirty or summary.silver > 0 then
						s.dirty = false
						PlayerService.pushState(player)
					end
				end
			end
		end
	end)
	ConfigService.Changed:Connect(function()
		for player in sessions do
			PlayerService.pushState(player)
		end
	end)
end

return PlayerService
