--[[ Harbor Pass: free and paid tracks. Pass XP comes from play and is the same for everyone. ]]

local Ui = require(script.Parent.Parent.Ui.Ui)
local Theme = require(script.Parent.Parent.Ui.Theme)
local Format = require(script.Parent.Parent.Ui.Format)

local function rewardText(app: any, reward: any): string
	local L = app.L
	local parts = {}
	if reward.silver then
		table.insert(parts, L("reward_silver", { n = reward.silver }))
	end
	if reward.pearls then
		table.insert(parts, L("reward_pearls", { n = reward.pearls }))
	end
	if reward.gems then
		table.insert(parts, L("reward_gems", { n = reward.gems }))
	end
	if reward.eggs then
		table.insert(parts, L("reward_eggs", { n = reward.eggs }))
	end
	for m, n in reward.materials or {} do
		table.insert(parts, n .. " " .. L("material_" .. m))
	end
	for _, c in reward.cosmetics or {} do
		table.insert(parts, L(c))
	end
	return table.concat(parts, ", ")
end

return {
	title = "panel_pass",
	build = function(app: any, container: Frame)
		local L = app.L
		local s = app.state
		local hp = app.cfg.catalog.harborPass
		local now = workspace:GetServerTimeNow()
		Ui.text(container, L("pass_status", { tier = s.derived.passTier, tiers = hp.tiers, xp = s.pass.xp % hp.xpPerTier, per = hp.xpPerTier, time = Format.duration(s.derived.passEndsAt - now) }))
		if not s.derived.passOwned and s.derived.storeUnlocked then
			-- Shown only inside the pass screen the player opened; never as a pop-up.
			Ui.button(container, L("pass_unlock_paid"), function()
				app:open("shop", { focus = "harbor_pass" })
			end, { Size = UDim2.new(1, 0, 0, 48), BackgroundColor3 = Theme.colors.panelAlt, TextColor3 = Theme.colors.text })
		end
		local paidByTier = {}
		for _, r in hp.paidTrack do
			paidByTier[r.tier] = r
		end
		for _, free in hp.freeTrack do
			local tier = free.tier
			local card = Ui.card(container)
			Ui.text(card, L("pass_tier", { tier = tier }), { FontFace = Theme.fontBold })
			local row = Ui.row(card)
			local unlocked = s.derived.passTier >= tier
			local freeClaimed = table.find(s.pass.claimedFree, tier) ~= nil
			Ui.button(row, (if freeClaimed then "✓ " else "") .. rewardText(app, free), function()
				app:intent("claimPass", { track = "free", tier = tier })
			end, { Size = UDim2.new(0.5, -4, 0, 56), TextSize = 14, Active = unlocked and not freeClaimed, BackgroundColor3 = if unlocked and not freeClaimed then Theme.colors.accent else Theme.colors.panel, TextColor3 = if unlocked and not freeClaimed then Theme.colors.buttonText else Theme.colors.text })
			local paid = paidByTier[tier]
			if paid then
				local paidClaimed = table.find(s.pass.claimedPaid, tier) ~= nil
				local canClaim = unlocked and s.derived.passOwned and not paidClaimed
				Ui.button(row, (if paidClaimed then "✓ " else "◆ ") .. rewardText(app, paid), function()
					app:intent("claimPass", { track = "paid", tier = tier })
				end, { Size = UDim2.new(0.5, -4, 0, 56), TextSize = 14, Active = canClaim, BackgroundColor3 = if canClaim then Theme.colors.gem else Theme.colors.panel, TextColor3 = if canClaim then Theme.colors.buttonText else Theme.colors.textDim })
			end
		end
	end,
}
