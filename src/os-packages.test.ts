import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'

const STORAGE_KEY = 'mrgrey-pkgs-v1'

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

;(globalThis as unknown as { localStorage: Storage }).localStorage = new MockStorage()

type OsPackages = typeof import('./os-packages')

/**
 * The module reads localStorage at import time and keeps an in-memory `installed`
 * set at module scope. To isolate tests we seed localStorage first, then re-import
 * the module fresh via vi.resetModules() so `load()` runs against the seeded state.
 */
async function freshImport(): Promise<OsPackages> {
  vi.resetModules()
  return import('./os-packages')
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  localStorage.clear()
})

describe('load() at import time', () => {
  it('starts with no installed packages when storage is empty', async () => {
    const pkgs = await freshImport()
    expect(pkgs.listInstalledPackages()).toEqual([])
  })

  it('restores a previously persisted installed package', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(['cowsay']))
    const pkgs = await freshImport()
    expect(pkgs.listInstalledPackages()).toEqual(['cowsay'])
  })

  it('treats a non-array stored value as empty', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ cowsay: true }))
    const pkgs = await freshImport()
    expect(pkgs.listInstalledPackages()).toEqual([])
  })

  it('treats stored null as empty', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(null))
    const pkgs = await freshImport()
    expect(pkgs.listInstalledPackages()).toEqual([])
  })

  it('filters out non-string entries from a stored array', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(['cowsay', 42, null, { x: 1 }, 'foo']))
    const pkgs = await freshImport()
    expect(pkgs.listInstalledPackages()).toEqual(['cowsay', 'foo'])
  })

  it('treats malformed JSON as empty (storageGetJson fallback)', async () => {
    localStorage.setItem(STORAGE_KEY, '{not valid json')
    const pkgs = await freshImport()
    expect(pkgs.listInstalledPackages()).toEqual([])
  })
})

describe('listInstalledPackages', () => {
  it('returns a sorted copy of installed packages', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(['zlib', 'cowsay', 'apt']))
    const pkgs = await freshImport()
    expect(pkgs.listInstalledPackages()).toEqual(['apt', 'cowsay', 'zlib'])
  })

  it('returns a fresh array each call (not the internal set view)', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(['cowsay']))
    const pkgs = await freshImport()
    const a = pkgs.listInstalledPackages()
    const b = pkgs.listInstalledPackages()
    expect(a).not.toBe(b)
    a.push('mutated')
    expect(pkgs.listInstalledPackages()).toEqual(['cowsay'])
  })
})

describe('attemptAptInstall', () => {
  it('installs cowsay on first attempt and returns "new"', async () => {
    const pkgs = await freshImport()
    expect(pkgs.attemptAptInstall('cowsay')).toBe('new')
    expect(pkgs.listInstalledPackages()).toEqual(['cowsay'])
  })

  it('persists the install to localStorage', async () => {
    const pkgs = await freshImport()
    pkgs.attemptAptInstall('cowsay')
    expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify(['cowsay']))
  })

  it('returns "already" when cowsay is installed again', async () => {
    const pkgs = await freshImport()
    expect(pkgs.attemptAptInstall('cowsay')).toBe('new')
    expect(pkgs.attemptAptInstall('cowsay')).toBe('already')
    expect(pkgs.listInstalledPackages()).toEqual(['cowsay'])
  })

  it('returns "unknown" for an unrecognized package and installs nothing', async () => {
    const pkgs = await freshImport()
    expect(pkgs.attemptAptInstall('vim')).toBe('unknown')
    expect(pkgs.listInstalledPackages()).toEqual([])
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('trims and lowercases the name before matching', async () => {
    const pkgs = await freshImport()
    expect(pkgs.attemptAptInstall('  COWSAY  ')).toBe('new')
    expect(pkgs.listInstalledPackages()).toEqual(['cowsay'])
  })

  it('treats a differently-cased repeat as "already"', async () => {
    const pkgs = await freshImport()
    expect(pkgs.attemptAptInstall('cowsay')).toBe('new')
    expect(pkgs.attemptAptInstall('CowSay')).toBe('already')
  })
})

describe('aptRemove', () => {
  it('removes an installed package and returns null', async () => {
    const pkgs = await freshImport()
    pkgs.attemptAptInstall('cowsay')
    expect(pkgs.aptRemove('cowsay')).toBeNull()
    expect(pkgs.listInstalledPackages()).toEqual([])
  })

  it('persists the removal to localStorage', async () => {
    const pkgs = await freshImport()
    pkgs.attemptAptInstall('cowsay')
    pkgs.aptRemove('cowsay')
    expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify([]))
  })

  it('returns an error message for a package that is not installed', async () => {
    const pkgs = await freshImport()
    expect(pkgs.aptRemove('cowsay')).toBe("Package 'cowsay' is not installed.")
  })

  it('uses the normalized (trimmed/lowercased) name in the error message', async () => {
    const pkgs = await freshImport()
    expect(pkgs.aptRemove('  VIM  ')).toBe("Package 'vim' is not installed.")
  })

  it('matches installed packages case-insensitively', async () => {
    const pkgs = await freshImport()
    pkgs.attemptAptInstall('cowsay')
    expect(pkgs.aptRemove('  COWSAY ')).toBeNull()
    expect(pkgs.listInstalledPackages()).toEqual([])
  })
})

