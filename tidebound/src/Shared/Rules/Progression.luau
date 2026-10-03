--[[ Player level, stats, daily quests, the weekly goal, and the login streak. ]]

local Hash = require(script.Parent.Parent.Util.Hash)
local Time = require(script.Parent.Parent.Util.Time)

local Progression = {}

function Progression.xpToNext(cfg: any, level: number): number
	local p = cfg.economy.playerLevel
	return math.floor(p.xpBase + p.xpLinear * (level - 1) ^ p.xpExponent)
end

-- Adds player XP. Returns a list of events (level ups, milestone Pearls).
function Progression.addXp(cfg: any, save: any, xp: number): { any }
	local events = {}
	local p = cfg.economy.playerLevel
	local prog = save.progress
	if prog.level >= p.maxLevel then
		return events
	end
	prog.xp += xp
	while prog.level < p.maxLevel and prog.xp >= Progression.xpToNext(cfg, prog.level) do
		prog.xp -= Progression.xpToNext(cfg, prog.level)
		prog.level += 1
		table.insert(events, { name = "level_up", props = { level = prog.level } })
		for _, m in cfg.economy.milestonePearls do
			if m.level == prog.level and not prog.milestonesClaimed[tostring(m.level)] then
				prog.milestonesClaimed[tostring(m.level)] = true
				save.currencies.pearls += m.pearls
				table.insert(events, { name = "milestone_pearls", props = { level = m.level, pearls = m.pearls } })
			end
		end
	end
	if prog.level >= p.maxLevel then
		prog.xp = 0
	end
	return events
end

-- Picks today's quests from the pool. Same picks for a player on any server.
function Progression.refreshQuests(cfg: any, save: any, now: number)
	local q = cfg.harbor.quests
	local dateKey = Time.dateKey(now)
	if save.quests.dateKey ~= dateKey then
		save.quests.dateKey = dateKey
		local pool = {}
		for _, quest in q.pool do
			table.insert(pool, { id = quest.id, score = Hash.unit(tostring(save.userId) .. ":" .. dateKey .. ":" .. quest.id) })
		end
		table.sort(pool, function(a, b)
			return a.score < b.score
		end)
		save.quests.daily = {}
		for i = 1, q.dailyCount do
			table.insert(save.quests.daily, { id = pool[i].id, progress = 0, claimed = false })
		end
	end
	local weekKey = Time.weekKey(now)
	if save.quests.weekKey ~= weekKey then
		save.quests.weekKey = weekKey
		save.quests.weekly = { id = q.weekly.id, progress = 0, claimed = false }
	end
end

-- Records a stat (fishCaught, cropHarvested, ...) and advances matching quests.
function Progression.record(cfg: any, save: any, stat: string, amount: number, now: number)
	if amount <= 0 then
		return
	end
	save.stats[stat] = (save.stats[stat] or 0) + amount
	Progression.refreshQuests(cfg, save, now)
	local all = table.clone(save.quests.daily)
	table.insert(all, save.quests.weekly)
	for _, entry in all do
		local quest = cfg.index.quests[entry.id]
		if quest and quest.type == stat and not entry.claimed then
			entry.progress = math.min(quest.target, entry.progress + amount)
		end
	end
end

-- Returns (reward entries, passXp) or (nil, errorCode).
function Progression.claimQuest(cfg: any, save: any, questId: string, now: number): (any, any)
	Progression.refreshQuests(cfg, save, now)
	local entry
	for _, e in save.quests.daily do
		if e.id == questId then
			entry = e
		end
	end
	if save.quests.weekly and save.quests.weekly.id == questId then
		entry = save.quests.weekly
	end
	if not entry then
		return nil, "unknown_quest"
	end
	local quest = cfg.index.quests[questId]
	if entry.claimed then
		return nil, "already_claimed"
	end
	if entry.progress < quest.target then
		return nil, "not_complete"
	end
	entry.claimed = true
	local entries = {}
	if (quest.silver or 0) > 0 then
		table.insert(entries, { t = "currency", k = "silver", n = quest.silver })
	end
	if (quest.pearls or 0) > 0 then
		table.insert(entries, { t = "currency", k = "pearls", n = quest.pearls })
	end
	return entries, quest.passXp or 0
end

-- Daily login streak. Returns reward entries the first time each UTC day, else nil.
function Progression.login(cfg: any, save: any, now: number): any
	local today = Time.dateKey(now)
	local login = save.login
	if login.lastDateKey == today then
		return nil
	end
	local yesterday = Time.dateKey(now - 86400)
	if login.lastDateKey == yesterday then
		login.streak += 1
	else
		login.streak = 1
	end
	login.lastDateKey = today
	local days = cfg.harbor.loginStreak
	local day = ((login.streak - 1) % #days) + 1
	local reward = days[day]
	local entries = {}
	if (reward.silver or 0) > 0 then
		table.insert(entries, { t = "currency", k = "silver", n = reward.silver })
	end
	if (reward.pearls or 0) > 0 then
		table.insert(entries, { t = "currency", k = "pearls", n = reward.pearls })
	end
	return { day = day, streak = login.streak, entries = entries }
end

function Progression.collectionProgress(cfg: any, save: any): (number, number)
	local found = 0
	for _, s in cfg.drifters.species do
		if save.collection[s.id] then
			found += 1
		end
	end
	return found, #cfg.drifters.species
end

return Progression
