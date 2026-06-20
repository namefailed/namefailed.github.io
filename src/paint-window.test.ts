// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PaintWindow, floodFillPixels } from './paint-window'

function chromeOpts() {
  return {
    onClose: vi.fn(),
    onMinimize: vi.fn(),
    onMaximize: vi.fn(),
    onFocus: vi.fn(),
  }
}

describe('PaintWindow', () => {
  const origGetContext = HTMLCanvasElement.prototype.getContext
  const origGetComputedStyle = globalThis.getComputedStyle

  beforeEach(() => {
    document.body.replaceChildren()
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      fillRect: vi.fn(),
      clearRect: vi.fn(),
      getImageData: vi.fn(),
      putImageData: vi.fn(),
      drawImage: vi.fn(),
      fill: vi.fn(),
      setTransform: vi.fn(),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      lineCap: 'round',
      lineJoin: 'round',
      globalCompositeOperation: 'source-over',
    })) as unknown as typeof HTMLCanvasElement.prototype.getContext

    globalThis.getComputedStyle = vi.fn(() => ({
      getPropertyValue: (name: string) => (name === '--paint-bg' ? '#1e1e2e' : ''),
    })) as unknown as typeof getComputedStyle
  })

  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = origGetContext
    globalThis.getComputedStyle = origGetComputedStyle
  })

  it('mounts paint canvas and toolbar controls', () => {
    const win = new PaintWindow(chromeOpts())
    document.body.appendChild(win.el)

    expect(win.el.classList.contains('paint-app')).toBe(true)
    expect(win.el.querySelector('canvas.paint-canvas')).not.toBeNull()
    const undoBtn = [...win.el.querySelectorAll('.paint-btn')].find(
      (el) => el.textContent === 'Undo',
    ) as HTMLButtonElement | undefined
    expect(undoBtn).toBeDefined()
    expect(undoBtn!.disabled).toBe(true)
  })

  it('disconnects ResizeObserver on dispose', () => {
    const disconnect = vi.fn()
    const observe = vi.fn()
    globalThis.ResizeObserver = class {
      observe = observe
      unobserve = vi.fn()
      disconnect = disconnect
    } as unknown as typeof ResizeObserver

    const win = new PaintWindow(chromeOpts())
    win.dispose()
    expect(disconnect).toHaveBeenCalled()
  })

  it('toggles active class via setActive', () => {
    const win = new PaintWindow(chromeOpts())
    win.setActive(true)
    expect(win.el.classList.contains('active')).toBe(true)
  })
})

/** A w×h RGBA buffer painted one solid colour. */
function solid(w: number, h: number, r: number, g: number, b: number, a = 255): Uint8ClampedArray {
  const d = new Uint8ClampedArray(w * h * 4)
  for (let i = 0; i < d.length; i += 4) {
    d[i] = r
    d[i + 1] = g
    d[i + 2] = b
    d[i + 3] = a
  }
  return d
}

describe('floodFillPixels', () => {
  it('fills a connected region of the seed colour', () => {
    const d = solid(2, 2, 0, 0, 0)
    floodFillPixels(d, 2, 2, 0, 0, 255, 0, 0)
    for (let i = 0; i < d.length; i += 4) {
      expect([d[i], d[i + 1], d[i + 2], d[i + 3]]).toEqual([255, 0, 0, 255])
    }
  })

  it('stops at a different-coloured border', () => {
    const d = solid(3, 1, 0, 0, 0)
    d[4] = 255 // middle pixel is a white wall
    d[5] = 255
    d[6] = 255
    floodFillPixels(d, 3, 1, 0, 0, 255, 0, 0)
    expect([d[0], d[1], d[2]]).toEqual([255, 0, 0]) // left filled
    expect([d[4], d[5], d[6]]).toEqual([255, 255, 255]) // wall untouched
    expect([d[8], d[9], d[10]]).toEqual([0, 0, 0]) // right side unreachable past the wall
  })

  it('is a no-op when the seed already holds the fill colour', () => {
    const d = solid(2, 2, 255, 0, 0)
    const before = Uint8ClampedArray.from(d)
    floodFillPixels(d, 2, 2, 0, 0, 255, 0, 0)
    expect(d).toEqual(before)
  })
})
