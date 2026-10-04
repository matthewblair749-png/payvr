--[[ One panel at a time: an outlined sheet with a gold title ribbon, a round red close button, and a bounce-in. ]]

local Ui = require(script.Parent.Ui)
local Theme = require(script.Parent.Theme)

local PanelHost = {}

function PanelHost.mount(app: any, gui: ScreenGui)
	local c = Theme.colors
	local dim = Ui.frame(gui, { Name = "Dim", BackgroundColor3 = Color3.new(0, 0, 0), BackgroundTransparency = 0.55, Size = UDim2.fromScale(1, 1), Visible = false })
	local sheet = Ui.frame(gui, {
		Name = "Sheet",
		BackgroundColor3 = Color3.new(1, 1, 1),
		Size = UDim2.new(1, -24, 1, -130),
		Position = UDim2.new(0.5, 0, 0.5, 20),
		AnchorPoint = Vector2.new(0.5, 0.5),
		Visible = false,
	})
	Ui.gradient(sheet, c.panel, c.bg)
	Ui.corner(sheet, 20)
	Ui.stroke(sheet, c.outline, 4, true)
	local sizeLimit = Instance.new("UISizeConstraint")
	sizeLimit.MaxSize = Vector2.new(580, 760)
	sizeLimit.Parent = sheet

	local ribbon = Ui.frame(sheet, { Name = "Ribbon", BackgroundColor3 = Color3.new(1, 1, 1), Size = UDim2.new(0.7, 0, 0, 52), Position = UDim2.new(0.5, 0, 0, -18), AnchorPoint = Vector2.new(0.5, 0), ZIndex = 3 })
	Ui.gradient(ribbon, c.accent:Lerp(Color3.new(1, 1, 1), 0.2), Theme.darker(c.accent, 0.25))
	Ui.corner(ribbon, 16)
	Ui.stroke(ribbon, Theme.darker(c.accent, 0.65), 3, true)
	local title = Ui.text(ribbon, "", { TextSize = 26, Size = UDim2.fromScale(1, 1), AutomaticSize = Enum.AutomaticSize.None, TextXAlignment = Enum.TextXAlignment.Center, ZIndex = 3 })
	title.TextYAlignment = Enum.TextYAlignment.Center

	local close = Ui.button(sheet, "✕", function()
		app:close()
	end, { BackgroundColor3 = c.bad, Size = UDim2.fromOffset(52, 52), Position = UDim2.new(1, -30, 0, -20), TextSize = 26, ZIndex = 4 })
	close:FindFirstChildOfClass("UICorner").CornerRadius = UDim.new(1, 0)

	local body = Ui.scroll(sheet, { Position = UDim2.fromOffset(0, 46), Size = UDim2.new(1, 0, 1, -56) })
	local inner = Ui.frame(body, { BackgroundTransparency = 1, Size = UDim2.new(1, -16, 0, 0), AutomaticSize = Enum.AutomaticSize.Y })
	Ui.padding(inner, 14)
	Ui.list(inner, 10)

	local current = nil
	local cleanup = nil
	local lastBuild = 0
	local function render(bounce: boolean)
		if cleanup then
			pcall(cleanup)
			cleanup = nil
		end
		Ui.clear(inner)
		local name = app.openPanel
		local module = name and app.panels[name]
		if not module or not app.state then
			sheet.Visible = false
			dim.Visible = false
			current = nil
			return
		end
		local opening = current ~= name
		current = name
		sheet.Visible = true
		dim.Visible = true
		title.Text = app.L(module.title)
		lastBuild = os.clock()
		if bounce and opening then
			Ui.popIn(sheet)
		end
		local ok, result = pcall(module.build, app, inner, app.panelArgs)
		if not ok then
			warn("[panel " .. name .. "] " .. tostring(result))
		elseif type(result) == "function" then
			cleanup = result
		end
	end
	app.PanelChanged:Connect(function()
		render(true)
	end)
	app.StateChanged:Connect(function()
		local module = current and app.panels[current]
		if module and not module.static and os.clock() - lastBuild > 0.25 then
			render(false)
		end
	end)
	task.spawn(function()
		while gui.Parent do
			task.wait(1)
			local module = current and app.panels[current]
			if module and module.refreshEvery then
				render(false)
			end
		end
	end)
end

return PanelHost
