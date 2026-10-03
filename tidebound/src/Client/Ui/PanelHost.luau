--[[ Shows one panel at a time in a centered sheet with a title and a close button. ]]

local Ui = require(script.Parent.Ui)
local Theme = require(script.Parent.Theme)

local PanelHost = {}

function PanelHost.mount(app: any, gui: ScreenGui)
	local sheet = Ui.frame(gui, {
		Name = "Sheet",
		BackgroundColor3 = Theme.colors.bg,
		Size = UDim2.new(1, -24, 1, -150),
		Position = UDim2.new(0.5, 0, 1, -12),
		AnchorPoint = Vector2.new(0.5, 1),
		Visible = false,
	})
	Ui.corner(sheet, 16)
	local sizeLimit = Instance.new("UISizeConstraint")
	sizeLimit.MaxSize = Vector2.new(560, math.huge)
	sizeLimit.Parent = sheet
	local title = Ui.text(sheet, "", { TextSize = 22, FontFace = Theme.fontBold, Position = UDim2.fromOffset(16, 14), Size = UDim2.new(1, -90, 0, 30), AutomaticSize = Enum.AutomaticSize.None })
	Ui.button(sheet, "✕", function()
		app:close()
	end, { Size = UDim2.fromOffset(52, 52), Position = UDim2.new(1, -60, 0, 6), BackgroundColor3 = Theme.colors.panelAlt, TextColor3 = Theme.colors.text })
	local body = Ui.scroll(sheet, { Position = UDim2.fromOffset(0, 64), Size = UDim2.new(1, 0, 1, -72) })
	local inner = Ui.frame(body, { BackgroundTransparency = 1, Size = UDim2.new(1, -16, 0, 0), AutomaticSize = Enum.AutomaticSize.Y })
	Ui.padding(inner, 12)
	Ui.list(inner, 10)

	local current = nil
	local cleanup = nil
	local lastBuild = 0
	local function render()
		if cleanup then
			pcall(cleanup)
			cleanup = nil
		end
		Ui.clear(inner)
		local name = app.openPanel
		local module = name and app.panels[name]
		if not module or not app.state then
			sheet.Visible = false
			current = nil
			return
		end
		current = name
		sheet.Visible = true
		title.Text = app.L(module.title)
		lastBuild = os.clock()
		local ok, result = pcall(module.build, app, inner, app.panelArgs)
		if not ok then
			warn("[panel " .. name .. "] " .. tostring(result))
		elseif type(result) == "function" then
			cleanup = result
		end
	end
	app.PanelChanged:Connect(render)
	app.StateChanged:Connect(function()
		local module = current and app.panels[current]
		-- Rebuild on state changes at most 4 times a second, except panels that hold their own state.
		if module and not module.static and os.clock() - lastBuild > 0.25 then
			render()
		end
	end)
	task.spawn(function()
		while gui.Parent do
			task.wait(1)
			local module = current and app.panels[current]
			if module and module.refreshEvery then
				render()
			end
		end
	end)
end

return PanelHost
