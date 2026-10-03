--[[ Localization readiness: every key the client asks for exists in the English string table. ]]
return function(T, Loader)
	local fs = require("@lune/fs")
	local ConfigLoader = Loader.require(Loader.root("src/Shared").ConfigLoader)
	local cfg = ConfigLoader.defaults()

	local keys = {}
	local csv = fs.readFile("src/Localization/strings.csv")
	for line in string.gmatch(csv, "[^\n]+") do
		local key = string.match(line, "^([%w_]+),")
		if key then
			keys[key] = true
		end
	end

	local function sources(dir, out)
		for _, name in fs.readDir(dir) do
			local path = dir .. "/" .. name
			if fs.isDir(path) then
				sources(path, out)
			elseif string.match(name, "%.luau$") then
				table.insert(out, fs.readFile(path))
			end
		end
		return out
	end

	T.it("has every literal key used by the client", function()
		local missing = {}
		for _, text in sources("src/Client", {}) do
			for key in string.gmatch(text, '%f[%w]L%("([%w_]+)"%s*[,%)]') do
				if not keys[key] then
					table.insert(missing, key)
				end
			end
			for key in string.gmatch(text, 'title = "([%w_]+)"') do
				if not keys[key] and key ~= "Debug" then
					table.insert(missing, key)
				end
			end
		end
		T.expect(table.concat(missing, ", ")).toBe("")
	end)

	T.it("has a message for every error code the server can return", function()
		local missing = {}
		for _, dir in { "src/Shared", "src/Server" } do
			for _, text in sources(dir, {}) do
				for _, pattern in { 'fail%("([%w_]+)"%)', 'return nil, "([%w_]+)"', 'err = "([%w_]+)"' } do
					for code in string.gmatch(text, pattern) do
						if not keys["err_" .. code] and code ~= "legendary" then
							table.insert(missing, code)
						end
					end
				end
			end
		end
		T.expect(table.concat(missing, ", ")).toBe("")
	end)

	T.it("names every piece of content in config", function()
		local missing = {}
		local function need(k)
			if not keys[k] then
				table.insert(missing, k)
			end
		end
		for _, f in cfg.day.fishing.fish do
			need(f.id)
		end
		for _, s in cfg.drifters.species do
			need(s.id)
		end
		for _, t in cfg.drifters.traits do
			need(t.id)
		end
		for _, r in Loader.require(Loader.root("src/Shared").Rules.Odds).ORDER do
			need("rarity_" .. r)
		end
		for _, e in cfg.drifters.elements do
			need("element_" .. e)
		end
		for _, b in cfg.harbor.buildings do
			need("building_" .. b.id)
			need("perk_" .. b.perk)
		end
		for _, n in cfg.harbor.notifications.types do
			need("notif_" .. n.id)
		end
		for _, q in cfg.compliance.quickPhrases do
			need(q)
		end
		for _, p in { "day", "dusk", "night", "dawn" } do
			need("phase_" .. p)
		end
		T.expect(table.concat(missing, ", ")).toBe("")
	end)
end
