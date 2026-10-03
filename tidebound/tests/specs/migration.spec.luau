return function(T, Loader)
	local Shared = Loader.root("src/Shared")
	local ConfigLoader = Loader.require(Shared.ConfigLoader)
	local SaveSchema = Loader.require(Shared.SaveSchema)
	local cfg = ConfigLoader.defaults()

	local v1 = {
		schemaVersion = 1,
		userId = 9,
		createdAt = 1760000000,
		lastSeenAt = 1760001000,
		coins = 1234,
		gems = 55,
		level = 7,
		xp = 30,
		nightsPlayed = 3,
		inventory = { fish = { fish_minnowkin = 4 }, crops = { crop_sea_lettuce = 2 }, materials = { driftwood = 9, ironScrap = 2 } },
		drifters = {
			{ id = "a", speciesId = "drf_puddlefin", traitId = "trait_brave", level = 4, xp = 10, mood = 8, role = "guardian", active = true },
			{ id = "b", speciesId = "drf_sprouty", traitId = "trait_diligent", level = 2, mood = 3 },
		},
	}

	T.it("migrates a v1 save to v2 without losing progress", function()
		local save, from = SaveSchema.migrate(v1, cfg)
		T.expect(from).toBe(1)
		T.expect(save.schemaVersion).toBe(2)
		T.expect(save.currencies.silver).toBe(1234)
		T.expect(save.currencies.gems).toBe(55)
		T.expect(save.progress.level).toBe(7)
		T.expect(save.fish.fish_minnowkin).toBe(4)
		T.expect(save.materials.driftwood).toBe(9)
		T.expect(save.materials.shells).toBe(0)
		T.expect(#save.drifters).toBe(2)
		T.expect(save.drifters[1].happiness).toBe(80)
		T.expect(save.drifters[2].happiness).toBe(30)
		T.expect(save.drifters[1].role).toBe("guardian")
		T.expect(save.drifters[2].role).toBe("worker")
		T.expect(save.collection.drf_sprouty).toBeTruthy()
		T.expect(save.hatch.sinceEpic).toBe(0)
		T.expect(save.onboarding.done).toBeTruthy()
		T.expect(save.night.firstCompleted).toBeTruthy()
		T.expect(save.nextDrifterNum).toBe(3)
	end)

	T.it("leaves current saves alone and fills fields added later", function()
		local save = SaveSchema.new(1, 0, cfg)
		save.settings = nil
		local migrated, from = SaveSchema.migrate(save, cfg)
		T.expect(from).toBe(nil)
		T.expect(migrated.settings.haptics).toBeTruthy()
	end)

	T.it("refuses saves from a newer server version", function()
		local ok = pcall(SaveSchema.migrate, { schemaVersion = 99 }, cfg)
		T.expect(ok).toBeFalsy()
	end)
end
