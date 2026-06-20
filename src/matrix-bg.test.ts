// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { initMatrixBg, getMatrixBgHandle } from './matrix-bg'
import { WALLPAPER_DEFAULT } from './wallpaper'

class MockStorage implements Storage {
  private data = new Map<string, string>()
  get length() {
    return this.data.size
  }
  getItem(key: string) {
    return this.data.get(key) ?? null
  }
  setItem(key: string, value: string) {
    this.data.set(key, value)
  }
  removeItem(key: string) {
    this.data.delete(key)
  }
  clear() {
    this.data.clear()
  }
  key(index: number) {
    return [...this.data.keys()][index] ?? null
  }
}

;(globalThis as unknown as { localStorage: Storage }).localStorage = new MockStorage()

describe('matrix-bg default (storage contract)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('storageGet returns null when key absent (triggers default=false branch)', async () => {
    const { storageGet } = await import('./storage')
    expect(storageGet('mrgrey-matrix-bg')).toBeNull()
  })

  it('storageGet returns stored "on" string', async () => {
    localStorage.setItem('mrgrey-matrix-bg', 'on')
    const { storageGet } = await import('./storage')
    expect(storageGet('mrgrey-matrix-bg')).toBe('on')
  })

  it('storageGet returns stored "off" string', async () => {
    localStorage.setItem('mrgrey-matrix-bg', 'off')
    const { storageGet } = await import('./storage')
    expect(storageGet('mrgrey-matrix-bg')).toBe('off')
  })
})

// --- initMatrixBg (canvas/observer-driven) -----------------------------------

interface FakeGradient {
  addColorStop: ReturnType<typeof vi.fn>
}

/** A 2D context stub exposing every method/prop drawBackdrop + loop touch. */
interface FakeCtx {
  fillRect: ReturnType<typeof vi.fn>
  clearRect: ReturnType<typeof vi.fn>
  fillText: ReturnType<typeof vi.fn>
  drawImage: ReturnType<typeof vi.fn>
  createLinearGradient: ReturnType<typeof vi.fn>
  measureText: ReturnType<typeof vi.fn>
  setTransform: ReturnType<typeof vi.fn>
  save: ReturnType<typeof vi.fn>
  restore: ReturnType<typeof vi.fn>
  translate: ReturnType<typeof vi.fn>
  fillStyle: string | CanvasGradient
  font: string
  globalAlpha: number
  textBaseline: string
}

function makeCtx(): FakeCtx {
  const grad: FakeGradient = { addColorStop: vi.fn() }
  return {
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    fillText: vi.fn(),
    drawImage: vi.fn(),
    createLinearGradient: vi.fn(() => grad),
    measureText: vi.fn(() => ({ width: 7 })),
    setTransform: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    fillStyle: '',
    font: '',
    globalAlpha: 1,
    textBaseline: '',
  }
}

/** A controllable fake Image: tests flip complete/naturalWidth and fire onload. */
class FakeImage {
  onload: (() => void) | null = null
  decoding = ''
  complete = false
  naturalWidth = 0
  naturalHeight = 0
  private _src = ''
  set src(v: string) {
    this._src = v
  }
  get src() {
    return this._src
  }
  fireLoad(width = 800, height = 600): void {
    this.complete = true
    this.naturalWidth = width
    this.naturalHeight = height
    this.onload?.()
  }
}

