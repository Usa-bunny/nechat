// Cache in-memory untuk group key yang sudah dibuka (hilang saat tab ditutup).
const cache = new Map<string, CryptoKey>()

export const getGroupKey = (groupId: string) => cache.get(groupId)
export const setGroupKey = (groupId: string, key: CryptoKey) => void cache.set(groupId, key)
export const clearGroupKeys = () => cache.clear()
