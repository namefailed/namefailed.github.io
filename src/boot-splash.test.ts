import { describe, it, expect, beforeAll } from 'vitest'
import { buildBootLines, BOOT_LINES } from './boot-splash'

// Minimal document mock for Node/Vitest (no jsdom dependency)
beforeAll(() => {
  if (typeof document === 'undefined') {
    const makeEl = (): Record<string, unknown> => ({
      className: '',
      textContent: '',
      innerHTML: '',
      classList: { add: () => {} },
      appendChild: () => {},
    })
    ;(globalThis as unknown as { document: unknown }).document = {
      createElement: (_tag: string) => makeEl(),
      body: { appendChild: () => {} },
    }
  }
})

describe('boot-splash lines', () => {
  it('exports the full dmesg list', () => {
    expect(BOOT_LINES.length).toBeGreaterThanOrEqual(20)
  })

  it('first line is kernel banner', () => {
    expect(BOOT_LINES[0].kind).toBe('info')
    expect(BOOT_LINES[0].text).toMatch(/kernel/)
  })

  it('last line is handoff', () => {
    expect(BOOT_LINES[BOOT_LINES.length - 1].text).toMatch(/handing off/)
  })

  it('buildBootLines returns one DOM-row per line plus section dividers', () => {
    const rows = buildBootLines()
    const sections = new Set(BOOT_LINES.map(l => l.section).filter(Boolean))
    expect(rows.length).toBe(BOOT_LINES.length + sections.size)
  })
})
