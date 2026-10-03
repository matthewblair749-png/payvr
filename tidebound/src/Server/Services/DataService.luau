--[[
	Cloud save with session locking.

	Record in the "Players" DataStore, key "u<userId>":
	  { data = <save>, lock = { jobId, at } | nil, updatedAt }

	Multi-device policy: Roblox lets an account run one game session at a time. If a second server loads
	the save while the first still holds the lock, it waits for the first to release (it does on leave),
	and takes over a lock older than LOCK_TIMEOUT. A server that lost its lock can never write again:
	every save is an UpdateAsync that checks the lock first (optimistic concurrency), so an old session
	cannot overwrite newer progress. The losing server tells the player and removes them.

	Purchases call saveNow() and only confirm the receipt to Roblox once the write succeeded.
]]

local DataStoreService = game:GetService("DataStoreService")
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")

local Logger = require(script.Parent.Logger)

local DataService = {}

local STORE_NAME = "Players"
local LOCK_TIMEOUT = 120
local LOAD_ATTEMPTS = 8
local LOAD_RETRY_SECONDS = 4
local AUTOSAVE_SECONDS = 60

local store = nil
local profiles: { [Player]: any } = {}

local function key(userId: number): string
	return "u" .. tostring(userId)
end

local function waitForBudget(requestType: Enum.DataStoreRequestType)
	local deadline = os.clock() + 10
	while DataStoreService:GetRequestBudgetForRequestType(requestType) < 1 and os.clock() < deadline do
		task.wait(0.5)
	end
end

--[[
	Loads and locks a save. Returns (rawSave | nil for a new player, ok).
	ok = false means the DataStore could not be reached; the caller must not create a fresh save over it.
]]
function DataService.load(userId: number): (any, boolean)
	for attempt = 1, LOAD_ATTEMPTS do
		local lockedElsewhere = false
		local loaded = nil
		waitForBudget(Enum.DataStoreRequestType.UpdateAsync)
		local ok, err = pcall(store.UpdateAsync, store, key(userId), function(old)
			local now = os.time()
			if old and old.lock and old.lock.jobId ~= game.JobId and now - old.lock.at < LOCK_TIMEOUT and attempt < LOAD_ATTEMPTS then
				lockedElsewhere = true
				return nil
			end
			if old and old.lock and old.lock.jobId ~= game.JobId then
				Logger.warn("session_lock_taken_over", { userId = userId, from = old.lock.jobId, age = now - old.lock.at })
			end
			old = old or {}
			loaded = old.data
			old.lock = { jobId = game.JobId, at = now }
			old.updatedAt = now
			return old
		end)
		if ok and not lockedElsewhere then
			return loaded, true
		end
		if not ok then
			Logger.warn("save_load_retry", { userId = userId, attempt = attempt, error = tostring(err) })
		end
		task.wait(LOAD_RETRY_SECONDS)
	end
	return nil, false
end

--[[
	Writes a save if this server still holds the lock. release = true clears the lock (player left).
	Returns true on success. Marks the profile as lost if another session owns the save now.
]]
function DataService.write(userId: number, save: any, release: boolean): boolean
	local lost = false
	waitForBudget(Enum.DataStoreRequestType.UpdateAsync)
	local ok, err = pcall(store.UpdateAsync, store, key(userId), function(old)
		if not old or not old.lock or old.lock.jobId ~= game.JobId then
			lost = true
			return nil
		end
		save.revision = (save.revision or 0) + 1
		old.data = save
		old.updatedAt = os.time()
		old.lock = if release then nil else { jobId = game.JobId, at = os.time() }
		return old
	end)
	if lost then
		Logger.error("session_lost", { userId = userId })
		local player = Players:GetPlayerByUserId(userId)
		if player and profiles[player] then
			profiles[player].lost = true
			player:Kick("Your harbor was opened in another session. Rejoin to keep playing.")
		end
		return false
	end
	if not ok then
		Logger.error("save_write_failed", { userId = userId, error = tostring(err) })
		return false
	end
	return true
end

function DataService.attach(player: Player, save: any)
	profiles[player] = { save = save, lost = false, savedAt = os.clock() }
end

function DataService.profile(player: Player): any
	return profiles[player]
end

function DataService.saveOf(player: Player): any
	local p = profiles[player]
	return p and not p.lost and p.save or nil
end

function DataService.saveNow(player: Player): boolean
	local p = profiles[player]
	if not p or p.lost then
		return false
	end
	local ok = DataService.write(player.UserId, p.save, false)
	if ok then
		p.savedAt = os.clock()
	end
	return ok
end

function DataService.release(player: Player)
	local p = profiles[player]
	profiles[player] = nil
	if p and not p.lost then
		DataService.write(player.UserId, p.save, true)
	end
end

-- Right to erasure: removes the save entirely. The player is removed from the server first.
function DataService.erase(userId: number): boolean
	local player = Players:GetPlayerByUserId(userId)
	if player then
		profiles[player] = nil
		player:Kick("Your Tidebound data has been deleted.")
	end
	local ok, err = pcall(store.RemoveAsync, store, key(userId))
	if not ok then
		Logger.error("erase_failed", { userId = userId, error = tostring(err) })
	end
	return ok
end

function DataService.init()
	store = DataStoreService:GetDataStore(STORE_NAME)
	task.spawn(function()
		while true do
			task.wait(AUTOSAVE_SECONDS)
			for player in profiles do
				task.spawn(DataService.saveNow, player)
			end
		end
	end)
	game:BindToClose(function()
		if RunService:IsStudio() then
			task.wait(1)
		end
		local pending = 0
		for player, p in profiles do
			if not p.lost then
				pending += 1
				task.spawn(function()
					DataService.write(player.UserId, p.save, true)
					pending -= 1
				end)
			end
		end
		local deadline = os.clock() + 25
		while pending > 0 and os.clock() < deadline do
			task.wait(0.2)
		end
	end)
end

return DataService
