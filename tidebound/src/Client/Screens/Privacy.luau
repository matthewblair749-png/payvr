--[[ Data export (copyable JSON) and account deletion with a typed confirmation code. ]]

local Ui = require(script.Parent.Parent.Ui.Ui)
local Theme = require(script.Parent.Parent.Ui.Theme)

return {
	title = "panel_privacy",
	build = function(app: any, container: Frame, args: any)
		local L = app.L
		local account = app.remotes.Account
		if args and args.mode == "export" then
			Ui.text(container, L("privacy_export_note"))
			local ok, reply = pcall(account.InvokeServer, account, "export")
			local box = Instance.new("TextBox")
			box.ClearTextOnFocus = false
			box.TextEditable = false
			box.MultiLine = true
			box.TextWrapped = true
			box.TextXAlignment = Enum.TextXAlignment.Left
			box.TextYAlignment = Enum.TextYAlignment.Top
			box.Font = Enum.Font.Code
			box.TextSize = Theme.size(12)
			box.TextColor3 = Theme.colors.text
			box.BackgroundColor3 = Theme.colors.bg
			box.Size = UDim2.new(1, 0, 0, 360)
			box.Text = if ok and reply.ok then reply.data else L("err_network")
			box.Parent = container
		else
			Ui.text(container, L("privacy_delete_warning"), { TextColor3 = Theme.colors.bad })
			local ok, reply = pcall(account.InvokeServer, account, "requestDelete")
			if not ok or not reply.ok then
				Ui.text(container, L("err_network"))
				return
			end
			Ui.text(container, L("privacy_delete_code", { code = reply.data.code }), { FontFace = Theme.fontBold, TextSize = 22 })
			local input = Instance.new("TextBox")
			input.PlaceholderText = L("privacy_delete_placeholder")
			input.Text = ""
			input.TextSize = Theme.size(20)
			input.Size = UDim2.new(1, 0, 0, 48)
			input.BackgroundColor3 = Theme.colors.bg
			input.TextColor3 = Theme.colors.text
			input.Parent = container
			Ui.button(container, L("privacy_delete_confirm"), function()
				account:InvokeServer("confirmDelete", { code = input.Text })
			end, { Size = UDim2.new(1, 0, 0, 52), BackgroundColor3 = Theme.colors.bad, TextColor3 = Theme.colors.text })
			Ui.button(container, L("cancel"), function()
				app:close()
			end, { Size = UDim2.new(1, 0, 0, 48), BackgroundColor3 = Theme.colors.panelAlt, TextColor3 = Theme.colors.text })
		end
	end,
	static = true,
}
