--[[ Input validation for anything arriving from a client. Every check rejects NaN, infinities and wrong types. ]]

local Validate = {}

function Validate.number(x: any, min: number, max: number): boolean
	return type(x) == "number" and x == x and x >= min and x <= max
end

function Validate.int(x: any, min: number, max: number): boolean
	return Validate.number(x, min, max) and x % 1 == 0
end

function Validate.str(x: any, maxLen: number, pattern: string?): boolean
	if type(x) ~= "string" or #x == 0 or #x > maxLen then
		return false
	end
	return pattern == nil or string.match(x, pattern) ~= nil
end

function Validate.id(x: any): boolean
	return Validate.str(x, 64, "^[%w_]+$")
end

function Validate.bool(x: any): boolean
	return type(x) == "boolean"
end

function Validate.oneOf(x: any, options: { any }): boolean
	return table.find(options, x) ~= nil
end

-- Only plain tables with string keys and no metatables (rejects Instances and userdata tricks).
function Validate.plainTable(x: any, maxKeys: number): boolean
	if type(x) ~= "table" or getmetatable(x) ~= nil then
		return false
	end
	local n = 0
	for k in x do
		n += 1
		if type(k) ~= "string" or n > maxKeys then
			return false
		end
	end
	return true
end

return Validate
