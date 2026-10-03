--[[
	Runs every spec in tests/specs with Lune:  lune run tests/run  (from the tidebound folder)
	Optional filter:                            lune run tests/run hatch
]]

local fs = require("@lune/fs")
local process = require("@lune/process")
local Loader = require("./harness/Loader")
local Test = require("./harness/Test")

Loader.alias("src/Shared/Config", "shared/config")

-- Server integration specs run the real server scripts from a place built by Rojo.
fs.writeDir("tests/.build")
local build = process.exec("rojo", { "build", "default.project.json", "-o", "tests/.build/tidebound-dev.rbxl" })
if not build.ok then
	print("rojo build failed (is rojo on PATH?):\n" .. build.stderr)
	process.exit(1)
end

local filter = process.args[1]
local specs = fs.readDir("tests/specs")
table.sort(specs)

for _, file in specs do
	if string.match(file, "%.spec%.luau$") and (not filter or string.find(file, filter, 1, true)) then
		print("\n" .. file)
		Loader.reset()
		local spec = Loader.require(Loader.root("tests/specs/" .. file))
		spec(Test, Loader)
	end
end

local r = Test.results()
print(("\n%d passed, %d failed"):format(r.passed, r.failed))
if r.failed > 0 then
	for _, f in r.failures do
		print("FAILED: " .. f.name)
	end
	process.exit(1)
end

-- Server scripts leave background loops scheduled; exit explicitly.
process.exit(0)
