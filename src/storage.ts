/**
 * Safe localStorage wrapper with error handling for private mode / quota exceeded.
 * All portfolio storage operations go through here to avoid try/catch duplication.
 */

/** Get item from localStorage; returns null on any error or if not found. */
export function storageGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/** Set item in localStorage; returns true on success, false on error. */
export function storageSet(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

/** Remove item from localStorage; returns true on success, false on error. */
export function storageRemove(key: string): boolean {
  try {
    localStorage.removeItem(key)
    return true
  } catch {
    return false
  }
}

/** Get and parse JSON from localStorage; returns fallback on error or if not found. */
export function storageGetJson<T>(key: string, fallback: T): T {
  const raw = storageGet(key)
  if (raw === null) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

/** Stringify and store JSON in localStorage; returns true on success. */
export function storageSetJson<T>(key: string, value: T): boolean {
  try {
    return storageSet(key, JSON.stringify(value))
  } catch {
    return false
  }
}

/** Get numeric value from localStorage with bounds checking. */
export function storageGetNumber(key: string, fallback: number, min?: number, max?: number): number {
  const raw = storageGet(key)
  if (raw === null) return fallback
  const parsed = parseFloat(raw)
  if (!Number.isFinite(parsed)) return fallback
  let result = parsed
  if (min !== undefined) result = Math.max(min, result)
  if (max !== undefined) result = Math.min(max, result)
  return result
}

/** Store boolean as '1'/'0' in localStorage. */
export function storageGetBool(key: string, fallback: boolean): boolean {
  const raw = storageGet(key)
  if (raw === null) return fallback
  return raw !== '0' && raw !== 'false'
}

/** Retrieve boolean from localStorage. */
export function storageSetBool(key: string, value: boolean): boolean {
  return storageSet(key, value ? '1' : '0')
}