describe('cowsayFormat', () => {
  it('renders the message inside the speech bubble', async () => {
    const pkgs = await freshImport()
    const lines = pkgs.cowsayFormat('hello')
    expect(lines[1]).toBe('< hello >')
  })

  it('produces a complete bubble with the cow art', async () => {
    const pkgs = await freshImport()
    expect(pkgs.cowsayFormat('hello')).toEqual([
      ' _______',
      '< hello >',
      ' -------',
      '        \\   ^__^',
      '         \\  (oo)\\_______',
      '            (__)\\       )\\/\\',
      '                ||----w |',
      '                ||     ||',
    ])
  })

  it('borders are two chars wider than the padded text', async () => {
    const pkgs = await freshImport()
    const lines = pkgs.cowsayFormat('hello')
    // len = max(5,3)=5 capped at 40 -> border length 7
    expect(lines[0]).toBe(' _______')
    expect(lines[2]).toBe(' -------')
    expect(lines[0].length).toBe(lines[2].length)
  })

  it('falls back to "moo" for an empty message', async () => {
    const pkgs = await freshImport()
    const lines = pkgs.cowsayFormat('')
    expect(lines[1]).toBe('< moo >')
  })

  it('falls back to "moo" for a whitespace-only message', async () => {
    const pkgs = await freshImport()
    expect(pkgs.cowsayFormat('   ')[1]).toBe('< moo >')
  })

  it('trims surrounding whitespace from the message', async () => {
    const pkgs = await freshImport()
    expect(pkgs.cowsayFormat('  hi there  ')[1]).toBe('< hi there >')
  })

  it('pads a short message to the minimum width of 3', async () => {
    const pkgs = await freshImport()
    const lines = pkgs.cowsayFormat('x')
    // len clamped up to 3: text 'x' padded to 'x  '
    expect(lines[1]).toBe('< x   >')
    expect(lines[0]).toBe(' _____')
  })

  it('does not pad a message exactly at the minimum width', async () => {
    const pkgs = await freshImport()
    expect(pkgs.cowsayFormat('abc')[1]).toBe('< abc >')
  })

  it('caps the bubble width at 40 for long messages', async () => {
    const pkgs = await freshImport()
    const long = 'a'.repeat(100)
    const lines = pkgs.cowsayFormat(long)
    // len capped at 40 -> border = 42 underscores
    expect(lines[0]).toBe(' ' + '_'.repeat(42))
    expect(lines[2]).toBe(' ' + '-'.repeat(42))
    // text is NOT truncated, only padEnd target is capped; long text overflows
    expect(lines[1]).toBe(`< ${long} >`)
  })
})
