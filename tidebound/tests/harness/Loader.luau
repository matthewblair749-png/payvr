--[[
	Loads Rojo-layout Luau modules under Lune.

	Production code requires siblings the Roblox way: require(script.Parent.Rules.Hatchery).
	This loader gives every module a `script` object that resolves .Parent and child names
	to files on disk (Name.luau, Name.json, or Name/init.luau), the same mapping Rojo uses.
]]

local fs = require("@lune/fs")
local luau = require("@lune/luau")
local serde = require("@lune/serde")

local Loader = {}

local cache: { [string]: any } = {}
local proxies: { [string]: any } = {}

-- Lune's fs calls can yield, and yielding inside a metamethod is not allowed,
-- so the file tree is indexed up front and metamethods only read this table.
local kinds: { [string]: string } = {}
local listings: { [string]: { string } } = {}

local function index(path: string)
	if fs.isDir(path) then
		kinds[path] = "dir"
		local names = fs.readDir(path)
		table.sort(names)
		listings[path] = names
		for _, n in names do
			index(path .. "/" .. n)
		end
	elseif fs.isFile(path) then
		kinds[path] = "file"
	end
end

local function isDir(path: string): boolean
	return kinds[path] == "dir"
end

local function isFile(path: string): boolean
	return kinds[path] == "file"
end


local function dirname(path: string): string
	return string.match(path, "^(.*)/[^/]+$") or "."
end

local function basename(path: string): string
	local name = string.match(path, "([^/]+)$") or path
	return (string.gsub(name, "%.luau$", ""):gsub("%.json$", ""))
end

-- Virtual folders that Rojo maps from elsewhere in the repo (see default.project.json).
local aliases: { [string]: string } = {}

function Loader.alias(virtualPath: string, realPath: string)
	aliases[virtualPath] = realPath
	index(realPath)
end

local function resolveChild(dir: string, name: string): string?
	local aliased = aliases[dir .. "/" .. name]
	if aliased then
		return aliased
	end
	for _, candidate in { dir .. "/" .. name .. ".luau", dir .. "/" .. name .. ".json" } do
		if isFile(candidate) then
			return candidate
		end
	end
	if isDir(dir .. "/" .. name) then
		return dir .. "/" .. name
	end
	return nil
end

local makeProxy

-- `path` is either a directory, or a file path (.luau/.json).
makeProxy = function(path: string)
	if proxies[path] then
		return proxies[path]
	end
	local proxy = setmetatable({ __path = path }, {
		__index = function(_, key)
			if key == "Parent" then
				return makeProxy(dirname(path))
			elseif key == "Name" then
				return basename(path)
			elseif key == "FindFirstChild" or key == "WaitForChild" then
				return function(_, name)
					local child = isDir(path) and resolveChild(path, name)
					if not child and key == "WaitForChild" then
						error("no child " .. name .. " in " .. path)
					end
					return child and makeProxy(child) or nil
				end
			elseif key == "GetChildren" then
				return function()
					local out = {}
					if isDir(path) then
						for _, n in listings[path] do
							if n ~= "init.luau" then
								table.insert(out, makeProxy(path .. "/" .. n))
							end
						end
					end
					return out
				end
			elseif key == "IsA" then
				return function(_, className)
					return className == "ModuleScript" and not isDir(path) or (className == "Folder" and isDir(path))
				end
			end
			if not isDir(path) then
				error(("%s has no child %s"):format(path, tostring(key)), 2)
			end
			local child = resolveChild(path, key)
			if not child then
				error(("%s has no child %s"):format(path, tostring(key)), 2)
			end
			return makeProxy(child)
		end,
	})
	proxies[path] = proxy
	return proxy
end

local function fileFor(path: string): string
	if isDir(path) then
		local init = path .. "/init.luau"
		assert(isFile(init), "cannot require folder without init.luau: " .. path)
		return init
	end
	return path
end

local function requireProxy(target: any)
	if type(target) == "string" then
		return require(target)
	end
	local path = rawget(target, "__path")
	assert(path, "require expects a module proxy")
	local file = fileFor(path)
	if cache[file] ~= nil then
		return cache[file]
	end
	local source = fs.readFile(file)
	local result
	if string.sub(file, -5) == ".json" then
		result = serde.decode("json", source)
	else
		-- A module's `script` is its own path; for init.luau it is the folder.
		local scriptProxy = makeProxy(path)
		local chunk = luau.load(source, {
			debugName = file,
			environment = { script = scriptProxy, require = requireProxy },
			injectGlobals = true,
		})
		result = chunk()
	end
	cache[file] = result
	return result
end

function Loader.root(path: string)
	if not kinds[path] then
		index(path)
	end
	return makeProxy(path)
end

Loader.require = requireProxy

function Loader.reset()
	table.clear(cache)
end

return Loader
