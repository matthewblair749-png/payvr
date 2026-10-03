return function(T, Loader)
	local Interpolator = Loader.require(Loader.root("src/Shared").Night.Interpolator)

	T.it("blends between snapshots 100 ms behind and ignores out-of-order packets", function()
		local interp = Interpolator.new()
		interp:push(1.00, 11.00, { [7] = { x = 0, y = 0 } })
		interp:push(1.05, 11.05, { [7] = { x = 1, y = 2 } })
		interp:push(1.02, 11.06, { [7] = { x = 99, y = 99 } }) -- late duplicate, dropped
		interp:push(1.10, 11.10, { [7] = { x = 2, y = 4 } })
		local s = interp:sample(11.175) -- render time 1.075
		T.expect(s[7].x).toBeNear(1.5, 1e-6)
		T.expect(s[7].y).toBeNear(3, 1e-6)
		-- Before the buffer: first snapshot. After: hold the newest.
		T.expect(interp:sample(10)[7].x).toBe(0)
		T.expect(interp:sample(20)[7].x).toBe(2)
	end)
end
