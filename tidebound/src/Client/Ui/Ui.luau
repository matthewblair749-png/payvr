--[[
	UI kit in the style of top Roblox games. Every interactive element is at least 48 x 48,
	all text goes through the localization function, and animations respect Reduce Motion.
	  * Buttons: rounded, vertical gradient, dark outline, outlined bold text, squash on press.
	  * Text: bold cartoon font with a dark outline so it reads on any background.
	  * Cards and panels: rounded, outlined, with padding.
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

function Ui.corner(parent: Instance, radius: number?)
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, radius or Theme.RADIUS)
	c.Parent = parent
	return c
end

function Ui.stroke(parent: Instance, color: Color3?, thickness: number?, border: boolean?)
	local s = Instance.new("UIStroke")
	s.Color = color or Theme.colors.outline
	s.Thickness = thickness or 2
	s.ApplyStrokeMode = if border then Enum.ApplyStrokeMode.Border else Enum.ApplyStrokeMode.Contextual
	s.LineJoinMode = Enum.LineJoinMode.Round
	s.Parent = parent
	return s
end

function Ui.gradient(parent: Instance, top: Color3, bottom: Color3, rotation: number?)
	local g = Instance.new("UIGradient")
	g.Color = ColorSequence.new(top, bottom)
	g.Rotation = rotation or 90
	g.Parent = parent
	return g
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

function Ui.frame(parent: Instance, props: any?): Frame
	local f = Instance.new("Frame")
	f.BackgroundColor3 = Theme.colors.panel
	f.BorderSizePixel = 0
	apply(f, props)
	f.Parent = parent
	return f
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

-- Text with the cartoon font and a dark outline (pass outline = false for plain body text).
function Ui.text(parent: Instance, text: string, props: any?): TextLabel
	local t = Instance.new("TextLabel")
	t.BackgroundTransparency = 1
	t.FontFace = Theme.font
	t.TextColor3 = Theme.colors.text
	t.TextSize = Theme.size(18)
	t.TextWrapped = true
	t.RichText = true
	t.TextXAlignment = Enum.TextXAlignment.Left
	t.AutomaticSize = Enum.AutomaticSize.Y
	t.Size = UDim2.new(1, 0, 0, 0)
	t.Text = text
	local outline = true
	if props then
		outline = props.outline ~= false
		props.outline = nil
	end
	apply(t, props)
	if props and props.TextSize then
		t.TextSize = Theme.size(props.TextSize)
	end
	if outline then
		local stroke = Ui.stroke(t, Theme.colors.outline, if t.TextSize >= 22 then 1.6 else 1)
		stroke.Transparency = 0.35
	end
	t.Parent = parent
	return t
end

local function press(inst: GuiObject)
	if Theme.reducedMotion then
		return
	end
	local scale = inst:FindFirstChildOfClass("UIScale") or Instance.new("UIScale")
	scale.Parent = inst
	TweenService:Create(scale, TweenInfo.new(0.06, Enum.EasingStyle.Quad), { Scale = 0.9 }):Play()
	task.delay(0.06, function()
		TweenService:Create(scale, TweenInfo.new(0.25, Enum.EasingStyle.Back, Enum.EasingDirection.Out), { Scale = 1 }):Play()
	end)
end

--[[
	Chunky game button. props.BackgroundColor3 picks the colour family; the gradient and outline
	are derived from it. Text colour adapts to the background unless TextColor3 is given.
]]
function Ui.button(parent: Instance, text: string, onClick: () -> (), props: any?): TextButton
	local b = Instance.new("TextButton")
	b.AutoButtonColor = false
	b.BackgroundColor3 = Color3.new(1, 1, 1)
	b.TextColor3 = Theme.colors.buttonText
	b.FontFace = Theme.fontBold
	b.TextSize = Theme.size(18)
	b.TextWrapped = true
	b.RichText = true
	b.Size = UDim2.new(0, 160, 0, Theme.MIN_TOUCH)
	b.Text = text
	local base = Theme.colors.accent
	local customText = props and props.TextColor3
	if props then
		base = props.BackgroundColor3 or base
		props = table.clone(props)
		props.BackgroundColor3 = nil
	end
	apply(b, props)
	if props and props.TextSize then
		b.TextSize = Theme.size(props.TextSize)
	end
	-- White background tinted by the gradient keeps colours bright on every device.
	local gradient = Ui.gradient(b, base:Lerp(Color3.new(1, 1, 1), 0.22), Theme.darker(base, 0.18))
	Ui.corner(b, 10)
	local border = Ui.stroke(b, base:Lerp(Color3.new(1, 1, 1), 0.45), 1.5, true)
	border.Transparency = 0.2
	if not customText then
		b.TextColor3 = Theme.colors.text
	end
	-- One UIStroke per object (the border); the text outline uses the built-in text stroke.
	b.TextStrokeColor3 = Theme.colors.outline
	b.TextStrokeTransparency = 0.6
	local c = Instance.new("UISizeConstraint")
	c.MinSize = Vector2.new(Theme.MIN_TOUCH, Theme.MIN_TOUCH)
	c.Parent = b
	local busy = false
	b.MouseEnter:Connect(function()
		gradient.Offset = Vector2.new(0, -0.08)
	end)
	b.MouseLeave:Connect(function()
		gradient.Offset = Vector2.new()
	end)
	b.Activated:Connect(function()
		if busy or not b.Active then
			return
		end
		busy = true
		press(b)
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

-- Square menu button: big emoji icon with a label underneath (HUD side bar).
-- Dark glass square with an icon and a label underneath (side menus in the concept art).
function Ui.iconButton(parent: Instance, icon: string, label: string, color: Color3, onClick: () -> (), props: any?): TextButton
	local b = Ui.button(parent, "", onClick, { BackgroundColor3 = Theme.colors.panel, Size = UDim2.fromOffset(72, 72) })
	b:FindFirstChildOfClass("UIStroke").Color = Theme.colors.border
	apply(b, props)
	local iconLabel = Ui.text(b, icon, { TextSize = 30, outline = false, TextXAlignment = Enum.TextXAlignment.Center, Size = UDim2.new(1, 0, 0, 42), AutomaticSize = Enum.AutomaticSize.None, Position = UDim2.fromOffset(0, 3), FontFace = Theme.fontEmoji })
	iconLabel.TextWrapped = false
	local text = Ui.text(b, label, { TextSize = 13, TextXAlignment = Enum.TextXAlignment.Center, Size = UDim2.new(1, 0, 0, 20), AutomaticSize = Enum.AutomaticSize.None, Position = UDim2.new(0, 0, 1, -23) })
	text.TextColor3 = color:Lerp(Color3.new(1, 1, 1), 0.55)
	return b
end

-- Glass panel: translucent navy fill, thin light-blue border.
function Ui.glass(parent: Instance, props: any?): Frame
	local f = Ui.frame(parent, { BackgroundColor3 = Theme.colors.panel, BackgroundTransparency = 0.12 })
	apply(f, props)
	Ui.corner(f, Theme.RADIUS)
	local s = Ui.stroke(f, Theme.colors.border, 1.5, true)
	s.Transparency = 0.25
	return f
end

-- Horizontal progress bar; returns the fill frame.
function Ui.progress(parent: Instance, fraction: number, color: Color3, props: any?): Frame
	local bg = Ui.frame(parent, { BackgroundColor3 = Theme.colors.bg, Size = UDim2.new(1, 0, 0, 10) })
	apply(bg, props)
	Ui.corner(bg, 5)
	local fill = Ui.frame(bg, { BackgroundColor3 = Color3.new(1, 1, 1), Size = UDim2.fromScale(math.clamp(fraction, 0, 1), 1) })
	Ui.corner(fill, 5)
	Ui.gradient(fill, color:Lerp(Color3.new(1, 1, 1), 0.25), color, 0)
	fill.Name = "Fill"
	return fill
end

-- Round avatar headshot for a Roblox user.
function Ui.avatar(parent: Instance, userId: number, size: number, props: any?): ImageLabel
	local img = Instance.new("ImageLabel")
	img.BackgroundColor3 = Theme.colors.panelAlt
	img.Size = UDim2.fromOffset(size, size)
	img.Image = "rbxthumb://type=AvatarHeadShot&id=" .. tostring(userId) .. "&w=150&h=150"
	apply(img, props)
	Ui.corner(img, size)
	Ui.stroke(img, Theme.colors.border, 2, true)
	img.Parent = parent
	return img
end

-- Pill tabs; the selected one is filled blue. onSelect(id) is called on tap.
function Ui.tabs(parent: Instance, items: { { id: string, label: string } }, selected: string, onSelect: (string) -> ()): Frame
	local row = Ui.frame(parent, { BackgroundTransparency = 1, Size = UDim2.new(1, 0, 0, 40), AutomaticSize = Enum.AutomaticSize.Y })
	local list = Ui.list(row, 6, true)
	list.Wraps = true
	for i, item in items do
		local active = item.id == selected
		local b = Ui.button(row, item.label, function()
			onSelect(item.id)
		end, { LayoutOrder = i, Size = UDim2.fromOffset(0, 40), AutomaticSize = Enum.AutomaticSize.X, TextSize = 15, BackgroundColor3 = if active then Theme.colors.accent else Theme.colors.panelAlt })
		Ui.padding(b, 0)
		local pad = b:FindFirstChildOfClass("UIPadding")
		pad.PaddingLeft = UDim.new(0, 16)
		pad.PaddingRight = UDim.new(0, 16)
	end
	return row
end

function Ui.scroll(parent: Instance, props: any?): ScrollingFrame
	local s = Instance.new("ScrollingFrame")
	s.BackgroundTransparency = 1
	s.BorderSizePixel = 0
	s.ScrollBarThickness = 8
	s.ScrollBarImageColor3 = Theme.colors.accent
	s.AutomaticCanvasSize = Enum.AutomaticSize.Y
	s.CanvasSize = UDim2.new()
	s.Size = UDim2.fromScale(1, 1)
	apply(s, props)
	s.Parent = parent
	return s
end

-- Rarity shown as shape + coloured word, so it reads without colour vision.
function Ui.rarity(parent: Instance, cfg: any, rarity: string, props: any?): TextLabel
	local r = cfg.index.rarities[rarity]
	local glyph = Theme.shapeGlyph[r and r.shape or "circle"] or "●"
	local label = Ui.text(parent, glyph .. " " .. Ui.L("rarity_" .. rarity), props)
	label.TextColor3 = if r then Theme.hex(r.color):Lerp(Color3.new(1, 1, 1), 0.25) else Theme.colors.text
	return label
end

function Ui.tween(inst: Instance, props: any, seconds: number)
	if Theme.reducedMotion or seconds <= 0 then
		apply(inst, props)
		return
	end
	TweenService:Create(inst, TweenInfo.new(seconds, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), props):Play()
end

-- Pops an element in with a bounce (skipped with Reduce Motion).
function Ui.popIn(inst: GuiObject)
	if Theme.reducedMotion then
		return
	end
	local scale = inst:FindFirstChildOfClass("UIScale") or Instance.new("UIScale")
	scale.Scale = 0.6
	scale.Parent = inst
	TweenService:Create(scale, TweenInfo.new(0.35, Enum.EasingStyle.Back, Enum.EasingDirection.Out), { Scale = 1 }):Play()
end

function Ui.row(parent: Instance, height: number?): Frame
	local f = Ui.frame(parent, { BackgroundTransparency = 1, Size = UDim2.new(1, 0, 0, height or Theme.MIN_TOUCH), AutomaticSize = Enum.AutomaticSize.Y })
	Ui.list(f, 8, true)
	return f
end

-- Card inside a panel: slightly lighter glass with a thin border.
function Ui.card(parent: Instance, props: any?): Frame
	local f = Ui.frame(parent, { BackgroundColor3 = Color3.new(1, 1, 1), Size = UDim2.new(1, 0, 0, 0), AutomaticSize = Enum.AutomaticSize.Y })
	local base = (props and props.BackgroundColor3) or Theme.colors.panelAlt
	if props then
		props = table.clone(props)
		props.BackgroundColor3 = nil
	end
	apply(f, props)
	Ui.gradient(f, base:Lerp(Color3.new(1, 1, 1), 0.06), Theme.darker(base, 0.2))
	Ui.corner(f, Theme.RADIUS)
	local s = Ui.stroke(f, Theme.colors.border, 1.2, true)
	s.Transparency = 0.45
	Ui.padding(f, 12)
	Ui.list(f, 8)
	return f
end

-- Rounded pill (currency counters, badges).
function Ui.pill(parent: Instance, icon: string, color: Color3, props: any?): TextLabel
	local f = Ui.frame(parent, { BackgroundColor3 = Theme.colors.bg, BackgroundTransparency = 0.15, Size = UDim2.fromOffset(120, 38) })
	apply(f, props)
	Ui.corner(f, 19)
	local border = Ui.stroke(f, color:Lerp(Theme.colors.border, 0.4), 1.4, true)
	border.Transparency = 0.2
	local iconLabel = Ui.text(f, icon, { TextSize = 24, outline = false, FontFace = Theme.fontEmoji, Size = UDim2.fromOffset(38, 38), AutomaticSize = Enum.AutomaticSize.None, Position = UDim2.fromOffset(-4, 0), TextXAlignment = Enum.TextXAlignment.Center })
	iconLabel.TextYAlignment = Enum.TextYAlignment.Center
	iconLabel.Name = "Icon"
	local value = Ui.text(f, "0", { TextSize = 19, Size = UDim2.new(1, -44, 1, 0), AutomaticSize = Enum.AutomaticSize.None, Position = UDim2.fromOffset(36, 0), TextXAlignment = Enum.TextXAlignment.Right })
	value.TextYAlignment = Enum.TextYAlignment.Center
	value.Name = "Value"
	local valuePad = Instance.new("UIPadding")
	valuePad.PaddingRight = UDim.new(0, 6)
	valuePad.Parent = value
	return value
end

function Ui.clear(container: Instance)
	for _, child in container:GetChildren() do
		if not (child:IsA("UIListLayout") or child:IsA("UIGridLayout") or child:IsA("UIPadding") or child:IsA("UICorner") or child:IsA("UIStroke") or child:IsA("UIGradient")) then
			child:Destroy()
		end
	end
end

return Ui