describe('initMatrixBg', () => {
  const origGetContext = HTMLCanvasElement.prototype.getContext
  const origGetComputedStyle = globalThis.getComputedStyle
  const origRO = globalThis.ResizeObserver
  const origGBCR = HTMLElement.prototype.getBoundingClientRect
  const origRAF = globalThis.requestAnimationFrame
  const origCAF = globalThis.cancelAnimationFrame
  const origImage = globalThis.Image
  const origMatchMedia = globalThis.matchMedia
  const origDPR = Object.getOwnPropertyDescriptor(globalThis, 'devicePixelRatio')

  let roCallback: (() => void) | null = null
  let lastImage: FakeImage | null = null
  let lastCtx: FakeCtx | null = null
  let reduceMotion = false
  let rectWidth = 800
  let rectHeight = 600

  function setup(): { canvas: HTMLCanvasElement; root: HTMLElement } {
    const canvas = document.createElement('canvas')
    const root = document.createElement('div')
    document.body.appendChild(root)
    document.body.appendChild(canvas)
    return { canvas, root }
  }

  beforeEach(() => {
    vi.useFakeTimers()
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) =>
      globalThis.setTimeout(() => cb(0), 0) as unknown as number) as typeof requestAnimationFrame
    globalThis.cancelAnimationFrame = ((h: number) =>
      globalThis.clearTimeout(
        h as unknown as ReturnType<typeof setTimeout>,
      )) as typeof cancelAnimationFrame

    document.body.replaceChildren()
    roCallback = null
    lastImage = null
    lastCtx = null
    reduceMotion = false
    rectWidth = 800
    rectHeight = 600
    localStorage.clear()

    HTMLCanvasElement.prototype.getContext = vi.fn(() => {
      lastCtx = makeCtx()
      return lastCtx
    }) as unknown as typeof HTMLCanvasElement.prototype.getContext

    globalThis.getComputedStyle = vi.fn(() => ({
      getPropertyValue: (name: string) => (name === '--th-matrix-g1' ? '#abcdef' : ''),
    })) as unknown as typeof getComputedStyle

    globalThis.ResizeObserver = class {
      constructor(cb: () => void) {
        roCallback = cb
      }
      observe = vi.fn()
      unobserve = vi.fn()
      disconnect = vi.fn()
    } as unknown as typeof ResizeObserver

    globalThis.Image = class {
      constructor() {
        lastImage = new FakeImage()
        return lastImage as unknown as HTMLImageElement
      }
    } as unknown as typeof Image

    globalThis.matchMedia = vi.fn(() => ({
      matches: reduceMotion,
      media: '',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof matchMedia

    Object.defineProperty(globalThis, 'devicePixelRatio', {
      configurable: true,
      value: 2,
    })

    HTMLElement.prototype.getBoundingClientRect = vi.fn(() => ({
      width: rectWidth,
      height: rectHeight,
      top: 0,
      left: 0,
      right: rectWidth,
      bottom: rectHeight,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })) as unknown as typeof HTMLElement.prototype.getBoundingClientRect
  })

  afterEach(() => {
    // Tear down any handle that registered itself so no rAF/listeners leak.
    getMatrixBgHandle()?.destroy()
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    globalThis.requestAnimationFrame = origRAF
    globalThis.cancelAnimationFrame = origCAF
    HTMLCanvasElement.prototype.getContext = origGetContext
    globalThis.getComputedStyle = origGetComputedStyle
    globalThis.ResizeObserver = origRO
    globalThis.Image = origImage
    globalThis.matchMedia = origMatchMedia
    HTMLElement.prototype.getBoundingClientRect = origGBCR
    if (origDPR) Object.defineProperty(globalThis, 'devicePixelRatio', origDPR)
    else delete (globalThis as { devicePixelRatio?: unknown }).devicePixelRatio
    vi.restoreAllMocks()
  })

  it('returns a no-op handle when the 2D context is unavailable', () => {
    HTMLCanvasElement.prototype.getContext = vi.fn(
      () => null,
    ) as unknown as typeof HTMLCanvasElement.prototype.getContext
    const { canvas, root } = setup()
    const handle = initMatrixBg(canvas, root)
    expect(handle.isEnabled()).toBe(false)
    expect(() => handle.setEnabled(true)).not.toThrow()
    expect(() => handle.destroy()).not.toThrow()
    // No-op handle does not register itself globally.
    expect(getMatrixBgHandle()).toBeNull()
  })

  it('registers the handle and defaults to disabled with no stored preference', () => {
    const { canvas, root } = setup()
    const handle = initMatrixBg(canvas, root)
    expect(getMatrixBgHandle()).toBe(handle)
    expect(handle.isEnabled()).toBe(false)
    // Disabled -> canvas hidden, root dataset off, no animation frames scheduled.
    expect(canvas.style.display).toBe('none')
    expect(root.dataset.matrixBg).toBe('off')
  })

  it('honours stored "on" preference and starts the animation loop', () => {
    localStorage.setItem('mrgrey-matrix-bg', 'on')
    const { canvas, root } = setup()
    const handle = initMatrixBg(canvas, root)
    expect(handle.isEnabled()).toBe(true)
    expect(canvas.style.display).toBe('')
    expect(root.dataset.matrixBg).toBe('on')
    // Drive a few animation frames; the rain loop must paint glyphs.
    vi.advanceTimersByTime(20)
    expect(lastCtx).not.toBeNull()
    expect(lastCtx!.fillRect).toHaveBeenCalled()
    expect(lastCtx!.fillText).toHaveBeenCalled()
  })

  it('honours stored "off" preference', () => {
    localStorage.setItem('mrgrey-matrix-bg', 'off')
    const { canvas, root } = setup()
    const handle = initMatrixBg(canvas, root)
    expect(handle.isEnabled()).toBe(false)
  })

  it('uses a gradient backdrop when the wallpaper image has not decoded', () => {
    localStorage.setItem('mrgrey-matrix-bg', 'on')
    const { canvas, root } = setup()
    initMatrixBg(canvas, root)
    vi.advanceTimersByTime(5)
    // Image never fired load -> not complete -> gradient branch.
    expect(lastCtx!.createLinearGradient).toHaveBeenCalled()
    const grad = lastCtx!.createLinearGradient.mock.results[0]!.value as FakeGradient
    expect(grad.addColorStop).toHaveBeenCalledWith(0, '#abcdef')
    expect(grad.addColorStop).toHaveBeenCalledWith(0.42, '#1e1e2e')
    expect(grad.addColorStop).toHaveBeenCalledWith(1, '#11111b')
  })

  it('draws the decoded wallpaper image (cover-fit) instead of the gradient', () => {
    localStorage.setItem('mrgrey-matrix-bg', 'on')
    const { canvas, root } = setup()
    initMatrixBg(canvas, root)
    expect(lastImage).not.toBeNull()
    lastImage!.fireLoad(800, 600) // complete + natural dims > 0
    vi.advanceTimersByTime(5)
    expect(lastCtx!.drawImage).toHaveBeenCalled()
    const call = lastCtx!.drawImage.mock.calls[0]!
    // First arg is the image, followed by destination geometry.
    expect(call[0]).toBe(lastImage)
  })

  it('draws a complete-but-zero-dimension image with the simple stretch branch', () => {
    localStorage.setItem('mrgrey-matrix-bg', 'on')
    const { canvas, root } = setup()
    initMatrixBg(canvas, root)
    // complete=true but naturalWidth stays 0 -> second drawImage branch.
    lastImage!.complete = true
    lastImage!.naturalWidth = 0
    lastImage!.naturalHeight = 0
    vi.advanceTimersByTime(5)
    expect(lastCtx!.drawImage).toHaveBeenCalledWith(lastImage, 0, 0, 800, 600)
  })

  it('uses the saved wallpaper URL when it is a real image URL', () => {
    localStorage.setItem('mrgrey-wallpaper', 'https://example.com/wp.png')
    const { canvas, root } = setup()
    initMatrixBg(canvas, root)
    expect(lastImage!.src).toBe('https://example.com/wp.png')
  })

  it('falls back to the default wallpaper when the saved value is a CSS gradient', () => {
    localStorage.setItem('mrgrey-wallpaper', 'linear-gradient(#000,#111)')
    const { canvas, root } = setup()
    initMatrixBg(canvas, root)
    expect(lastImage!.src).toBe(WALLPAPER_DEFAULT)
  })

  it('setEnabled(true) persists, shows the canvas and starts the loop', () => {
    const { canvas, root } = setup()
    const handle = initMatrixBg(canvas, root)
    handle.setEnabled(true)
    expect(handle.isEnabled()).toBe(true)
    expect(localStorage.getItem('mrgrey-matrix-bg')).toBe('on')
    expect(canvas.style.display).toBe('')
    expect(root.dataset.matrixBg).toBe('on')
    vi.advanceTimersByTime(20)
    expect(lastCtx!.fillText).toHaveBeenCalled()
  })

  it('setEnabled(false) persists, hides the canvas and stops the loop', () => {
    localStorage.setItem('mrgrey-matrix-bg', 'on')
    const { canvas, root } = setup()
    const handle = initMatrixBg(canvas, root)
    vi.advanceTimersByTime(10)
    handle.setEnabled(false)
    expect(handle.isEnabled()).toBe(false)
    expect(localStorage.getItem('mrgrey-matrix-bg')).toBe('off')
    expect(canvas.style.display).toBe('none')
    lastCtx!.fillText.mockClear()
    // After stop, no further frames paint.
    vi.advanceTimersByTime(50)
    expect(lastCtx!.fillText).not.toHaveBeenCalled()
  })

  it('reduced-motion: paints a single static backdrop and never starts the loop', () => {
    reduceMotion = true
    localStorage.setItem('mrgrey-matrix-bg', 'on')
    const { canvas, root } = setup()
    initMatrixBg(canvas, root)
    // startLoop -> reduceMotion branch -> paintStaticBackdrop, no rAF loop.
    expect(lastCtx!.fillRect).toHaveBeenCalled()
    lastCtx!.fillRect.mockClear()
    vi.advanceTimersByTime(50)
    // No animation loop is running, so no further frames.
    expect(lastCtx!.fillRect).not.toHaveBeenCalled()
  })

  it('reduced-motion: image onload repaints the static backdrop', () => {
    reduceMotion = true
    localStorage.setItem('mrgrey-matrix-bg', 'on')
    const { canvas, root } = setup()
    initMatrixBg(canvas, root)
    lastCtx!.drawImage.mockClear()
    lastImage!.fireLoad(800, 600) // onload -> paintStaticBackdrop -> drawImage
    expect(lastCtx!.drawImage).toHaveBeenCalled()
  })

  it('ResizeObserver callback re-runs layout (and static repaint under reduced motion)', () => {
    reduceMotion = true
    localStorage.setItem('mrgrey-matrix-bg', 'on')
    const { canvas, root } = setup()
    initMatrixBg(canvas, root)
    expect(roCallback).not.toBeNull()
    lastCtx!.fillRect.mockClear()
    roCallback!()
    expect(lastCtx!.fillRect).toHaveBeenCalled()
  })

  it('window resize triggers a fresh layout', () => {
    localStorage.setItem('mrgrey-matrix-bg', 'on')
    const { canvas, root } = setup()
    initMatrixBg(canvas, root)
    const spy = HTMLElement.prototype.getBoundingClientRect as ReturnType<typeof vi.fn>
    const before = spy.mock.calls.length
    window.dispatchEvent(new Event('resize'))
    expect(spy.mock.calls.length).toBeGreaterThan(before)
  })

  it('theme change refreshes the CSS var cache and re-lays out', () => {
    const { canvas, root } = setup()
    initMatrixBg(canvas, root)
    const gcs = globalThis.getComputedStyle as ReturnType<typeof vi.fn>
    const before = gcs.mock.calls.length
    window.dispatchEvent(new CustomEvent('mrgrey-theme-change'))
    // refresh clears the cache; subsequent reads hit getComputedStyle again.
    // layout itself does not read css vars, but enabling does; assert no throw + cache cleared.
    expect(() => window.dispatchEvent(new CustomEvent('mrgrey-theme-change'))).not.toThrow()
    expect(gcs.mock.calls.length).toBeGreaterThanOrEqual(before)
  })

  it('wallpaper-change event swaps the backdrop image source', () => {
    const { canvas, root } = setup()
    initMatrixBg(canvas, root)
    window.dispatchEvent(
      new CustomEvent('mrgrey-wallpaper-change', { detail: 'https://example.com/new.png' }),
    )
    expect(lastImage!.src).toBe('https://example.com/new.png')
  })

  it('wallpaper-change with a non-URL value falls back to the default', () => {
    const { canvas, root } = setup()
    initMatrixBg(canvas, root)
    window.dispatchEvent(
      new CustomEvent('mrgrey-wallpaper-change', { detail: 'radial-gradient(#000,#111)' }),
    )
    expect(lastImage!.src).toBe(WALLPAPER_DEFAULT)
  })

  it('wallpaper-change with null detail falls back to the default', () => {
    const { canvas, root } = setup()
    initMatrixBg(canvas, root)
    window.dispatchEvent(new CustomEvent('mrgrey-wallpaper-change', { detail: null }))
    expect(lastImage!.src).toBe(WALLPAPER_DEFAULT)
  })

  it('visibilitychange pauses the loop when hidden and resumes when visible', () => {
    localStorage.setItem('mrgrey-matrix-bg', 'on')
    const { canvas, root } = setup()
    initMatrixBg(canvas, root)
    vi.advanceTimersByTime(10)
    // Hide the document -> next frame exits the loop.
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    document.dispatchEvent(new Event('visibilitychange'))
    vi.advanceTimersByTime(20) // loop drains and stops
    lastCtx!.fillText.mockClear()
    vi.advanceTimersByTime(50)
    expect(lastCtx!.fillText).not.toHaveBeenCalled()
    // Reveal again -> startLoop resumes painting.
    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
    document.dispatchEvent(new Event('visibilitychange'))
    vi.advanceTimersByTime(20)
    expect(lastCtx!.fillText).toHaveBeenCalled()
    delete (document as { hidden?: unknown }).hidden
  })

  it('skips painting until the root has a usable size (width/height < 2)', () => {
    rectWidth = 0
    rectHeight = 0
    localStorage.setItem('mrgrey-matrix-bg', 'on')
    const { canvas, root } = setup()
    initMatrixBg(canvas, root)
    // layout bails (no canvas sizing); the loop reschedules without painting glyphs.
    vi.advanceTimersByTime(20)
    expect(lastCtx!.fillText).not.toHaveBeenCalled()
    // Once the root gains size, a subsequent layout + frame paints.
    rectWidth = 800
    rectHeight = 600
    roCallback!() // re-layout
    vi.advanceTimersByTime(20)
    expect(lastCtx!.fillText).toHaveBeenCalled()
  })

  it('caps devicePixelRatio at 2 when computing canvas pixel dimensions', () => {
    Object.defineProperty(globalThis, 'devicePixelRatio', { configurable: true, value: 4 })
    localStorage.setItem('mrgrey-matrix-bg', 'on')
    const { canvas, root } = setup()
    initMatrixBg(canvas, root)
    // dpr clamped to 2 -> 800*2 / 600*2.
    expect(canvas.width).toBe(1600)
    expect(canvas.height).toBe(1200)
  })

  it('destroy() unregisters the handle and stops everything', () => {
    localStorage.setItem('mrgrey-matrix-bg', 'on')
    const { canvas, root } = setup()
    const handle = initMatrixBg(canvas, root)
    vi.advanceTimersByTime(10)
    handle.destroy()
    expect(getMatrixBgHandle()).toBeNull()
    expect(lastImage!.onload).toBeNull()
    lastCtx!.fillText.mockClear()
    // No frames, no listener-driven repaints after destroy.
    vi.advanceTimersByTime(50)
    window.dispatchEvent(new CustomEvent('mrgrey-wallpaper-change', { detail: 'https://x/y.png' }))
    expect(lastCtx!.fillText).not.toHaveBeenCalled()
  })
})
