--[[ Design tokens. Rarity colors always come with a shape glyph and a word, so color is never the only cue. ]]

local Theme = {}

Theme.colors = {
	bg = Color3.fromRGB(16, 37, 56),
	panel = Color3.fromRGB(24, 52, 78),
	panelAlt = Color3.fromRGB(32, 66, 96),
	text = Color3.fromRGB(244, 241, 232),
	textDim = Color3.fromRGB(180, 196, 210),
	accent = Color3.fromRGB(255, 196, 92),
	good = Color3.fromRGB(110, 200, 140),
	bad = Color3.fromRGB(240, 120, 110),
	silver = Color3.fromRGB(210, 216, 224),
	pearl = Color3.fromRGB(246, 232, 250),
	gem = Color3.fromRGB(120, 220, 230),
	buttonText = Color3.fromRGB(20, 30, 40),
}

-- Shapes double-encode rarity for colorblind players (see drifters.json "shape").
Theme.shapeGlyph = {
	circle = "●",
	square = "■",
	triangle = "▲",
	diamond = "◆",
	star = "★",
}

Theme.font = Font.fromEnum(Enum.Font.GothamMedium)
Theme.fontBold = Font.fromEnum(Enum.Font.GothamBold)
Theme.MIN_TOUCH = 48
Theme.textScale = 1
Theme.reducedMotion = false

function Theme.size(base: number): number
	return math.floor(base * Theme.textScale + 0.5)
end

function Theme.hex(hex: string): Color3
	return Color3.fromHex(hex)
end

return Theme
