--[[
	Design tokens, matched to the Tidebound concept art: dark navy glass panels with thin light-blue borders,
	clean bold type, bright blue primary buttons, green price buttons, gold/pearl/gem currency colours.
	Rarity colours always come with a shape glyph and a word, so colour is never the only cue.
]]

local Theme = {}

Theme.colors = {
	bg = Color3.fromRGB(10, 22, 44), -- deepest panel fill
	panel = Color3.fromRGB(16, 34, 64), -- glass panel
	panelAlt = Color3.fromRGB(24, 50, 90), -- cards inside panels
	panelLight = Color3.fromRGB(36, 70, 120),
	border = Color3.fromRGB(86, 150, 230), -- thin glass border
	outline = Color3.fromRGB(6, 14, 30),
	text = Color3.fromRGB(255, 255, 255),
	textDark = Color3.fromRGB(20, 28, 40),
	textDim = Color3.fromRGB(160, 186, 220),
	accent = Color3.fromRGB(56, 148, 255), -- primary blue
	good = Color3.fromRGB(52, 200, 96), -- price / confirm green
	bad = Color3.fromRGB(240, 82, 82),
	blue = Color3.fromRGB(56, 148, 255),
	purple = Color3.fromRGB(150, 100, 255),
	coral = Color3.fromRGB(255, 120, 90),
	gold = Color3.fromRGB(255, 200, 60),
	silver = Color3.fromRGB(255, 206, 84), -- Silver coin reads gold, as in the concept
	pearl = Color3.fromRGB(226, 210, 255),
	gem = Color3.fromRGB(150, 110, 255),
	xp = Color3.fromRGB(60, 220, 120),
	buttonText = Color3.fromRGB(255, 255, 255),
}

Theme.shapeGlyph = {
	circle = "●",
	square = "■",
	triangle = "▲",
	diamond = "◆",
	star = "★",
}

local BUILDER = "rbxasset://fonts/families/BuilderSans.json"
Theme.font = Font.new(BUILDER, Enum.FontWeight.Bold)
Theme.fontBold = Font.new(BUILDER, Enum.FontWeight.ExtraBold)
Theme.fontBody = Font.new(BUILDER, Enum.FontWeight.Medium)
Theme.fontEmoji = Font.new("rbxasset://fonts/families/GothamSSm.json", Enum.FontWeight.Bold)
Theme.MIN_TOUCH = 48
Theme.RADIUS = 12
Theme.textScale = 1
Theme.reducedMotion = false

function Theme.size(base: number): number
	return math.floor(base * Theme.textScale + 0.5)
end

function Theme.hex(hex: string): Color3
	return Color3.fromHex(hex)
end

function Theme.darker(c: Color3, amount: number?): Color3
	local h, s, v = c:ToHSV()
	return Color3.fromHSV(h, math.min(1, s * 1.05), v * (1 - (amount or 0.3)))
end

function Theme.textOn(c: Color3): Color3
	local lum = 0.299 * c.R + 0.587 * c.G + 0.114 * c.B
	return if lum > 0.82 then Theme.colors.textDark else Theme.colors.text
end

return Theme
