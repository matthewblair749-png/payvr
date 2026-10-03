--[[
	The first 60 seconds: first cast always succeeds, sell the fish for 100 Silver, hatch a guaranteed
	Common Drifter, assign its role, then a gentle countdown to a reduced first night (3 waves, no boss).
	Each step is logged with the seconds since the tutorial started.
]]

local Onboarding = {}

Onboarding.STEPS = { "welcome", "first_cast", "sell_fish", "hatch_egg", "assign_role", "countdown", "first_night" }

function Onboarding.index(step: string): number
	return table.find(Onboarding.STEPS, step) or 0
end

-- Marks a step complete if it is the next one. Returns an analytics event or nil.
function Onboarding.complete(save: any, step: string, now: number): any
	local ob = save.onboarding
	local i = Onboarding.index(step)
	if i == 0 or i ~= ob.step + 1 then
		return nil
	end
	if ob.step == 0 then
		ob.startedAt = now
	end
	ob.step = i
	table.insert(ob.log, { step = step, at = now })
	return { name = "tutorial_step", props = { step = step, index = i, seconds = math.floor(now - (ob.startedAt or now)), skipped = false } }
end

function Onboarding.skip(save: any, now: number): any
	local ob = save.onboarding
	if ob.done then
		return nil
	end
	ob.done = true
	ob.skipped = true
	table.insert(ob.log, { step = "skipped", at = now })
	return { name = "tutorial_step", props = { step = "skipped", index = ob.step, seconds = math.floor(now - (ob.startedAt or now)), skipped = true } }
end

function Onboarding.active(save: any): boolean
	return not save.onboarding.done
end

return Onboarding
