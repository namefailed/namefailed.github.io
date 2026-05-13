import { describe, expect, it, beforeEach } from 'vitest'
import {
  storageGet,
  storageSet,
  storageRemove,
  storageGetJson,
  storageSetJson,
  storageGetNumber,
  storageGetBool,
  storageSetBool,
} from './storage'

const TEST_KEY = 'portfolio-test-storage'

/** Simple mock localStorage for test environment (Node/Vitest has no native localStorage). */
class MockStorage implements Storage {
  private data = new Map<string, string>()

  get length(): number {
    return this.data.size
  }

  getItem(key: string): string | null {
    return this.data.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value)
  }

  removeItem(key: string): void {
    this.data.delete(key)
  }

  clear(): void {
    this.data.clear()
  }

  key(index: number): string | null {
    return Array.from(this.data.keys())[index] ?? null
  }
}

// global localStorage mock for tests
;(globalThis as unknown as { localStorage: Storage }).localStorage = new MockStorage()

beforeEach(() => {
  localStorage.clear()
})

describe('storageGet / storageSet', () => {
  it('stores and retrieves a string', () => {
    expect(storageSet(TEST_KEY, 'hello')).toBe(true)
    expect(storageGet(TEST_KEY)).toBe('hello')
  })

  it('returns null for missing keys', () => {
    expect(storageGet('nonexistent-key-12345')).toBeNull()
  })

  it('returns empty string for explicitly stored empty value', () => {
    storageSet(TEST_KEY, '')
    expect(storageGet(TEST_KEY)).toBe('')
  })
})

describe('storageRemove', () => {
  it('removes an existing key', () => {
    storageSet(TEST_KEY, 'value')
    expect(storageRemove(TEST_KEY)).toBe(true)
    expect(storageGet(TEST_KEY)).toBeNull()
  })

  it('returns true when removing non-existent key', () => {
    expect(storageRemove('nonexistent-key-12345')).toBe(true)
  })
})

describe('storageGetJson / storageSetJson', () => {
  it('stores and retrieves objects', () => {
    const data = { foo: 'bar', num: 42, nested: { a: 1 } }
    expect(storageSetJson(TEST_KEY, data)).toBe(true)
    expect(storageGetJson(TEST_KEY, {})).toEqual(data)
  })

  it('returns fallback for missing keys', () => {
    const fallback = { default: true }
    expect(storageGetJson('nonexistent-key-12345', fallback)).toBe(fallback)
  })

  it('returns fallback for invalid JSON', () => {
    localStorage.setItem(TEST_KEY, 'not valid json')
    const fallback = { fallback: true }
    expect(storageGetJson(TEST_KEY, fallback)).toEqual(fallback)
  })
})

describe('storageGetNumber', () => {
  it('parses stored numbers', () => {
    storageSet(TEST_KEY, '3.14')
    expect(storageGetNumber(TEST_KEY, 0)).toBe(3.14)
  })

  it('returns fallback for missing key', () => {
    expect(storageGetNumber('nonexistent-key-12345', 42)).toBe(42)
  })

  it('returns fallback for invalid number', () => {
    storageSet(TEST_KEY, 'not a number')
    expect(storageGetNumber(TEST_KEY, 99)).toBe(99)
  })

  it('applies min bound', () => {
    storageSet(TEST_KEY, '-100')
    expect(storageGetNumber(TEST_KEY, 0, 0)).toBe(0)
  })

  it('applies max bound', () => {
    storageSet(TEST_KEY, '200')
    expect(storageGetNumber(TEST_KEY, 0, undefined, 100)).toBe(100)
  })

  it('applies both bounds', () => {
    storageSet(TEST_KEY, '500')
    expect(storageGetNumber(TEST_KEY, 50, 0, 100)).toBe(100)
    storageSet(TEST_KEY, '-500')
    expect(storageGetNumber(TEST_KEY, 50, 0, 100)).toBe(0)
  })
})

describe('storageGetBool / storageSetBool', () => {
  it('stores and retrieves true', () => {
    storageSetBool(TEST_KEY, true)
    expect(storageGetBool(TEST_KEY, false)).toBe(true)
  })

  it('stores and retrieves false', () => {
    storageSetBool(TEST_KEY, false)
    expect(storageGetBool(TEST_KEY, true)).toBe(false)
  })

  it('returns fallback for missing key', () => {
    expect(storageGetBool('nonexistent-key-12345', true)).toBe(true)
    expect(storageGetBool('nonexistent-key-12345', false)).toBe(false)
  })

  it('treats "false" string as false', () => {
    storageSet(TEST_KEY, 'false')
    expect(storageGetBool(TEST_KEY, true)).toBe(false)
  })

  it('treats "0" string as false', () => {
    storageSet(TEST_KEY, '0')
    expect(storageGetBool(TEST_KEY, true)).toBe(false)
  })

  it('treats any other value as true', () => {
    storageSet(TEST_KEY, 'anything')
    expect(storageGetBool(TEST_KEY, false)).toBe(true)
  })
})
