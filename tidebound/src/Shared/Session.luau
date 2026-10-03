--[[
	Join, tick and night settlement for one player's save. Pure, so the whole player lifecycle
	(new player, a full day, a night, leaving and coming back) is covered by tests outside Roblox.
]]

local SaveSchema = require(script.Parent.SaveSchema)
local TimeSim = require(script.Parent.Rules.TimeSim)
local Progression = require(script.Parent.Rules.Progression)
local Onboarding = require(script.Parent.Onboarding)
local Ledger = require(script.Parent.Store.Ledger)
local Pass = require(script.Parent.Store.Pass)
local Spending = require(script.Parent.Store.Spending)

local Session = {}

--[[
	Loads (or creates) a save and catches it up to now. raw may be nil for a new player.
	Returns (save, summary) where summary feeds the "while you were away" panel and analytics.
]]
function Session.join(cfg: any, raw: any?, userId: number, now: number, mods: any): (any, any)
	local save, migratedFrom
	local isNew = raw == nil
	if isNew then
		save = SaveSchema.new(userId, now, cfg)
	else
		save, migratedFrom = SaveSchema.migrate(raw, cfg)
	end
	save.userId = userId
	local away = TimeSim.advance(cfg, save, now, mods, false)
	local login = Progression.login(cfg, save, now)
	if login then
		Ledger.apply(save, login.entries)
	end
	Progression.refreshQuests(cfg, save, now)
	Pass.ensureBlock(cfg, save, now)
	Spending.tick(save, now)
	save.lastSeenAt = now
	return save, { isNew = isNew, migratedFrom = migratedFrom, away = away, login = login }
end

-- Called every few seconds while the player is in the server.
function Session.tick(cfg: any, save: any, now: number, mods: any): any
	return TimeSim.advance(cfg, save, now, mods, true)
end

function Session.leave(save: any, now: number)
	save.lastSeenAt = now
	-- An unfinished cast is dropped; nothing was taken for it.
	save.cast = nil
end

--[[
	Applies one night's reward exactly once (nightId is unique per room and squad).
	Returns analytics events.
]]
function Session.settleNight(cfg: any, save: any, nightId: string, reward: any, now: number): { any }
	if table.find(save.night.settled, nightId) then
		return {}
	end
	table.insert(save.night.settled, nightId)
	while #save.night.settled > 20 do
		table.remove(save.night.settled, 1)
	end
	local n = save.night
	n.played += 1
	n.streak = reward.streakAfter
	local events = {}
	if reward.survived then
		n.survived += 1
		Progression.record(cfg, save, "nightSurvived", 1, now)
		table.insert(events, { name = "night_survived", props = { waves = reward.wavesSurvived, streak = reward.streakAfter, share = reward.share } })
	else
		table.insert(events, { name = "night_failed", props = { waves = reward.wavesSurvived } })
	end
	if reward.bossDefeated then
		table.insert(events, { name = "boss_defeated", props = {} })
	end
	if reward.repairHp and reward.repairHp > 0 then
		Progression.record(cfg, save, "repairHp", reward.repairHp, now)
	end
	-- Iron scrap spent on repairs during the night.
	save.materials.ironScrap = math.max(0, save.materials.ironScrap - (reward.ironUsed or 0))
	local entries = { { t = "currency", k = "silver", n = reward.silver } }
	if reward.pearls > 0 then
		table.insert(entries, { t = "currency", k = "pearls", n = reward.pearls })
	end
	for m, amount in reward.materials do
		if amount > 0 then
			table.insert(entries, { t = "material", k = m, n = amount })
		end
	end
	Ledger.apply(save, entries)
	for _, e in Progression.addXp(cfg, save, reward.xp) do
		table.insert(events, e)
	end
	Pass.addXp(cfg, save, reward.passXp, now)
	if not n.firstCompleted then
		n.firstCompleted = true
		local e = Onboarding.complete(save, "first_night", now)
		if e then
			table.insert(events, e)
		end
		-- The one-time Starter Pack offer may now be shown (never before the first night ends).
		table.insert(events, { name = "starter_offer_eligible", props = {} })
	end
	return events
end

return Session
