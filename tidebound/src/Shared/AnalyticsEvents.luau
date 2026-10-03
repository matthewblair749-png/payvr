--[[
	Every analytics event name the game logs. The first block uses the exact names from the brief.
	fields lists up to three properties sent as Roblox custom fields; the full payload goes to the backend.
]]

return {
	store_opened = { fields = { "source" } },
	product_viewed = { fields = { "productId", "variantId" } },
	purchase_started = { fields = { "productId", "variantId" }, value = "robux" },
	purchase_completed = { fields = { "productId", "variantId" }, value = "robux" },
	purchase_failed = { fields = { "productId", "reason" } },
	purchase_refunded = { fields = { "productId", "reason" }, value = "robux" },
	crate_opened = { fields = { "crateId", "rarity", "paid" } },
	subscription_started = { fields = { "productId" } },
	subscription_renewed = { fields = { "productId" } },
	subscription_cancelled = { fields = { "productId" } },
	pass_tier_claimed = { fields = { "track", "tier" } },
	tutorial_step = { fields = { "step", "skipped" }, value = "seconds" },
	first_hatch = { fields = { "speciesId", "rarity" }, value = "seconds" },
	night_started = { fields = { "squadSize", "onboarding" } },
	night_survived = { fields = { "waves", "streak" } },
	night_failed = { fields = { "waves" } },
	boss_defeated = { fields = {} },
	harbor_tier_unlocked = { fields = { "buildingId", "tier" } },
	session_length = { fields = { "platform" }, value = "seconds" },
	notification_opened = { fields = { "type" } },

	-- Supporting events used by the KPI dashboard and balance tuning.
	gems_spent = { fields = { "itemId", "variantId" }, value = "gems" },
	drifter_hatched = { fields = { "rarity", "usedEgg" } },
	quest_completed = { fields = { "questId" } },
	level_up = { fields = { "level" } },
	rewarded_ad_completed = { fields = { "placement" }, value = "silver" },
	starter_offer_shown = { fields = {} },
	session_started = { fields = { "isNew", "platform" } },
}
