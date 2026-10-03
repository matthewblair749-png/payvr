--[[
	Tiny UI kit on top of Roblox GUI objects. Every interactive element is at least 48 x 48,
	all text goes through the localization function, and animations respect reduced motion.
]]

local TweenService = game:GetService("TweenService")

local Theme = require(script.Parent.Theme)

local Ui = {}

local translate: (key: string, args: any?) -> string = function(key, _args)
	return key
end

function Ui.setTranslator(fn: (key: string, args: any?) -> string)
	translate = fn
end

function Ui.L(key: string, args: any?): string
	return translate(key, args)
end

local function apply(inst: Instance, props: any?)
	if props then
		for k, v in props do
			(inst :: any)[k] = v
		end
	end
	return inst
end

function Ui.screen(name: string, parent: Instance, order: number?): ScreenGui
	local gui = Instance.new("ScreenGui")
	gui.Name = name
	gui.ResetOnSpawn = false
	gui.ScreenInsets = Enum.ScreenInsets.DeviceSafeInsets
	gui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
	gui.DisplayOrder = order or 0
	gui.Parent = parent
	return gui
end

function Ui.frame(parent: Instance, props: any?): Frame
	local f = Instance.new("Frame")
	f.BackgroundColor3 = Theme.colors.panel
	f.BorderSizePixel = 0
	apply(f, props)
	f.Parent = parent
	return f
end

function Ui.corner(parent: Instance, radius: number?)
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, radius or 12)
	c.Parent = parent
	return c
end

function Ui.padding(parent: Instance, px: number)
	local p = Instance.new("UIPadding")
	p.PaddingTop = UDim.new(0, px)
	p.PaddingBottom = UDim.new(0, px)
	p.PaddingLeft = UDim.new(0, px)
	p.PaddingRight = UDim.new(0, px)
	p.Parent = parent
	return p
end

function Ui.list(parent: Instance, gap: number?, horizontal: boolean?, align: Enum.HorizontalAlignment?): UIListLayout
	local l = Instance.new("UIListLayout")
	l.Padding = UDim.new(0, gap or 8)
	l.FillDirection = if horizontal then Enum.FillDirection.Horizontal else Enum.FillDirection.Vertical
	l.SortOrder = Enum.SortOrder.LayoutOrder
	l.HorizontalAlignment = align or Enum.HorizontalAlignment.Left
	l.VerticalAlignment = Enum.VerticalAlignment.Top
	l.Parent = parent
	return l
end

function Ui.grid(parent: Instance, cell: Vector2, gap: number?): UIGridLayout
	local g = Instance.new("UIGridLayout")
	g.CellSize = UDim2.fromOffset(cell.X, cell.Y)
	g.CellPadding = UDim2.fromOffset(gap or 8, gap or 8)
	g.SortOrder = Enum.SortOrder.LayoutOrder
	g.Parent = parent
	return g
end

function Ui.text(parent: Instance, text: string, props: any?): TextLabel
	local t = Instance.new("TextLabel")
	t.BackgroundTransparency = 1
	t.FontFace = Theme.font
	t.TextColor3 = Theme.colors.text
	t.TextSize = Theme.size(18)
	t.TextWrapped = true
	t.TextXAlignment = Enum.TextXAlignment.Left
	t.AutomaticSize = Enum.AutomaticSize.Y
	t.Size = UDim2.new(1, 0, 0, 0)
	t.Text = text
	apply(t, props)
	if props and props.TextSize then
		t.TextSize = Theme.size(props.TextSize)
	end
	t.Parent = parent
	return t
end

function Ui.button(parent: Instance, text: string, onClick: () -> (), props: any?): TextButton
	local b = Instance.new("TextButton")
	b.AutoButtonColor = true
	b.BackgroundColor3 = Theme.colors.accent
	b.TextColor3 = Theme.colors.buttonText
	b.FontFace = Theme.fontBold
	b.TextSize = Theme.size(18)
	b.TextWrapped = true
	b.Size = UDim2.new(0, 160, 0, Theme.MIN_TOUCH)
	b.Text = text
	apply(b, props)
	if props and props.TextSize then
		b.TextSize = Theme.size(props.TextSize)
	end
	-- Never smaller than a 48 x 48 touch target, whatever the layout asks for.
	local c = Instance.new("UISizeConstraint")
	c.MinSize = Vector2.new(Theme.MIN_TOUCH, Theme.MIN_TOUCH)
	c.Parent = b
	Ui.corner(b, 10)
	local busy = false
	b.Activated:Connect(function()
		if busy then
			return
		end
		busy = true
		task.spawn(function()
			local ok, err = pcall(onClick)
			busy = false
			if not ok then
				warn("[ui] " .. tostring(err))
			end
		end)
	end)
	b.Parent = parent
	return b
end

function Ui.scroll(parent: Instance, props: any?): ScrollingFrame
	local s = Instance.new("ScrollingFrame")
	s.BackgroundTransparency = 1
	s.BorderSizePixel = 0
	s.ScrollBarThickness = 8
	s.AutomaticCanvasSize = Enum.AutomaticSize.Y
	s.CanvasSize = UDim2.new()
	s.Size = UDim2.fromScale(1, 1)
	apply(s, props)
	s.Parent = parent
	return s
end

-- Rarity shown as shape + colored word, so it reads without color vision.
function Ui.rarity(parent: Instance, cfg: any, rarity: string, props: any?): TextLabel
	local r = cfg.index.rarities[rarity]
	local glyph = Theme.shapeGlyph[r and r.shape or "circle"] or "●"
	local label = Ui.text(parent, glyph .. " " .. Ui.L("rarity_" .. rarity), props)
	label.TextColor3 = if r then Theme.hex(r.color) else Theme.colors.text
	label.FontFace = Theme.fontBold
	return label
end

function Ui.tween(inst: Instance, props: any, seconds: number)
	if Theme.reducedMotion or seconds <= 0 then
		apply(inst, props)
		return
	end
	TweenService:Create(inst, TweenInfo.new(seconds, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), props):Play()
end

-- A row with a label on the left and content on the right.
function Ui.row(parent: Instance, height: number?): Frame
	local f = Ui.frame(parent, { BackgroundTransparency = 1, Size = UDim2.new(1, 0, 0, height or Theme.MIN_TOUCH), AutomaticSize = Enum.AutomaticSize.Y })
	Ui.list(f, 8, true)
	return f
end

function Ui.card(parent: Instance, props: any?): Frame
	local f = Ui.frame(parent, { BackgroundColor3 = Theme.colors.panelAlt, Size = UDim2.new(1, 0, 0, 0), AutomaticSize = Enum.AutomaticSize.Y })
	apply(f, props)
	Ui.corner(f, 12)
	Ui.padding(f, 10)
	Ui.list(f, 6)
	return f
end

function Ui.clear(container: Instance)
	for _, child in container:GetChildren() do
		if not child:IsA("UIListLayout") and not child:IsA("UIGridLayout") and not child:IsA("UIPadding") and not child:IsA("UICorner") then
			child:Destroy()
		end
	end
end

return Ui
