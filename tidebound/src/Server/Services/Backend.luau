--[[
	Client for the Tidebound companion backend (see /backend). Optional: with no URL configured
	every call is a no-op, so the game runs fully without it.
	Configure: ServerScriptService.Server attribute "BackendUrl", and the secret "tidebound_backend" in the
	experience's Secrets store (Creator Hub > Experience > Secrets).
]]

local HttpService = game:GetService("HttpService")
local ServerScriptService = game:GetService("ServerScriptService")

local Backend = {}

local url: string? = nil
local secret: any = nil

function Backend.init()
	local root = ServerScriptService:FindFirstChild("Server")
	url = root and root:GetAttribute("BackendUrl") or nil
	if url == "" then
		url = nil
	end
	if url then
		local ok, value = pcall(HttpService.GetSecret, HttpService, "tidebound_backend")
		secret = if ok then value else nil
	end
end

function Backend.enabled(): boolean
	return url ~= nil and secret ~= nil
end

function Backend.post(path: string, body: any): (boolean, any)
	if not Backend.enabled() then
		return false, "disabled"
	end
	local ok, response = pcall(HttpService.RequestAsync, HttpService, {
		Url = url .. path,
		Method = "POST",
		Headers = {
			["Content-Type"] = "application/json",
			["Authorization"] = secret:AddPrefix("Bearer "),
		},
		Body = HttpService:JSONEncode(body),
	})
	if not ok then
		return false, response
	end
	if not response.Success then
		return false, response.StatusCode
	end
	local decodedOk, decoded = pcall(HttpService.JSONDecode, HttpService, response.Body)
	return true, if decodedOk then decoded else nil
end

return Backend
