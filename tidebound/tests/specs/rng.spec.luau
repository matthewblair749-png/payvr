return function(T, Loader)
	local Shared = Loader.root("src/Shared")
	local Rng = Loader.require(Shared.Util.Rng)
	local Hash = Loader.require(Shared.Util.Hash)
	local Time = Loader.require(Shared.Util.Time)

	T.describe("Rng", function()
		T.it("is deterministic and uniform", function()
			local a, b = Rng.new(42), Rng.new(42)
			for _ = 1, 100 do
				T.expect(a:nextNumber()).toBe(b:nextNumber())
			end
			local r = Rng.new(7)
			local sum, n = 0, 100000
			local buckets = { 0, 0, 0, 0 }
			for _ = 1, n do
				local x = r:nextNumber()
				assert(x >= 0 and x < 1)
				sum += x
				local i = r:nextInteger(1, 4)
				buckets[i] += 1
			end
			T.expect(sum / n).toBeNear(0.5, 0.01)
			for i = 1, 4 do
				T.expect(buckets[i] / n).toBeNear(0.25, 0.01)
			end
		end)
	end)

	T.describe("Hash and Time", function()
		T.it("hashes stably", function()
			T.expect(Hash.fnv1a("")).toBe(0x811C9DC5)
			T.expect(Hash.fnv1a("a")).toBe(0xE40C292C)
			local u = Hash.unit("player:1|exp")
			T.expect(u >= 0 and u < 1).toBeTruthy()
		end)
		T.it("parses UTC dates and formats keys", function()
			local t = Time.parseUtc("2026-01-05T00:00:00Z")
			T.expect(t).toBe(1767571200)
			T.expect(Time.dateKey(t + 3600)).toBe("2026-01-05")
			T.expect(Time.monthKey(t)).toBe("2026-01")
		end)
	end)
end
