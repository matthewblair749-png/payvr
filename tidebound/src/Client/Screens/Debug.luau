--[[ Cheat menu. The server answers only in Studio or for allowlisted testers, and release builds omit it. ]]

local Ui = require(script.Parent.Parent.Ui.Ui)

return {
	title = "Debug",
	build = function(app: any, container: Frame)
		for _, cmd in { "silver", "gems", "materials", "level", "finishTutorial", "tutorialNightNow", "nightNow", "skipTime", "hatch", "resetSave" } do
			Ui.button(container, cmd, function()
				local reply = app.remotes.Debug:InvokeServer(cmd)
				app:toast(cmd .. ": " .. (if reply.ok then "ok" else tostring(reply.err)))
			end, { Size = UDim2.new(1, 0, 0, 48) })
		end
	end,
	static = true,
}
