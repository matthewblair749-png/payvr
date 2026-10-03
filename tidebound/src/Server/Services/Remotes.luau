--[[ Creates every remote once, in ReplicatedStorage.Remotes. Clients wait for this folder. ]]

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Remotes = {}

local DEFINITIONS = {
	-- Day intents (RemoteFunction: returns the result and fresh state).
	Intent = "RemoteFunction",
	-- Server pushes state, notices and offline summaries.
	State = "RemoteEvent",
	Notice = "RemoteEvent",
	-- Store: catalog view, purchase starts, spending summary.
	Store = "RemoteFunction",
	-- Account: data export, deletion, settings that touch other systems.
	Account = "RemoteFunction",
	-- Night: inputs from clients at the tick rate, snapshots back, reliable events for effects.
	NightInput = "UnreliableRemoteEvent",
	NightSnapshot = "UnreliableRemoteEvent",
	NightEvent = "RemoteEvent",
	NightControl = "RemoteFunction",
	-- Social: quick phrases, emotes, reports.
	QuickChat = "RemoteEvent",
	Social = "RemoteFunction",
	-- Client analytics for UI-only events and client error reports.
	Track = "RemoteEvent",
	ClientError = "RemoteEvent",
	-- Debug panel (only answers in Studio or for allowlisted testers on test places).
	Debug = "RemoteFunction",
}

function Remotes.init()
	local folder = ReplicatedStorage:FindFirstChild("Remotes") or Instance.new("Folder")
	folder.Name = "Remotes"
	for name, className in DEFINITIONS do
		if not folder:FindFirstChild(name) then
			local remote = Instance.new(className)
			remote.Name = name
			remote.Parent = folder
		end
	end
	folder.Parent = ReplicatedStorage
	Remotes.folder = folder
	return folder
end

function Remotes.get(name: string): any
	return Remotes.folder:FindFirstChild(name)
end

return Remotes
