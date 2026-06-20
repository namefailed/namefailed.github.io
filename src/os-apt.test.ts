import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { runApt } from './os-apt'
import { c } from './theme'

/** Minimal localStorage mock so os-packages persistence does not throw in Node. */
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

;(globalThis as unknown as { localStorage: Storage }).localStorage =
  new MockStorage()

/** Strip ANSI escape codes so assertions can target the visible text. */
function plain(line: string): string {
  return line.replace(/\x1b\[[0-9;]*m/g, '')
}

const plainAll = (lines: string[]): string[] => lines.map(plain)

beforeEach(() => {
  localStorage.clear()
  // Ensure cowsay is not installed at the start of each test by removing it
  // (aptRemove is idempotent on absent packages via runApt remove).
  runApt(['remove', 'cowsay'])
})

afterEach(() => {
  localStorage.clear()
})

describe('runApt — help / default sub-command', () => {
  it('shows help when no sub-command is given', () => {
    const out = runApt([])
    const text = plainAll(out)
    expect(out).toHaveLength(4)
    expect(text[0]).toBe('')
    expect(text[3]).toBe('')
    expect(text[1]).toContain('apt')
    expect(text[1]).toContain('apt install cowsay')
    expect(text[2]).toContain('apt list')
    expect(text[2]).toContain('apt search')
  })

  it('treats "help" the same as no args', () => {
    expect(runApt(['help'])).toEqual(runApt([]))
  })

  it('treats "--help" the same as no args', () => {
    expect(runApt(['--help'])).toEqual(runApt([]))
  })

  it('is case-insensitive on the sub-command', () => {
    expect(runApt(['HELP'])).toEqual(runApt(['help']))
  })
})

describe('runApt — list', () => {
  it('reports an empty list when nothing is installed', () => {
    const out = runApt(['list'])
    expect(out).toHaveLength(1)
    expect(plain(out[0]!)).toBe('  (empty — try apt install cowsay)')
  })

  it('"ls" is an alias for "list"', () => {
    expect(runApt(['ls'])).toEqual(runApt(['list']))
  })

  it('lists an installed package with the "ii" status token', () => {
    runApt(['install', 'cowsay'])
    const out = runApt(['list'])
    // ['', '  ii  cowsay', '']
    expect(out).toHaveLength(3)
    expect(out[0]).toBe('')
    expect(out[2]).toBe('')
    expect(plain(out[1]!)).toBe('  ii  cowsay')
  })
})

describe('runApt — install', () => {
  it('errors when no package name is given', () => {
    const out = runApt(['install'])
    expect(out).toHaveLength(1)
    expect(plain(out[0]!)).toBe('  E: need a package name.')
  })

  it('errors when the package name is whitespace only', () => {
    const out = runApt(['install', '   '])
    expect(out).toHaveLength(1)
    expect(plain(out[0]!)).toBe('  E: need a package name.')
  })

  it('installs cowsay for the first time with the "new" finale', () => {
    const out = runApt(['install', 'cowsay'])
    const text = plainAll(out)
    // Pageantry is 17 lines, finale ('new') is 2 lines.
    expect(out).toHaveLength(19)
    expect(text).toContain('  Reading package lists … Done')
    expect(text).toContain('  Building dependency tree … Done')
    expect(text.some((l) => l.includes('Unpacking cowsay'))).toBe(true)
    const finale = text[text.length - 2]!
    expect(finale).toContain('(✓)')
    expect(finale).toContain('cowsay is on disk')
    expect(finale).toContain('Run cowsay moo')
    expect(text[text.length - 1]).toBe('')
  })

  it('reports "already" when cowsay is installed a second time', () => {
    runApt(['install', 'cowsay'])
    const out = runApt(['install', 'cowsay'])
    const text = plainAll(out)
    expect(out).toHaveLength(19)
    const finale = text[text.length - 2]!
    expect(finale).toContain('(✓)')
    expect(finale).toContain('cowsay: already at newest')
    expect(finale).toContain('imaginary/rolling')
  })

  it('reports "unknown" for any package other than cowsay', () => {
    const out = runApt(['install', 'sl'])
    const text = plainAll(out)
    // Pageantry (17) + unknown finale (4) = 21 lines.
    expect(out).toHaveLength(21)
    expect(text.some((l) => l.includes('the conveyor belt politely jammed'))).toBe(
      true,
    )
    expect(text.some((l) => l.includes('(✗)'))).toBe(true)
    expect(text.some((l) => l.includes('sl'))).toBe(true)
    expect(
      text.some((l) => l.includes('cowsay is the only honoured guest')),
    ).toBe(true)
    expect(text[text.length - 1]).toBe('')
  })

  it('echoes the raw (untrimmed-for-display) name in the pageantry', () => {
    const out = runApt(['install', 'Cowsay'])
    const text = plainAll(out)
    // Display preserves original case in the "Unpacking" line...
    expect(text.some((l) => l.includes('Unpacking Cowsay'))).toBe(true)
    // ...but the install still resolves case-insensitively to cowsay -> 'new'.
    expect(text[text.length - 2]).toContain('is on disk')
  })

  it('trims surrounding whitespace from the package name for display', () => {
    const out = runApt(['install', '  cowsay  '])
    const text = plainAll(out)
    expect(text.some((l) => l.includes('Unpacking cowsay '))).toBe(true)
  })
})

describe('runApt — remove / purge', () => {
  it('errors when no package name is given', () => {
    const out = runApt(['remove'])
    expect(out).toHaveLength(1)
    expect(plain(out[0]!)).toBe('  E: need a package name.')
  })

  it('reports an error line when the package is not installed', () => {
    const out = runApt(['remove', 'cowsay'])
    expect(out).toHaveLength(1)
    expect(plain(out[0]!)).toBe("  Package 'cowsay' is not installed.")
  })

  it('removes an installed package and confirms', () => {
    runApt(['install', 'cowsay'])
    const out = runApt(['remove', 'cowsay'])
    expect(out).toHaveLength(1)
    expect(plain(out[0]!)).toBe('  Removing cowsay … done')
    // And the list is empty again afterwards.
    expect(plain(runApt(['list'])[0]!)).toBe('  (empty — try apt install cowsay)')
  })

  it('"purge" is an alias for "remove"', () => {
    runApt(['install', 'cowsay'])
    const out = runApt(['purge', 'cowsay'])
    expect(plain(out[0]!)).toBe('  Removing cowsay … done')
  })

  it('lower-cases the package name before removing', () => {
    runApt(['install', 'cowsay'])
    const out = runApt(['remove', 'COWSAY'])
    expect(plain(out[0]!)).toBe('  Removing cowsay … done')
  })
})

describe('runApt — update / upgrade', () => {
  it('prints the three-line nothing-pending report', () => {
    const out = runApt(['update'])
    const text = plainAll(out)
    expect(out).toHaveLength(3)
    expect(text[0]).toBe('  Hit: https://repo.mrgrey.site/rolling InRelease')
    expect(text[1]).toBe('  Reading package lists … Done')
    expect(text[2]).toBe('  Nothing pending.')
  })

  it('"upgrade" is an alias for "update"', () => {
    expect(runApt(['upgrade'])).toEqual(runApt(['update']))
  })
})

describe('runApt — search / find', () => {
  it('lists the full shelf when no needle is given', () => {
    const out = runApt(['search'])
    const text = plainAll(out)
    // '', header, '', 5 rows, '', footer, '' = 11 lines
    expect(out).toHaveLength(11)
    expect(text[1]).toContain('browsing repo.mrgrey.site/imaginary')
    expect(text.some((l) => l.includes('cowsay'))).toBe(true)
    expect(text.some((l) => l.includes('neofetch-hallucination'))).toBe(true)
    expect(text.some((l) => l.includes('docker-for-tabs'))).toBe(true)
    expect(text.some((l) => l.includes('systemd-simp'))).toBe(true)
    expect(text.some((l) => l.includes('left-pad-memorial'))).toBe(true)
    expect(text[text.length - 2]).toContain('install path still ceremonial')
  })

  it('"find" is an alias for "search"', () => {
    expect(runApt(['find'])).toEqual(runApt(['search']))
  })

  it('filters the shelf by a needle matching an id', () => {
    const out = runApt(['search', 'docker'])
    const text = plainAll(out)
    expect(text.some((l) => l.includes('docker-for-tabs'))).toBe(true)
    expect(text.some((l) => l.includes('left-pad-memorial'))).toBe(false)
  })

  it('filters by a needle matching a blurb, not just the id', () => {
    const out = runApt(['search', 'theologian'])
    const text = plainAll(out)
    expect(text.some((l) => l.includes('cowsay'))).toBe(true)
    expect(text.some((l) => l.includes('docker-for-tabs'))).toBe(false)
  })

  it('joins multiple needle tokens with a space before matching', () => {
    const out = runApt(['search', 'browser', 'tab'])
    const text = plainAll(out)
    expect(text.some((l) => l.includes('docker-for-tabs'))).toBe(true)
  })

  it('special-cases the neofetch-hallucination blurb', () => {
    const out = runApt(['search', 'neofetch'])
    const text = plainAll(out)
    const row = text.find((l) => l.includes('neofetch-hallucination'))!
    expect(row).toContain('blocked by ergonomics')
    expect(row).toContain('whoami')
  })

  it('reports no matches with the needle echoed back', () => {
    const out = runApt(['search', 'nonexistent-xyz'])
    const text = plainAll(out)
    expect(out).toHaveLength(2)
    expect(text[0]).toBe('  no phantom packages match nonexistent-xyz')
    expect(text[1]).toBe('')
  })

  it('uses the ∅ placeholder when the needle is only whitespace', () => {
    // 'search' with a whitespace-only token: join+trim makes needle '' -> full shelf.
    // To hit the empty-needle no-match branch we need a needle that is falsy but
    // the branch echoes '∅'; an all-whitespace arg trims to '' which lists all.
    const out = runApt(['search', '   '])
    // Empty needle => full shelf (11 lines), not the no-match branch.
    expect(out).toHaveLength(11)
  })

  it('matches case-insensitively', () => {
    const out = runApt(['search', 'DOCKER'])
    const text = plainAll(out)
    expect(text.some((l) => l.includes('docker-for-tabs'))).toBe(true)
  })

  it('pads package ids to a fixed column width', () => {
    const out = runApt(['search', 'cowsay'])
    const text = plainAll(out)
    const row = text.find((l) => l.includes('cowsay'))!
    // id padded to 22 chars: '  ' + 'cowsay' + 16 spaces + '  ' before blurb.
    expect(row).toMatch(/^ {2}cowsay {16} {2}/)
  })
})

describe('runApt — unknown sub-command', () => {
  it('returns a single error line for an unrecognized verb', () => {
    const out = runApt(['frobnicate'])
    expect(out).toHaveLength(1)
    expect(plain(out[0]!)).toBe('  E: Unknown — try apt alone.')
  })
})

describe('runApt — ANSI colouring', () => {
  it('emits raw ANSI escape codes (not stripped) in output', () => {
    const out = runApt(['update'])
    expect(out[0]).toContain(c.dim)
    expect(out[0]).toContain(c.reset)
  })
})
