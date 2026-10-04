--[[
	DataStore access for every service.
	Published places always use real DataStores. In Studio, a place that is not published (or has
	"Enable Studio Access to API Services" off) cannot reach DataStores, so Stores falls back to an
	in-memory store with the same methods. Progress then lasts only for that play session,
	which is what you want for a quick local test.
]]

local DataStoreService = game:GetService("DataStoreService")
local RunService = game:GetService("RunService")

local Stores = {}

local useMemory: boolean? = nil
local memory: { [string]: any } = {}

local function copy(value: any): any
	if type(value) ~= "table" then
		return value
	end
	local out = {}
	for k, v in value do
		out[k] = copy(v)
	end
	return out
end

local function memoryStore(name: string)
	memory[name] = memory[name] or {}
	local data = memory[name]
	local store = {}
	function store:GetAsync(key: string)
		return copy(data[key])
	end
	function store:SetAsync(key: string, value: any)
		data[key] = copy(value)
	end
	function store:RemoveAsync(key: string)
		local old = data[key]
		data[key] = nil
		return old
	end
	function store:UpdateAsync(key: string, transform: (any) -> any)
		local result = transform(copy(data[key]))
		if result ~= nil then
			data[key] = copy(result)
		end
		return copy(result)
	end
	return store
end

local function detect(): boolean
	if not RunService:IsStudio() then
		return false
	end
	local ok = pcall(function()
		DataStoreService:GetDataStore("StudioProbe"):GetAsync("probe")
	end)
	if not ok then
		warn("[tidebound] DataStores are not available in this Studio session (publish the place and enable Studio Access to API Services to use real saves). Using in-memory saves for this test.")
	end
	return not ok
end

function Stores.get(name: string): any
	if useMemory == nil then
		useMemory = detect()
	end
	if useMemory then
		return memoryStore(name)
	end
	return DataStoreService:GetDataStore(name)
end

function Stores.inMemory(): boolean
	return useMemory == true
end

-- Request budget; unlimited for the in-memory store.
function Stores.budget(requestType: Enum.DataStoreRequestType): number
	if useMemory then
		return math.huge
	end
	local ok, value = pcall(DataStoreService.GetRequestBudgetForRequestType, DataStoreService, requestType)
	return if ok then value else 1
end

return Stores
