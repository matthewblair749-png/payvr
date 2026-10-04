--[[
	Guided first minute: welcome, first cast, sell, hatch, assign a role, then a gentle countdown to the
	reduced first night. The server logs every step. A small Skip button is always available.
	No purchase prompt appears anywhere in this flow.
]]

local Ui = require(script.Parent.Parent.Ui.Ui)
local Theme = require(script.Parent.Parent.Ui.Theme)
local Format = require(script.Parent.Parent.Ui.Format)

local Onboarding = {}

function Onboarding.mount(app: any, gui: ScreenGui)
	local L = app.L
	local card = Ui.frame(gui, {
		Name = "Guide",
		BackgroundColor3 = Color3.new(1, 1, 1),
		Size = UDim2.new(0.62, 0, 0, 0),
		AutomaticSize = Enum.AutomaticSize.Y,
		Position = UDim2.new(0.5, 0, 1, -100),
		AnchorPoint = Vector2.new(0.5, 1),
		Visible = false,
	})
	Ui.gradient(card, Theme.colors.panelAlt, Theme.colors.bg)
	Ui.corner(card, 18)
	Ui.stroke(card, Theme.colors.accent, 3.5, true)
	Ui.padding(card, 14)
	Ui.list(card, 10, false, Enum.HorizontalAlignment.Center)
	local width = Instance.new("UISizeConstraint")
	width.MinSize = Vector2.new(320, 0)
	width.MaxSize = Vector2.new(620, math.huge)
	width.Parent = card
	local text = Ui.text(card, "", { TextSize = 22, TextXAlignment = Enum.TextXAlignment.Center })
	local actions = Ui.frame(card, { BackgroundTransparency = 1, Size = UDim2.new(1, 0, 0, 56) })
	Ui.list(actions, 10, true, Enum.HorizontalAlignment.Center)

	local lastKey = nil
	local function render()
		local s = app.state
		if not s or app.inNight then
			card.Visible = false
			return
		end
		local ob = s.onboarding
		local now = workspace:GetServerTimeNow()
		local key, buttons = nil, {}
		if not ob.done then
			if ob.step == 0 then
				key = "guide_welcome"
				buttons = { { L("guide_start"), function()
					app:intent("onboarding", { action = "start" })
				end } }
			elseif ob.step == 1 then
				key = "guide_cast"
				buttons = { { L("hud_fish"), function()
					app:open("fishing")
				end } }
			elseif ob.step == 2 then
				key = "guide_sell"
				buttons = { { L("hud_market"), function()
					app:open("market")
				end } }
			elseif ob.step == 3 then
				key = "guide_hatch"
				buttons = { { L("hud_drifters"), function()
					app:open("drifters")
				end } }
			elseif ob.step == 4 then
				key = "guide_role"
				local d = s.drifters[1]
				if d then
					buttons = {
						{ L("role_worker"), function()
							app:intent("setRole", { drifter = d.id, role = "worker" })
						end },
						{ L("role_guardian"), function()
							app:intent("setRole", { drifter = d.id, role = "guardian" })
						end },
					}
				end
			end
			table.insert(buttons, { L("guide_skip"), function()
				app:intent("onboarding", { action = "skip" })
			end, true })
		elseif ob.firstNightAt and not s.night.firstCompleted then
			key = "guide_countdown"
		end
		card.Visible = key ~= nil
		if not key then
			return
		end
		local args = nil
		if key == "guide_countdown" then
			args = { time = Format.duration(ob.firstNightAt - now) }
		end
		text.Text = L(key, args)
		if key ~= lastKey then
			lastKey = key
			Ui.popIn(card)
			Ui.clear(actions)
			for _, b in buttons do
				local small = b[3] == true
				Ui.button(actions, b[1], b[2], {
					Size = UDim2.new(0, if small then 100 else 180, 0, 48),
					BackgroundColor3 = if small then Theme.colors.panelAlt else Theme.colors.good,
					TextSize = if small then 14 else 18,
				})
			end
		end
	end
	app.StateChanged:Connect(render)
	task.spawn(function()
		while gui.Parent do
			render()
			task.wait(1)
		end
	end)
end

return Onboarding
