--[[
	Checks a built place file: lune run tests/tools/inspect-place <file.rbxl> [release]
	Verifies the tree Rojo produced, and for release builds that the debug panel is absent.
]]

local fs = require("@lune/fs")
local process = require("@lune/process")
local roblox = require("@lune/roblox")

local path = process.args[1]
local release = process.args[2] == "release"
local game = roblox.deserializePlace(fs.readFile(path))

local failures = 0
local function check(cond, message)
	print((if cond then "  ok   " else "  FAIL ") .. message)
	if not cond then
		failures += 1
	end
end

local rs = game:GetService("ReplicatedStorage")
local sss = game:GetService("ServerScriptService")
local shared = rs:FindFirstChild("Shared")
check(shared ~= nil, "ReplicatedStorage.Shared exists")
check(shared and shared:FindFirstChild("Config") and #shared.Config:GetChildren() == 8, "8 config modules baked in as defaults")
check(sss:FindFirstChild("Server") and sss.Server:FindFirstChild("Main") ~= nil, "server entry point exists")
check(sss.Server:FindFirstChild("Services") and sss.Server.Services:FindFirstChild("StoreService") ~= nil, "StoreService exists")
local debugFolder = sss.Server:FindFirstChild("Debug")
if release then
	check(debugFolder == nil, "release build has no debug panel")
else
	check(debugFolder ~= nil, "development build includes the debug panel")
end
local tcs = game:GetService("TextChatService")
check(tcs.CreateDefaultTextChannels == false, "free-text chat channels are off")
local loc = game:GetService("LocalizationService"):FindFirstChild("TideboundStrings")
check(loc ~= nil and loc.ClassName == "LocalizationTable", "English string table is included")
local client = game:GetService("StarterPlayer").StarterPlayerScripts:FindFirstChild("Client")
check(client and client:FindFirstChild("Main") and client.Main.ClassName == "LocalScript", "client entry point is a LocalScript")
if failures > 0 then
	process.exit(1)
end
