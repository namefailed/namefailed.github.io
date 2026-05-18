import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import {
  applyWallpaper,
  setWallpaper,
  clearWallpaper,
  loadSavedWallpaper,
  WALLPAPER_KEY,
  WALLPAPER_DEFAULT,
} from './wallpaper'

class MockStorage implements Storage {
  private data = new Map<string, string>()
  get length() { return this.data.size }
  getItem(key: string) { return this.data.get(key) ?? null }
  setItem(key: string, value: string) { this.data.set(key, value) }
  removeItem(key: string) { this.data.delete(key) }
  clear() { this.data.clear() }
  key(index: number) { return [...this.data.keys()][index] ?? null }
}
;(globalThis as unknown as { localStorage: Storage }).localStorage = new MockStorage()

const mockEl = { style: {} as Record<string, string> }
const dispatchedEvents: Array<CustomEvent<string | null>> = []

beforeAll(() => {
  ;(globalThis as unknown as { document: unknown }).document = {
    getElementById: (id: string) => id === 'desktop' ? mockEl : null,
  }
  ;(globalThis as unknown as { window: unknown }).window = {
    localStorage,
    dispatchEvent: (e: CustomEvent<string | null>) => { dispatchedEvents.push(e) },
  }
})

beforeEach(() => {
  localStorage.clear()
  mockEl.style = {}
  dispatchedEvents.length = 0
})

describe('WALLPAPER_KEY', () => {
  it('uses the mrgrey-wallpaper namespace', () => {
    expect(WALLPAPER_KEY).toBe('mrgrey-wallpaper')
  })

  it('WALLPAPER_DEFAULT is the jpg path', () => {
    expect(WALLPAPER_DEFAULT).toBe('/wallpaper.jpg')
  })
})

describe('applyWallpaper', () => {
  it('wraps absolute path in url()', () => {
    applyWallpaper('/wallpaper.jpg')
    expect(mockEl.style.backgroundImage).toBe('url("/wallpaper.jpg")')
  })

  it('wraps http URL in url()', () => {
    applyWallpaper('https://example.com/bg.png')
    expect(mockEl.style.backgroundImage).toBe('url("https://example.com/bg.png")')
  })

  it('wraps data: URI in url()', () => {
    applyWallpaper('data:image/png;base64,abc')
    expect(mockEl.style.backgroundImage).toBe('url("data:image/png;base64,abc")')
  })

  it('uses CSS gradient string directly (no url wrap)', () => {
    const gradient = 'radial-gradient(ellipse at 50% 55%, #1e1e2e 0%, #181825 60%)'
    applyWallpaper(gradient)
    expect(mockEl.style.backgroundImage).toBe(gradient)
  })

  it('sets background-size to cover', () => {
    applyWallpaper('/wallpaper.jpg')
    expect(mockEl.style.backgroundSize).toBe('cover')
  })

  it('is a no-op when #desktop element is missing', () => {
    ;(globalThis as unknown as { document: unknown }).document = {
      getElementById: () => null,
    }
    expect(() => applyWallpaper('/wallpaper.jpg')).not.toThrow()
    // Restore
    ;(globalThis as unknown as { document: unknown }).document = {
      getElementById: (id: string) => id === 'desktop' ? mockEl : null,
    }
  })
})

describe('setWallpaper', () => {
  it('persists the trimmed value to storage', () => {
    setWallpaper('  /wallpaper.jpg  ')
    expect(localStorage.getItem(WALLPAPER_KEY)).toBe('/wallpaper.jpg')
  })

  it('dispatches mrgrey-wallpaper-change with the trimmed url as detail', () => {
    setWallpaper('/wallpaper.jpg')
    expect(dispatchedEvents.length).toBe(1)
    expect(dispatchedEvents[0]!.type).toBe('mrgrey-wallpaper-change')
    expect(dispatchedEvents[0]!.detail).toBe('/wallpaper.jpg')
  })

  it('applies the wallpaper to #desktop', () => {
    setWallpaper('/wallpaper.jpg')
    expect(mockEl.style.backgroundImage).toBe('url("/wallpaper.jpg")')
  })
})

describe('clearWallpaper', () => {
  it('removes the key from storage', () => {
    localStorage.setItem(WALLPAPER_KEY, '/wallpaper.jpg')
    clearWallpaper()
    expect(localStorage.getItem(WALLPAPER_KEY)).toBeNull()
  })

  it('clears backgroundImage on #desktop', () => {
    mockEl.style.backgroundImage = 'url("/wallpaper.jpg")'
    clearWallpaper()
    expect(mockEl.style.backgroundImage).toBe('')
  })

  it('dispatches mrgrey-wallpaper-change with null detail', () => {
    clearWallpaper()
    expect(dispatchedEvents.length).toBe(1)
    expect(dispatchedEvents[0]!.type).toBe('mrgrey-wallpaper-change')
    expect(dispatchedEvents[0]!.detail).toBeNull()
  })
})

describe('loadSavedWallpaper', () => {
  it('applies the saved wallpaper when one is stored', () => {
    localStorage.setItem(WALLPAPER_KEY, '/wallpaper.jpg')
    loadSavedWallpaper()
    expect(mockEl.style.backgroundImage).toBe('url("/wallpaper.jpg")')
  })

  it('does nothing when no wallpaper is stored', () => {
    loadSavedWallpaper()
    expect(mockEl.style.backgroundImage).toBeUndefined()
  })
})
