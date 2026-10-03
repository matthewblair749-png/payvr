--[[ Small table helpers shared by rules. ]]

local Tbl = {}

function Tbl.deepCopy<T>(value: T): T
	if type(value) ~= "table" then
		return value
	end
	local out = {}
	for k, v in value :: any do
		out[Tbl.deepCopy(k)] = Tbl.deepCopy(v)
	end
	return out :: any
end

function Tbl.find<T>(list: { T }, predicate: (T) -> boolean): T?
	for _, item in list do
		if predicate(item) then
			return item
		end
	end
	return nil
end

function Tbl.byId(list: { any }, id: string): any
	for _, item in list do
		if item.id == id then
			return item
		end
	end
	return nil
end

function Tbl.count(map: { [any]: any }): number
	local n = 0
	for _ in map do
		n += 1
	end
	return n
end

function Tbl.contains(list: { any }, value: any): boolean
	return table.find(list, value) ~= nil
end

-- JSON Merge Patch (RFC 7386); used for remote config overrides.
function Tbl.mergePatch(target: any, patch: any): any
	if type(patch) ~= "table" or patch[1] ~= nil then
		return Tbl.deepCopy(patch)
	end
	local result = type(target) == "table" and target[1] == nil and Tbl.deepCopy(target) or {}
	for k, v in patch do
		if v == Tbl.NULL then
			result[k] = nil
		else
			result[k] = Tbl.mergePatch(result[k], v)
		end
	end
	return result
end

-- Sentinel for "remove this key" in merge patches (JSON null does not survive Luau tables).
Tbl.NULL = setmetatable({}, { __tostring = function()
	return "NULL"
end })

function Tbl.sortedKeys(map: { [string]: any }): { string }
	local keys = {}
	for k in map do
		table.insert(keys, k)
	end
	table.sort(keys)
	return keys
end

return Tbl
