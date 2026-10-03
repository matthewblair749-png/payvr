--[[ Settings: accessibility, notifications, Smuggler opt-in, spending, blocked players, and privacy. ]]

local Players = game:GetService("Players")
local StarterGui = game:GetService("StarterGui")
local RunService = game:GetService("RunService")
local ExperienceNotificationService = game:GetService("ExperienceNotificationService")

local Ui = require(script.Parent.Parent.Ui.Ui)
local Theme = require(script.Parent.Parent.Ui.Theme)

local function toggle(app: any, parent: Instance, labelKey: string, value: boolean, onChange: (boolean) -> ())
	local row = Ui.row(parent)
	Ui.text(row, app.L(labelKey), { Size = UDim2.new(0.62, 0, 0, 48), AutomaticSize = Enum.AutomaticSize.None })
	Ui.button(row, if value then app.L("on") else app.L("off"), function()
		onChange(not value)
	end, { Size = UDim2.new(0.33, 0, 0, 48), BackgroundColor3 = if value then Theme.colors.good else Theme.colors.panel, TextColor3 = Theme.colors.text })
end

return {
	title = "panel_settings",
	build = function(app: any, container: Frame)
		local L = app.L
		local s = app.state
		local st = s.settings
		local function set(key: string, value: any)
			app:intent("setSetting", { key = key, value = value })
		end

		Ui.text(container, L("settings_accessibility"), { FontFace = Theme.fontBold })
		local sizeRow = Ui.row(container)
		Ui.text(sizeRow, L("settings_text_size", { pct = math.floor(st.textScale * 100) }), { Size = UDim2.new(0.5, 0, 0, 48), AutomaticSize = Enum.AutomaticSize.None })
		Ui.button(sizeRow, "A-", function()
			set("textScale", math.max(0.8, math.floor((st.textScale - 0.2) * 10 + 0.5) / 10))
		end, { Size = UDim2.new(0, 64, 0, 48) })
		Ui.button(sizeRow, "A+", function()
			set("textScale", math.min(1.6, math.floor((st.textScale + 0.2) * 10 + 0.5) / 10))
		end, { Size = UDim2.new(0, 64, 0, 48) })
		toggle(app, container, "settings_haptics", st.haptics, function(v)
			set("haptics", v)
		end)
		toggle(app, container, "settings_reduced_motion", st.reducedMotion, function(v)
			set("reducedMotion", v)
		end)
		local volRow = Ui.row(container)
		Ui.text(volRow, L("settings_music", { pct = math.floor(st.music * 100) }), { Size = UDim2.new(0.5, 0, 0, 48), AutomaticSize = Enum.AutomaticSize.None })
		Ui.button(volRow, "-", function()
			set("music", math.max(0, math.floor((st.music - 0.2) * 10 + 0.5) / 10))
		end, { Size = UDim2.new(0, 56, 0, 48) })
		Ui.button(volRow, "+", function()
			set("music", math.min(1, math.floor((st.music + 0.2) * 10 + 0.5) / 10))
		end, { Size = UDim2.new(0, 56, 0, 48) })

		Ui.text(container, L("settings_notifications"), { FontFace = Theme.fontBold })
		Ui.text(container, L("settings_notifications_note"), { TextSize = 15, TextColor3 = Theme.colors.textDim })
		Ui.button(container, L("settings_allow_notifications"), function()
			local ok, can = pcall(ExperienceNotificationService.CanPromptOptInAsync, ExperienceNotificationService)
			if ok and can then
				pcall(ExperienceNotificationService.PromptOptIn, ExperienceNotificationService)
			else
				app:toast(L("settings_notifications_unavailable"))
			end
		end, { Size = UDim2.new(1, 0, 0, 48) })
		for _, t in app.cfg.harbor.notifications.types do
			toggle(app, container, "notif_" .. t.id, st.notifications[t.id] == true, function(v)
				app:intent("setSetting", { key = "notification", type = t.id, value = v })
			end)
		end

		Ui.text(container, L("settings_night"), { FontFace = Theme.fontBold })
		if app.cfg.night.smuggler.enabled then
			toggle(app, container, "settings_smuggler", st.smugglerOptIn, function(v)
				set("smugglerOptIn", v)
			end)
		end

		if s.derived.storeUnlocked then
			Ui.button(container, L("shop_spending"), function()
				app:open("spending")
			end, { Size = UDim2.new(1, 0, 0, 48), BackgroundColor3 = Theme.colors.panelAlt, TextColor3 = Theme.colors.text })
		end

		Ui.text(container, L("settings_blocked"), { FontFace = Theme.fontBold })
		if #s.social.blocked == 0 then
			Ui.text(container, L("settings_blocked_none"), { TextColor3 = Theme.colors.textDim })
		end
		for _, userId in s.social.blocked do
			local row = Ui.row(container)
			local ok, name = pcall(Players.GetNameFromUserIdAsync, Players, userId)
			Ui.text(row, if ok then name else tostring(userId), { Size = UDim2.new(0.6, 0, 0, 48), AutomaticSize = Enum.AutomaticSize.None })
			Ui.button(row, L("unblock"), function()
				app.remotes.Social:InvokeServer("unblock", { userId = userId })
				local player = Players:GetPlayerByUserId(userId)
				if player then
					pcall(StarterGui.SetCore, StarterGui, "PromptUnblockPlayer", player)
				end
			end, { Size = UDim2.new(0.35, 0, 0, 48) })
		end

		Ui.text(container, L("settings_privacy"), { FontFace = Theme.fontBold })
		Ui.text(container, L("settings_privacy_note"), { TextSize = 15, TextColor3 = Theme.colors.textDim })
		Ui.button(container, L("settings_export"), function()
			app:open("privacy", { mode = "export" })
		end, { Size = UDim2.new(1, 0, 0, 48), BackgroundColor3 = Theme.colors.panelAlt, TextColor3 = Theme.colors.text })
		Ui.button(container, L("settings_delete"), function()
			app:open("privacy", { mode = "delete" })
		end, { Size = UDim2.new(1, 0, 0, 48), BackgroundColor3 = Theme.colors.bad, TextColor3 = Theme.colors.text })
		if RunService:IsStudio() then
			Ui.button(container, "Debug", function()
				app:open("debug")
			end, { Size = UDim2.new(1, 0, 0, 48) })
		end
	end,
}
