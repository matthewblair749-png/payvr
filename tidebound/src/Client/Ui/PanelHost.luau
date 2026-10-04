--[[ One panel at a time: a dark glass sheet with an uppercase title, a round close button, and a bounce-in. ]]

local Ui = require(script.Parent.Ui)
local Theme = require(script.Parent.Theme)

local PanelHost = {}

function PanelHost.mount(app: any, gui: ScreenGui)
	local c = Theme.colors
	local dim = Ui.frame(gui, { Name = "Dim", BackgroundColor3 = Color3.new(0, 0, 0), BackgroundTransparency = 0.55, Size = UDim2.fromScale(1, 1), Visible = false })
	local sheet = Ui.glass(gui, {
		Name = "Sheet",
		BackgroundColor3 = c.bg,
		BackgroundTransparency = 0.04,
		Size = UDim2.new(1, -24, 1, -110),
		Position = UDim2.new(0.5, 0, 0.5, 10),
		AnchorPoint = Vector2.new(0.5, 0.5),
		Visible = false,
	})
	local sizeLimit = Instance.new("UISizeConstraint")
	sizeLimit.MaxSize = Vector2.new(720, 760)
	sizeLimit.Parent = sheet

	local title = Ui.text(sheet, "", { TextSize = 24, FontFace = Theme.fontBold, Size = UDim2.new(1, -90, 0, 30), AutomaticSize = Enum.AutomaticSize.None, Position = UDim2.fromOffset(18, 14) })
	title.TextYAlignment = Enum.TextYAlignment.Center
	local divider = Ui.frame(sheet, { BackgroundColor3 = c.border, BackgroundTransparency = 0.6, Size = UDim2.new(1, -36, 0, 1), Position = UDim2.fromOffset(18, 54) })
	local _ = divider

	local close = Ui.button(sheet, "✕", function()
		app:close()
	end, { BackgroundColor3 = c.panelAlt, Size = UDim2.fromOffset(48, 48), Position = UDim2.new(1, -60, 0, 6), TextSize = 22 })
	close:FindFirstChildOfClass("UICorner").CornerRadius = UDim.new(1, 0)

	local body = Ui.scroll(sheet, { Position = UDim2.fromOffset(0, 60), Size = UDim2.new(1, 0, 1, -66) })
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
		title.Text = string.upper(app.L(module.title))
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
