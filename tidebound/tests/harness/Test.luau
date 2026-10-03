--[[ Minimal test runner with describe/it/expect. ]]

local Test = {}

local results = { passed = 0, failed = 0, failures = {} }
local prefix = {}

function Test.describe(name: string, fn: () -> ())
	table.insert(prefix, name)
	fn()
	table.remove(prefix)
end

function Test.it(name: string, fn: () -> ())
	local full = table.concat(prefix, " > ") .. " > " .. name
	local start = os.clock()
	local ok, err = xpcall(fn, debug.traceback)
	local ms = math.floor((os.clock() - start) * 1000)
	if ok then
		results.passed += 1
		print(("  ok   %s (%dms)"):format(full, ms))
	else
		results.failed += 1
		table.insert(results.failures, { name = full, err = err })
		print(("  FAIL %s\n%s"):format(full, tostring(err)))
	end
end

local function fmt(v: any): string
	if type(v) == "string" then
		return ("%q"):format(v)
	end
	return tostring(v)
end

function Test.expect(actual: any)
	local e = {}
	function e.toBe(expected: any)
		if actual ~= expected then
			error(("expected %s, got %s"):format(fmt(expected), fmt(actual)), 2)
		end
	end
	function e.toBeNear(expected: number, tolerance: number)
		if math.abs(actual - expected) > tolerance then
			error(("expected %s within %s of %s"):format(fmt(actual), fmt(tolerance), fmt(expected)), 2)
		end
	end
	function e.toBeTruthy()
		if not actual then
			error("expected truthy, got " .. fmt(actual), 2)
		end
	end
	function e.toBeFalsy()
		if actual then
			error("expected falsy, got " .. fmt(actual), 2)
		end
	end
	function e.toBeAtLeast(n: number)
		if actual < n then
			error(("expected >= %s, got %s"):format(fmt(n), fmt(actual)), 2)
		end
	end
	function e.toBeAtMost(n: number)
		if actual > n then
			error(("expected <= %s, got %s"):format(fmt(n), fmt(actual)), 2)
		end
	end
	return e
end

function Test.results()
	return results
end

return Test
