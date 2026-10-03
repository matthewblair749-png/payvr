--[[
	Privacy controls inside the game:
	  * export: returns everything stored about the player as JSON (shown in a copyable text box)
	  * delete: two-step confirmation, then the save is erased and the player is removed
	Requests from Roblox's Right to Erasure process arrive through the companion backend, which deletes
	DataStore entries over Open Cloud and publishes on "tidebound-erase" so a live session is closed too.
]]

local HttpService = game:GetService("HttpService")
local MessagingService = game:GetService("MessagingService")
local Players = game:GetService("Players")

local DataService = require(script.Parent.DataService)
local Backend = require(script.Parent.Backend)
local Logger = require(script.Parent.Logger)
local Remotes = require(script.Parent.Remotes)

local AccountService = {}

local DELETE_CONFIRM_SECONDS = 120
local pendingDelete: { [Player]: { code: string, at: number } } = {}

local function onAccount(player: Player, action: any, args: any): any
	local save = DataService.saveOf(player)
	if not save then
		return { ok = false, err = "not_loaded" }
	end
	if action == "export" then
		local ok, json = pcall(HttpService.JSONEncode, HttpService, { userId = player.UserId, exportedAt = os.time(), save = save })
		Logger.info("data_exported", { userId = player.UserId })
		return { ok = ok, data = if ok then json else nil }
	elseif action == "requestDelete" then
		local code = string.format("%04d", math.random(0, 9999))
		pendingDelete[player] = { code = code, at = os.clock() }
		return { ok = true, data = { code = code } }
	elseif action == "confirmDelete" then
		local p = pendingDelete[player]
		pendingDelete[player] = nil
		if not p or type(args) ~= "table" or args.code ~= p.code or os.clock() - p.at > DELETE_CONFIRM_SECONDS then
			return { ok = false, err = "confirmation_failed" }
		end
		Logger.info("account_deleted", { userId = player.UserId })
		task.spawn(Backend.post, "/v1/erasure/in-game", { userId = player.UserId })
		DataService.erase(player.UserId)
		return { ok = true }
	end
	return { ok = false, err = "unknown_action" }
end

function AccountService.init()
	Remotes.get("Account").OnServerInvoke = onAccount
	Players.PlayerRemoving:Connect(function(p)
		pendingDelete[p] = nil
	end)
	task.spawn(function()
		pcall(MessagingService.SubscribeAsync, MessagingService, "tidebound-erase", function(message)
			local userId = type(message.Data) == "table" and tonumber(message.Data.userId) or tonumber(message.Data)
			if userId and Players:GetPlayerByUserId(userId) then
				DataService.erase(userId)
			end
		end)
	end)
end

return AccountService
