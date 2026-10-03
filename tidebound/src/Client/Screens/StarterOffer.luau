--[[
	The one-time Starter Pack offer, shown once after the first night is finished and never during a night.
	"No thanks" is as large as the buy button; there is no timer and it never comes back on its own.
]]

local Ui = require(script.Parent.Parent.Ui.Ui)
local Theme = require(script.Parent.Parent.Ui.Theme)
local Format = require(script.Parent.Parent.Ui.Format)

return {
	title = "starter_pack",
	build = function(app: any, container: Frame)
		local L = app.L
		app:store("starterOfferShown")
		local reply = if app.catalog then { ok = true, data = app.catalog } else app:store("catalog")
		if not reply.ok then
			return
		end
		app.catalog = reply.data
		local starter
		for _, p in reply.data.products do
			if p.id == "starter_pack" then
				starter = p
			end
		end
		if not starter then
			return
		end
		Ui.text(container, L("starter_offer_intro"))
		Ui.text(container, L("starter_pack_body"), { TextColor3 = Theme.colors.textDim })
		Ui.button(container, L("shop_price_robux", { robux = Format.int(starter.liveRobux or starter.robux) }), function()
			app:store("buy", { productId = starter.id })
			app:close()
		end, { Size = UDim2.new(1, 0, 0, 56) })
		Ui.button(container, L("no_thanks"), function()
			app:close()
		end, { Size = UDim2.new(1, 0, 0, 56), BackgroundColor3 = Theme.colors.panelAlt, TextColor3 = Theme.colors.text })
	end,
	static = true,
}
