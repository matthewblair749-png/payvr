--[[ Shoreline forage nodes: ProximityPrompts send the forage intent; each node shows this player's respawn timer. ]]

local Format = require(script.Parent.Parent.Ui.Format)

local ForageNodes = {}

function ForageNodes.mount(app: any)
	local harbor = workspace:WaitForChild("Harbor", 30)
	local nodes = harbor and harbor:WaitForChild("ForageNodes", 30)
	if not nodes then
		return
	end
	local function prompts()
		local out = {}
		for _, node in nodes:GetChildren() do
			local prompt = node:FindFirstChildWhichIsA("ProximityPrompt", true)
			if prompt then
				out[node.Name] = prompt
			end
		end
		return out
	end
	for nodeId, prompt in prompts() do
		prompt.Triggered:Connect(function()
			local reply = app:intent("forage", { node = nodeId })
			if reply.ok then
				app:toast(app.L("forage_got", { amount = reply.data.amount, material = app.L("material_" .. reply.data.material) }))
			end
		end)
	end
	task.spawn(function()
		while true do
			local s = app.state
			if s then
				local now = workspace:GetServerTimeNow()
				for nodeId, prompt in prompts() do
					local readyAt = s.derived.nodesReadyAt[nodeId] or 0
					local ready = now >= readyAt
					prompt.Enabled = ready and not app.inNight
					prompt.ActionText = if ready then app.L("forage_gather") else Format.duration(readyAt - now)
				end
			end
			task.wait(1)
		end
	end)
end

return ForageNodes
