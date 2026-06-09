// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PaintWindow } from './paint-window'

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
