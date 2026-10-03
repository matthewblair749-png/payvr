--[[
	Everyone in the server (or the squad at night) with Report and Block. Blocking uses Roblox's own block
	prompt and also hides that player's quick phrases in Tidebound.
]]

local Players = game:GetService("Players")
local StarterGui = game:GetService("StarterGui")

local Ui = require(script.Parent.Parent.Ui.Ui)
local Theme = require(script.Parent.Parent.Ui.Theme)

return {
	title = "panel_people",
	build = function(app: any, container: Frame, args: any)
		local L = app.L
		local list = {}
		if args and args.squad then
			for _, userId in app.nightSquad() do
				local p = Players:GetPlayerByUserId(userId)
				if p then
					table.insert(list, p)
				end
			end
		else
			list = Players:GetPlayers()
		end
		for _, p in list do
			if p ~= Players.LocalPlayer then
				local card = Ui.card(container)
				Ui.text(card, p.DisplayName, { FontFace = Theme.fontBold })
				local row = Ui.row(card)
				for _, reason in app.cfg.compliance.reportReasons do
					Ui.button(row, L(reason), function()
						local reply = app.remotes.Social:InvokeServer("report", { userId = p.UserId, reason = reason })
						if reply and reply.ok then
							app:toast(L("report_sent"))
						end
					end, { Size = UDim2.new(0.5, -4, 0, 48), TextSize = 13, BackgroundColor3 = Theme.colors.panel, TextColor3 = Theme.colors.text })
				end
				local blocked = table.find(app.state.social.blocked, p.UserId) ~= nil
				Ui.button(card, if blocked then L("unblock") else L("block"), function()
					app.remotes.Social:InvokeServer(if blocked then "unblock" else "block", { userId = p.UserId })
					pcall(StarterGui.SetCore, StarterGui, if blocked then "PromptUnblockPlayer" else "PromptBlockPlayer", p)
				end, { Size = UDim2.new(1, 0, 0, 48), BackgroundColor3 = Theme.colors.bad, TextColor3 = Theme.colors.text })
			end
		end
		if #list <= 1 then
			Ui.text(container, L("people_alone"), { TextColor3 = Theme.colors.textDim })
		end
	end,
	static = true,
}
