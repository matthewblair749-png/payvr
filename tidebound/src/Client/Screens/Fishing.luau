--[[
	Fishing: cast, wait for the bite (3 to 8 seconds by rod), then a 1.2 second timing bar.
	A marker sweeps across; tapping inside the highlighted zone lands the fish.
	The server chose the bite time and zone; the client only reports where in the window the tap landed.
]]

local RunService = game:GetService("RunService")

local Ui = require(script.Parent.Parent.Ui.Ui)
local Theme = require(script.Parent.Parent.Ui.Theme)

return {
	title = "panel_fishing",
	build = function(app: any, container: Frame)
		local L = app.L
		local s = app.state
		local rod = app.cfg.index.rodsByTier[s.rods.equipped]
		Ui.text(container, L("fishing_rod", { rod = L(rod.id), tier = rod.tier }), { TextSize = 18 })
		local status = Ui.text(container, L("fishing_ready"), { TextSize = 20 })
		local bar = Ui.frame(container, { Size = UDim2.new(1, 0, 0, 56), BackgroundColor3 = Theme.colors.bg })
		Ui.corner(bar, 10)
		local zone = Ui.frame(bar, { BackgroundColor3 = Theme.colors.good, Size = UDim2.fromScale(0, 1), Visible = false })
		local marker = Ui.frame(bar, { BackgroundColor3 = Theme.colors.accent, Size = UDim2.new(0, 6, 1, 0), Visible = false })
		local castButton
		local casting = false
		local window = nil -- { castId, biteAt, zoneCenter, zoneHalfWidth, minigameSeconds }
		local connection = nil

		local function reset(text: string)
			casting = false
			window = nil
			zone.Visible = false
			marker.Visible = false
			if connection then
				connection:Disconnect()
				connection = nil
			end
			status.Text = text
			castButton.Text = L("fishing_cast")
		end

		local function tap()
			if not window then
				return
			end
			local now = workspace:GetServerTimeNow()
			if now < window.biteAt then
				reset(L("fishing_too_soon"))
				return
			end
			local offset = math.clamp(now - window.biteAt, 0, window.minigameSeconds)
			local w = window
			window = nil
			local reply = app:intent("reel", { castId = w.castId, tap = offset })
			if reply.ok and reply.data.caught then
				app:haptic(0.6)
				local fish = app.cfg.index.fish[reply.data.fishId]
				local key = if reply.data.perfect then "fishing_caught_perfect" else "fishing_caught"
				reset(L(key, { fish = L(fish.id), rarity = L("rarity_" .. fish.rarity) }))
			elseif reply.ok then
				reset(L("fishing_missed"))
			else
				reset(L("fishing_ready"))
			end
		end

		castButton = Ui.button(container, L("fishing_cast"), function()
			if casting then
				tap()
				return
			end
			casting = true
			castButton.Text = L("fishing_reel")
			status.Text = L("fishing_waiting")
			local reply = app:intent("cast")
			if not reply.ok then
				reset(L("fishing_ready"))
				return
			end
			window = reply.data
			zone.Visible = true
			zone.Position = UDim2.fromScale((window.zoneCenter - window.zoneHalfWidth) / window.minigameSeconds, 0)
			zone.Size = UDim2.fromScale(window.zoneHalfWidth * 2 / window.minigameSeconds, 1)
			connection = RunService.RenderStepped:Connect(function()
				if not window then
					return
				end
				local now = workspace:GetServerTimeNow()
				if now < window.biteAt then
					marker.Visible = false
					return
				end
				if not marker.Visible then
					status.Text = L("fishing_bite")
					app:haptic(0.3)
				end
				marker.Visible = true
				local progress = (now - window.biteAt) / window.minigameSeconds
				marker.Position = UDim2.new(math.clamp(progress, 0, 1), -3, 0, 0)
				if progress > 1.3 then
					reset(L("fishing_escaped"))
				end
			end)
		end, { Size = UDim2.new(1, 0, 0, 64), TextSize = 22 })

		-- Rods: buy and equip.
		Ui.text(container, L("fishing_rods"), { FontFace = Theme.fontBold })
		for _, r in app.cfg.day.fishing.rods do
			local row = Ui.row(container)
			local owned = table.find(s.rods.owned, r.tier) ~= nil
			Ui.text(row, L(r.id) .. "  " .. L("fishing_wait", { min = r.minWaitSeconds, max = r.maxWaitSeconds }), { Size = UDim2.new(0.55, 0, 0, 48) })
			if owned then
				Ui.button(row, if s.rods.equipped == r.tier then L("equipped") else L("equip"), function()
					app:intent("equipRod", { tier = r.tier })
				end, { Size = UDim2.new(0.4, 0, 0, 48) })
			else
				Ui.button(row, L("buy_silver", { price = r.priceSilver, level = r.levelRequired }), function()
					app:intent("buyRod", { tier = r.tier })
				end, { Size = UDim2.new(0.4, 0, 0, 48) })
			end
		end
		return function()
			if connection then
				connection:Disconnect()
			end
		end
	end,
	-- The minigame keeps its own state, so do not rebuild while it is open.
	static = true,
}
