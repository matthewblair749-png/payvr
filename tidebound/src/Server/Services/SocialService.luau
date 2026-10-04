--[[
	Player-to-player communication without free text: preset quick phrases and emotes only.
	Free-text chat is off (TextChatService has no channels; see default.project.json).
	Every interaction can be reported; blocking uses Roblox's own block list on the client
	plus a game-side mute list in the save, so blocked players' phrases are hidden.
]]

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local RateLimiter = require(Shared.Util.RateLimiter)
local Validate = require(Shared.Util.Validate)

local Stores = require(script.Parent.Stores)
local ConfigService = require(script.Parent.ConfigService)
local DataService = require(script.Parent.DataService)
local PlayerService = require(script.Parent.PlayerService)
local NightService = require(script.Parent.NightService)
local Backend = require(script.Parent.Backend)
local Logger = require(script.Parent.Logger)
local Remotes = require(script.Parent.Remotes)

local SocialService = {}

local chatLimiter = nil
local reportLimiter = RateLimiter.new(1 / 30, 3)
local reports = nil

local function recipients(sender: Player): { Player }
	-- At night, phrases go to the squad; by day, to everyone in the harbor.
	if NightService.roomOf(sender) then
		return NightService.squadOf(sender)
	end
	return Players:GetPlayers()
end

local function onQuickChat(sender: Player, kind: any, id: any)
	if not chatLimiter:allow(sender, os.clock()) then
		return
	end
	local cfg = ConfigService.get()
	local save = DataService.saveOf(sender)
	if not save or not Validate.id(id) then
		return
	end
	if kind == "phrase" then
		if not table.find(cfg.compliance.quickPhrases, id) then
			PlayerService.flag(sender, "bad_phrase")
			return
		end
	elseif kind == "emote" then
		local owned = table.find(cfg.compliance.emotes, id) ~= nil or (save.cosmetics[id] or 0) > 0
		if not owned or string.sub(id, 1, 6) ~= "emote_" then
			return
		end
	else
		return
	end
	for _, p in recipients(sender) do
		Remotes.get("QuickChat"):FireClient(p, sender.UserId, kind, id)
	end
end

local function onSocial(player: Player, action: any, args: any): any
	local cfg = ConfigService.get()
	if action == "report" then
		if type(args) ~= "table" or not Validate.int(args.userId, 1, 1e15) or not table.find(cfg.compliance.reportReasons, args.reason) then
			return { ok = false, err = "bad_args" }
		end
		if not reportLimiter:allow(player, os.clock()) then
			return { ok = false, err = "slow_down" }
		end
		local record = {
			reporter = player.UserId,
			reported = args.userId,
			reason = args.reason,
			context = if NightService.roomOf(player) then "night" else "harbor",
			at = os.time(),
			job = game.JobId,
		}
		local key = "r" .. args.userId .. "_" .. player.UserId .. "_" .. os.time()
		task.spawn(function()
			pcall(reports.SetAsync, reports, key, record)
			Backend.post("/v1/reports", record)
		end)
		Logger.info("player_reported", record)
		return { ok = true }
	elseif action == "block" or action == "unblock" then
		local result = PlayerService.apply(player, { type = action, args = { userId = type(args) == "table" and args.userId or nil } })
		PlayerService.pushState(player)
		return { ok = result.ok, err = result.err }
	end
	return { ok = false, err = "unknown_action" }
end

function SocialService.init()
	chatLimiter = RateLimiter.new(ConfigService.get().night.quickChatPerSecond, 3)
	reports = Stores.get("Reports")
	Remotes.get("QuickChat").OnServerEvent:Connect(onQuickChat)
	Remotes.get("Social").OnServerInvoke = onSocial
	Players.PlayerRemoving:Connect(function(p)
		chatLimiter:forget(p)
		reportLimiter:forget(p)
	end)
end

return SocialService
