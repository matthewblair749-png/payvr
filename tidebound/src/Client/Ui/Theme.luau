--[[
	Design tokens. The look follows today's top Roblox games: bright saturated colours, chunky rounded
	buttons with a light-to-dark gradient and a dark outline, and a bold cartoon font with outlined text.
	Rarity colours always come with a shape glyph and a word, so colour is never the only cue.
]]

local Theme = {}

Theme.colors = {
	-- Panels: deep ocean blue with a lighter inner card, framed by a dark outline.
	bg = Color3.fromRGB(20, 52, 84),
	panel = Color3.fromRGB(32, 88, 132),
	panelAlt = Color3.fromRGB(48, 116, 168),
	panelLight = Color3.fromRGB(255, 246, 222),
	outline = Color3.fromRGB(12, 28, 46),
	text = Color3.fromRGB(255, 255, 255),
	textDark = Color3.fromRGB(40, 34, 28),
	textDim = Color3.fromRGB(196, 222, 240),
	-- Button families (top colour; the gradient darkens toward the bottom).
	accent = Color3.fromRGB(255, 196, 46), -- gold: primary actions
	good = Color3.fromRGB(96, 214, 96), -- green: confirm, ready
	bad = Color3.fromRGB(255, 92, 92), -- red: close, delete
	blue = Color3.fromRGB(70, 170, 255), -- secondary
	purple = Color3.fromRGB(176, 110, 255), -- premium
	coral = Color3.fromRGB(255, 128, 102),
	silver = Color3.fromRGB(228, 236, 245),
	pearl = Color3.fromRGB(255, 226, 250),
	gem = Color3.fromRGB(110, 236, 255),
	buttonText = Color3.fromRGB(255, 255, 255),
}

-- Shapes double-encode rarity for colorblind players (see drifters.json "shape").
Theme.shapeGlyph = {
	circle = "●",
	square = "■",
	triangle = "▲",
	diamond = "◆",
	star = "★",
}

Theme.font = Font.fromEnum(Enum.Font.FredokaOne)
Theme.fontBold = Font.fromEnum(Enum.Font.FredokaOne)
Theme.fontBody = Font.new("rbxasset://fonts/families/GothamSSm.json", Enum.FontWeight.Bold)
Theme.MIN_TOUCH = 48
Theme.RADIUS = 14
Theme.textScale = 1
Theme.reducedMotion = false

function Theme.size(base: number): number
	return math.floor(base * Theme.textScale + 0.5)
end

function Theme.hex(hex: string): Color3
	return Color3.fromHex(hex)
end

-- A darker shade for gradient bottoms and outlines.
function Theme.darker(c: Color3, amount: number?): Color3
	local h, s, v = c:ToHSV()
	return Color3.fromHSV(h, math.min(1, s * 1.1), v * (1 - (amount or 0.3)))
end

-- Readable text colour on a given background.
function Theme.textOn(c: Color3): Color3
	local lum = 0.299 * c.R + 0.587 * c.G + 0.114 * c.B
	return if lum > 0.82 then Theme.colors.textDark else Theme.colors.text
end

return Theme
