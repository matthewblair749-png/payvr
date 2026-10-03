--[[
	Versioned player save.

	CURRENT_VERSION is the shape every rule expects. Older saves pass through MIGRATIONS in order,
	one version step at a time, before the server touches them. Migrations never delete progress.

	v1 (closed beta): { schemaVersion = 1, coins, gems, inventory = { fish, crops }, drifters = { { mood = 0..10, ... } } }
	v2 (launch):      split currencies, happiness 0..100, pity counters, entitlements and the purchase ledger.
]]

local Tbl = require(script.Parent.Util.Tbl)

local SaveSchema = {}

SaveSchema.CURRENT_VERSION = 2

local NOTIFICATION_TYPES = { "crops_ready", "worker_income_full", "night_starting", "season_changed" }

function SaveSchema.new(userId: number, now: number, cfg: any): any
	local plots = {}
	for i = 1, cfg.day.farming.startPlots do
		plots[i] = { cropId = nil, plantedAt = 0 }
	end
	local notifications = {}
	for _, id in NOTIFICATION_TYPES do
		notifications[id] = true
	end
	return {
		schemaVersion = SaveSchema.CURRENT_VERSION,
		userId = userId,
		createdAt = now,
		lastSeenAt = now,
		lastSimAt = now,
		revision = 0,

		currencies = { silver = cfg.economy.startingSilver, pearls = 0, gems = 0 },
		debt = { silver = 0, gems = 0 },
		materials = { driftwood = 0, shells = 0, ironScrap = 0 },
		fish = {},
		crops = {},

		rods = { owned = { 1 }, equipped = 1 },
		cast = nil,
		plots = plots,
		forage = {},

		drifters = {},
		nextDrifterNum = 1,
		storageUpgrades = 0,
		worker = { pending = 0, lastAccrualAt = now },
		hatch = { eggs = 0, sinceEpic = 0, sinceLegendary = 0, total = 0 },
		collection = {},

		cosmetics = {},
		equipped = { rodSkin = nil, decorations = {} },
		cratePity = {},

		progress = { level = 1, xp = 0, playSeconds = 0, milestonesClaimed = {} },
		stats = {},
		night = { streak = 0, survived = 0, played = 0, firstCompleted = false, settled = {} },
		onboarding = { step = 0, done = false, skipped = false, firstNightAt = nil, log = {} },
		quests = { dateKey = "", daily = {}, weekKey = "", weekly = nil },
		login = { lastDateKey = "", streak = 0 },
		market = { adDateKey = "", lastSaleValue = 0 },
		pass = { blockId = -1, xp = 0, paid = {}, claimedFree = {}, claimedPaid = {} },
		entitlements = {
			starterPack = false,
			storagePass = false,
			gemStorage = 0,
			club = { active = false, renewing = false, periodKey = "", lastDailyGemsKey = "", monthlyClaimed = {} },
		},
		spend = { byMonth = {}, limitRobux = cfg.catalog.spendControls.defaultLimitRobux },
		purchases = { processed = {}, order = {}, ledger = {} },
		settings = {
			textScale = 1,
			haptics = true,
			reducedMotion = false,
			music = 0.6,
			sfx = 0.8,
			notifications = notifications,
			smugglerOptIn = false,
		},
		social = { blocked = {} },
		flags = { violations = 0 },
	}
end

local function v1ToV2(old: any, cfg: any): any
	local now = old.lastSeenAt or old.createdAt or 0
	local save = SaveSchema.new(old.userId, now, cfg)
	save.createdAt = old.createdAt or now
	save.lastSeenAt = old.lastSeenAt or now
	save.lastSimAt = old.lastSeenAt or now
	save.currencies.silver = math.max(0, math.floor(old.coins or 0))
	save.currencies.gems = math.max(0, math.floor(old.gems or 0))
	save.currencies.pearls = math.max(0, math.floor(old.pearls or 0))
	if old.inventory then
		save.fish = Tbl.deepCopy(old.inventory.fish or {})
		save.crops = Tbl.deepCopy(old.inventory.crops or {})
		for _, m in { "driftwood", "shells", "ironScrap" } do
			save.materials[m] = (old.inventory.materials and old.inventory.materials[m]) or 0
		end
	end
	for i, d in old.drifters or {} do
		table.insert(save.drifters, {
			id = d.id or ("d" .. i),
			speciesId = d.speciesId,
			traitId = d.traitId,
			level = d.level or 1,
			xp = d.xp or 0,
			-- v1 mood was 0..10; v2 happiness is 0..100.
			happiness = math.clamp((d.mood or 7) * 10, 0, 100),
			role = d.role or "worker",
			active = d.active == true,
			lastRoleSwitchCycle = -1,
			skinId = nil,
			hatchedAt = d.hatchedAt or now,
		})
		save.collection[d.speciesId] = true
	end
	save.nextDrifterNum = #save.drifters + 1
	save.progress.level = old.level or 1
	save.progress.xp = old.xp or 0
	-- Beta testers already finished the tutorial.
	save.onboarding.done = true
	save.onboarding.skipped = true
	save.night.firstCompleted = (old.nightsPlayed or 0) > 0
	save.schemaVersion = 2
	return save
end

SaveSchema.MIGRATIONS = {
	[1] = v1ToV2,
}

-- Upgrades any older save to CURRENT_VERSION. Returns (save, migratedFrom?).
function SaveSchema.migrate(save: any, cfg: any): (any, number?)
	local from = save.schemaVersion or 1
	if from > SaveSchema.CURRENT_VERSION then
		error(("save version %d is newer than this server (%d)"):format(from, SaveSchema.CURRENT_VERSION))
	end
	local current = save
	while (current.schemaVersion or 1) < SaveSchema.CURRENT_VERSION do
		local step = SaveSchema.MIGRATIONS[current.schemaVersion or 1]
		assert(step, "no migration from version " .. tostring(current.schemaVersion))
		current = step(current, cfg)
	end
	SaveSchema.fillDefaults(current, cfg)
	return current, if from < SaveSchema.CURRENT_VERSION then from else nil
end

-- Adds any field introduced after the save was written (same version, additive changes).
function SaveSchema.fillDefaults(save: any, cfg: any)
	local template = SaveSchema.new(save.userId, save.createdAt or 0, cfg)
	local function fill(target, source)
		for k, v in source do
			if target[k] == nil then
				target[k] = Tbl.deepCopy(v)
			elseif type(v) == "table" and type(target[k]) == "table" and next(v) ~= nil and v[1] == nil then
				fill(target[k], v)
			end
		end
	end
	fill(save, template)
end

return SaveSchema
