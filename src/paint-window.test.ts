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

/** A fake ImageData the size of the canvas, backed by a real RGBA buffer. */
function fakeImageData(w: number, h: number) {
  return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }
}

/** A 2D-context stub exposing every method/prop the paint draw path touches. */
function makeCtx() {
  return {
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    getImageData: vi.fn((_x: number, _y: number, w: number, h: number) => fakeImageData(w, h)),
    putImageData: vi.fn(),
    drawImage: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    setTransform: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'round',
    lineJoin: 'round',
    globalCompositeOperation: 'source-over',
  }
}

describe('PaintWindow', () => {
  const origGetContext = HTMLCanvasElement.prototype.getContext
  const origGetComputedStyle = globalThis.getComputedStyle
  const origRO = globalThis.ResizeObserver
  const origRAF = globalThis.requestAnimationFrame
  const origGBCR = HTMLElement.prototype.getBoundingClientRect

  let ctx: ReturnType<typeof makeCtx>
  let roCallback: (() => void) | null = null
  let rafQueue: FrameRequestCallback[] = []

  beforeEach(() => {
    document.body.replaceChildren()
    ctx = makeCtx()
    roCallback = null
    rafQueue = []

    HTMLCanvasElement.prototype.getContext = vi.fn(
      () => ctx,
    ) as unknown as typeof HTMLCanvasElement.prototype.getContext

    globalThis.getComputedStyle = vi.fn(() => ({
      getPropertyValue: (name: string) => (name === '--paint-bg' ? '#1e1e2e' : ''),
    })) as unknown as typeof getComputedStyle

    globalThis.ResizeObserver = class {
      constructor(cb: () => void) {
        roCallback = cb
      }
      observe = vi.fn()
      unobserve = vi.fn()
      disconnect = vi.fn()
    } as unknown as typeof ResizeObserver

    // Queue rAF callbacks so tests can flush the boot resize deterministically.
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      rafQueue.push(cb)
      return rafQueue.length
    }) as unknown as typeof requestAnimationFrame

    // A concrete canvas-wrap size so resize() produces a non-degenerate bitmap.
    HTMLElement.prototype.getBoundingClientRect = vi.fn(
      () => ({ width: 200, height: 150, top: 0, left: 0, right: 200, bottom: 150, x: 0, y: 0 }),
    ) as unknown as typeof HTMLElement.prototype.getBoundingClientRect
  })

  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = origGetContext
    globalThis.getComputedStyle = origGetComputedStyle
    globalThis.ResizeObserver = origRO
    globalThis.requestAnimationFrame = origRAF
    HTMLElement.prototype.getBoundingClientRect = origGBCR
    vi.restoreAllMocks()
  })

  /** Run every queued rAF callback (boots the first resize). */
  function flushRaf() {
    const q = rafQueue
    rafQueue = []
    q.forEach(cb => cb(0))
  }

  /** Find a toolbar button by its label text. */
  const btn = (win: PaintWindow, label: string) =>
    [...win.el.querySelectorAll('.paint-btn')].find(
      b => b.textContent === label,
    ) as HTMLButtonElement

  const toolBtn = (win: PaintWindow, label: string) =>
    [...win.el.querySelectorAll('.paint-btn--tool')].find(
      b => b.textContent === label,
    ) as HTMLButtonElement

  const canvasOf = (win: PaintWindow) =>
    win.el.querySelector('canvas.paint-canvas') as HTMLCanvasElement

  /** A pointerdown/move/up trio dispatched on the canvas. */
  function pointer(canvas: HTMLCanvasElement, type: string, x: number, y: number) {
    const ev = new Event(type, { bubbles: true, cancelable: true }) as PointerEvent
    Object.assign(ev, { clientX: x, clientY: y, pointerId: 1 })
    canvas.dispatchEvent(ev)
    return ev
  }

  function mount() {
    const opts = chromeOpts()
    const win = new PaintWindow(opts)
    document.body.appendChild(win.el)
    // setPointerCapture isn't implemented in happy-dom — make it a no-op.
    const canvas = canvasOf(win)
    ;(canvas as unknown as { setPointerCapture: () => void }).setPointerCapture = vi.fn()
    return { win, opts, canvas }
  }

  it('mounts paint canvas and toolbar controls', () => {
    const win = new PaintWindow(chromeOpts())
    document.body.appendChild(win.el)

    expect(win.el.classList.contains('paint-app')).toBe(true)
    expect(win.el.querySelector('canvas.paint-canvas')).not.toBeNull()
    expect(btn(win, 'Undo').disabled).toBe(true)
    expect(win.command).toBe('paint')
  })

  it('throws when no 2D context is available', () => {
    HTMLCanvasElement.prototype.getContext = vi.fn(
      () => null,
    ) as unknown as typeof HTMLCanvasElement.prototype.getContext
    expect(() => new PaintWindow(chromeOpts())).toThrow('2d')
  })

  it('disconnects ResizeObserver on dispose', () => {
    const { win } = mount()
    const ro = (win as unknown as { resizeObserver: { disconnect: ReturnType<typeof vi.fn> } })
      .resizeObserver
    const disconnect = ro.disconnect
    win.dispose()
    expect(disconnect).toHaveBeenCalledOnce()
    expect(
      (win as unknown as { resizeObserver: unknown }).resizeObserver,
    ).toBeNull()
  })

  it('dispose is idempotent (second call does not throw)', () => {
    const { win } = mount()
    win.dispose()
    expect(() => win.dispose()).not.toThrow()
  })

  it('toggles active class via setActive', () => {
    const { win } = mount()
    win.setActive(true)
    expect(win.el.classList.contains('active')).toBe(true)
    win.setActive(false)
    expect(win.el.classList.contains('active')).toBe(false)
  })

  it('toggles minimized class via setMinimized', () => {
    const { win } = mount()
    win.setMinimized(true)
    expect(win.el.classList.contains('minimized')).toBe(true)
    win.setMinimized(false)
    expect(win.el.classList.contains('minimized')).toBe(false)
  })

  it('isMaximized reflects the maximized class', () => {
    const { win } = mount()
    expect(win.isMaximized()).toBe(false)
    win.el.classList.add('maximized')
    expect(win.isMaximized()).toBe(true)
  })

  it('focusCanvas focuses the canvas element', () => {
    const { win, canvas } = mount()
    const spy = vi.spyOn(canvas, 'focus')
    win.focusCanvas()
    expect(spy).toHaveBeenCalledOnce()
  })

  it('scrollBy delegates to the canvas wrap', () => {
    const { win } = mount()
    const wrap = win.el.querySelector('.paint-canvas-wrap') as HTMLElement
    const spy = vi.fn()
    ;(wrap as unknown as { scrollBy: unknown }).scrollBy = spy
    win.scrollBy(40)
    expect(spy).toHaveBeenCalledWith({ top: 40, behavior: 'smooth' })
  })

  it('titlebar buttons forward close, minimize and maximize', () => {
    const { win, opts } = mount()
    ;(win.el.querySelector('.dot-close') as HTMLElement).click()
    ;(win.el.querySelector('.dot-min') as HTMLElement).click()
    ;(win.el.querySelector('.dot-max') as HTMLElement).click()
    expect(opts.onClose).toHaveBeenCalledOnce()
    expect(opts.onMinimize).toHaveBeenCalledOnce()
    expect(opts.onMaximize).toHaveBeenCalledOnce()
  })

  // --- resize / boot ----------------------------------------------------------

  it('boot rAF sizes the canvas bitmap and paints the background', () => {
    const { win, canvas } = mount()
    flushRaf()
    // 200x150 wrap, dpr defaults to 1 in happy-dom -> bitmap matches.
    expect(canvas.width).toBe(200)
    expect(canvas.height).toBe(150)
    expect(canvas.style.width).toBe('200px')
    expect(canvas.style.height).toBe('150px')
    expect(ctx.setTransform).toHaveBeenCalledWith(1, 0, 0, 1, 0, 0)
    // Background fill uses the --paint-bg colour.
    expect(ctx.fillStyle).toBe('#1e1e2e')
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 200, 150)
    win.dispose()
  })

  it('a degenerate wrap size is floored to the 80px minimum bitmap', () => {
    HTMLElement.prototype.getBoundingClientRect = vi.fn(
      () => ({ width: 10, height: 10, top: 0, left: 0, right: 10, bottom: 10, x: 0, y: 0 }),
    ) as unknown as typeof HTMLElement.prototype.getBoundingClientRect
    const { win, canvas } = mount()
    flushRaf()
    expect(canvas.width).toBe(80)
    expect(canvas.height).toBe(80)
    win.dispose()
  })

  it('clamps devicePixelRatio at 2 when computing the bitmap', () => {
    const origDpr = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio')
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 3 })
    const { win, canvas } = mount()
    flushRaf()
    // 200 * min(2,3) = 400, not 600.
    expect(canvas.width).toBe(400)
    expect(canvas.height).toBe(300)
    expect(ctx.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0)
    if (origDpr) Object.defineProperty(window, 'devicePixelRatio', origDpr)
    else delete (window as unknown as { devicePixelRatio?: number }).devicePixelRatio
    win.dispose()
  })

  it('treats a falsy devicePixelRatio as 1', () => {
    const origDpr = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio')
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 0 })
    const { win, canvas } = mount()
    flushRaf()
    expect(canvas.width).toBe(200) // 200 * 1, not 0
    expect(ctx.setTransform).toHaveBeenCalledWith(1, 0, 0, 1, 0, 0)
    if (origDpr) Object.defineProperty(window, 'devicePixelRatio', origDpr)
    else delete (window as unknown as { devicePixelRatio?: number }).devicePixelRatio
    win.dispose()
  })

  it('ResizeObserver callback re-paints and clears the undo history', () => {
    const { win, canvas } = mount()
    flushRaf()
    ctx.fillRect.mockClear()
    expect(roCallback).not.toBeNull()
    roCallback!()
    expect(canvas.width).toBe(200)
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 200, 150)
    expect((win as unknown as { undoStack: unknown[] }).undoStack).toHaveLength(0)
    expect(btn(win, 'Undo').disabled).toBe(true)
    win.dispose()
  })

  it('falls back to the default bg colour when --paint-bg is empty', () => {
    globalThis.getComputedStyle = vi.fn(() => ({
      getPropertyValue: () => '',
    })) as unknown as typeof getComputedStyle
    const { win } = mount()
    flushRaf()
    expect(ctx.fillStyle).toBe('#181825')
    win.dispose()
  })

  // --- tool selection ---------------------------------------------------------

  it('Brush is the active tool on mount', () => {
    const { win } = mount()
    const brush = toolBtn(win, 'Brush')
    expect(brush.classList.contains('paint-btn--active')).toBe(true)
    expect(brush.getAttribute('aria-pressed')).toBe('true')
  })

  it('selecting a tool moves the active state and aria-pressed flag', () => {
    const { win } = mount()
    const brush = toolBtn(win, 'Brush')
    const fill = toolBtn(win, 'Fill')
    fill.click()
    expect(fill.classList.contains('paint-btn--active')).toBe(true)
    expect(fill.getAttribute('aria-pressed')).toBe('true')
    expect(brush.classList.contains('paint-btn--active')).toBe(false)
    expect(brush.getAttribute('aria-pressed')).toBe('false')
    win.dispose()
  })

  it('only one tool button is active at a time', () => {
    const { win } = mount()
    toolBtn(win, 'Eraser').click()
    toolBtn(win, 'Line').click()
    const active = [...win.el.querySelectorAll('.paint-btn--tool.paint-btn--active')]
    expect(active).toHaveLength(1)
    expect(active[0]!.textContent).toBe('Line')
    win.dispose()
  })

  // --- brush / eraser / line strokes -----------------------------------------

  it('brush pointerdown stamps a dot and pushes an undo snapshot', () => {
    const { win, canvas, opts } = mount()
    flushRaf()
    pointer(canvas, 'pointerdown', 20, 30)
    expect(opts.onFocus).toHaveBeenCalled()
    expect(ctx.arc).toHaveBeenCalled() // a dot is stamped at pointerdown
    expect(ctx.fill).toHaveBeenCalled()
    expect((win as unknown as { undoStack: unknown[] }).undoStack.length).toBe(1)
    win.dispose()
  })

  it('brush drag draws line segments and ending enables Undo', () => {
    const { win, canvas } = mount()
    flushRaf()
    pointer(canvas, 'pointerdown', 10, 10)
    ctx.stroke.mockClear()
    pointer(canvas, 'pointermove', 25, 25)
    pointer(canvas, 'pointermove', 40, 40)
    expect(ctx.stroke).toHaveBeenCalledTimes(2)
    expect(ctx.strokeStyle).toBe('#cba6f7') // brush uses the colour input value
    pointer(canvas, 'pointerup', 40, 40)
    expect(btn(win, 'Undo').disabled).toBe(false)
    win.dispose()
  })

  it('pointermove without an active stroke is ignored', () => {
    const { win, canvas } = mount()
    flushRaf()
    ctx.stroke.mockClear()
    pointer(canvas, 'pointermove', 25, 25)
    expect(ctx.stroke).not.toHaveBeenCalled()
    win.dispose()
  })

  it('eraser strokes with the background colour', () => {
    const { win, canvas } = mount()
    flushRaf()
    toolBtn(win, 'Eraser').click()
    pointer(canvas, 'pointerdown', 10, 10)
    pointer(canvas, 'pointermove', 20, 20)
    expect(ctx.strokeStyle).toBe('#1e1e2e') // eraser paints the bg colour
    pointer(canvas, 'pointerup', 20, 20)
    win.dispose()
  })

  it('line tool defers drawing until pointerup (single segment)', () => {
    const { win, canvas } = mount()
    flushRaf()
    toolBtn(win, 'Line').click()
    pointer(canvas, 'pointerdown', 5, 5)
    ctx.stroke.mockClear()
    pointer(canvas, 'pointermove', 50, 50) // moves are no-ops for line
    expect(ctx.stroke).not.toHaveBeenCalled()
    pointer(canvas, 'pointerup', 80, 80) // commits one segment
    expect(ctx.moveTo).toHaveBeenCalledWith(5, 5)
    expect(ctx.lineTo).toHaveBeenCalledWith(80, 80)
    expect(ctx.stroke).toHaveBeenCalledTimes(1)
    win.dispose()
  })

  it('pointercancel ends a stroke just like pointerup', () => {
    const { win, canvas } = mount()
    flushRaf()
    pointer(canvas, 'pointerdown', 10, 10)
    pointer(canvas, 'pointercancel', 10, 10)
    expect(btn(win, 'Undo').disabled).toBe(false)
    // A move after cancel does not draw.
    ctx.stroke.mockClear()
    pointer(canvas, 'pointermove', 30, 30)
    expect(ctx.stroke).not.toHaveBeenCalled()
    win.dispose()
  })

  it('pointerup with no active stroke is a no-op', () => {
    const { win, canvas } = mount()
    flushRaf()
    pointer(canvas, 'pointerup', 10, 10)
    expect(btn(win, 'Undo').disabled).toBe(true)
    win.dispose()
  })

  // --- fill tool --------------------------------------------------------------

  it('fill tool reads pixels, runs the fill, and writes them back', () => {
    const { win, canvas } = mount()
    flushRaf()
    toolBtn(win, 'Fill').click()
    pointer(canvas, 'pointerdown', 20, 30)
    expect(ctx.getImageData).toHaveBeenCalledWith(0, 0, 200, 150)
    expect(ctx.putImageData).toHaveBeenCalled()
    // Fill pushes an undo snapshot and does NOT start a painting stroke.
    expect(btn(win, 'Undo').disabled).toBe(false)
    expect((win as unknown as { painting: boolean }).painting).toBe(false)
    win.dispose()
  })

  it('fill does not start dragging strokes on subsequent moves', () => {
    const { win, canvas } = mount()
    flushRaf()
    toolBtn(win, 'Fill').click()
    pointer(canvas, 'pointerdown', 20, 30)
    ctx.stroke.mockClear()
    pointer(canvas, 'pointermove', 60, 60)
    expect(ctx.stroke).not.toHaveBeenCalled()
    win.dispose()
  })

  // --- clear / undo -----------------------------------------------------------

  it('Clear repaints the background and records an undo step', () => {
    const { win } = mount()
    flushRaf()
    ctx.fillRect.mockClear()
    btn(win, 'Clear').click()
    expect(ctx.fillStyle).toBe('#1e1e2e')
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 200, 150)
    expect(btn(win, 'Undo').disabled).toBe(false)
    win.dispose()
  })

  it('Undo restores the previous snapshot and re-disables when empty', () => {
    const { win } = mount()
    flushRaf()
    btn(win, 'Clear').click() // pushes one snapshot
    expect(btn(win, 'Undo').disabled).toBe(false)
    ctx.putImageData.mockClear()
    btn(win, 'Undo').click()
    expect(ctx.putImageData).toHaveBeenCalled()
    expect(btn(win, 'Undo').disabled).toBe(true)
    win.dispose()
  })

  it('Undo on an empty stack is a no-op (no putImageData)', () => {
    const { win } = mount()
    flushRaf()
    ctx.putImageData.mockClear()
    btn(win, 'Undo').click()
    expect(ctx.putImageData).not.toHaveBeenCalled()
    expect(btn(win, 'Undo').disabled).toBe(true)
    win.dispose()
  })

  it('the undo stack is capped at 12 snapshots', () => {
    const { win } = mount()
    flushRaf()
    const clear = btn(win, 'Clear')
    for (let i = 0; i < 20; i++) clear.click()
    expect((win as unknown as { undoStack: unknown[] }).undoStack.length).toBe(12)
    win.dispose()
  })

  it('Undo skips putImageData when the snapshot size no longer matches', () => {
    const { win, canvas } = mount()
    flushRaf()
    btn(win, 'Clear').click() // snapshot at 200x150
    // Simulate a resize that changed the bitmap dimensions out from under undo.
    canvas.width = 64
    canvas.height = 64
    ctx.putImageData.mockClear()
    btn(win, 'Undo').click()
    expect(ctx.putImageData).not.toHaveBeenCalled()
    win.dispose()
  })

  it('pushPaintUndo is skipped on a zero-size canvas', () => {
    const { win, canvas } = mount()
    // No flushRaf: canvas stays 0x0, so the undo snapshot is skipped.
    canvas.width = 0
    canvas.height = 0
    btn(win, 'Clear').click()
    expect((win as unknown as { undoStack: unknown[] }).undoStack.length).toBe(0)
    win.dispose()
  })

  it('a getImageData failure during undo snapshot is swallowed', () => {
    const { win } = mount()
    flushRaf()
    ctx.getImageData.mockImplementationOnce(() => {
      throw new Error('tainted')
    })
    expect(() => btn(win, 'Clear').click()).not.toThrow()
    // The failed snapshot was not recorded.
    expect((win as unknown as { undoStack: unknown[] }).undoStack.length).toBe(0)
    win.dispose()
  })

  // --- size controls ----------------------------------------------------------

  it('"]" grows the brush size and "[" shrinks it', () => {
    const { win, canvas } = mount()
    const size = win.el.querySelector('.paint-size') as HTMLInputElement
    expect(size.value).toBe('4')
    canvas.dispatchEvent(new KeyboardEvent('keydown', { code: 'BracketRight', bubbles: true }))
    expect(size.value).toBe('6')
    canvas.dispatchEvent(new KeyboardEvent('keydown', { code: 'BracketLeft', bubbles: true }))
    expect(size.value).toBe('4')
    win.dispose()
  })

  it('brush size is clamped to the 1..36 range', () => {
    const { win, canvas } = mount()
    const size = win.el.querySelector('.paint-size') as HTMLInputElement
    for (let i = 0; i < 25; i++)
      canvas.dispatchEvent(new KeyboardEvent('keydown', { code: 'BracketRight', bubbles: true }))
    expect(size.value).toBe('36')
    for (let i = 0; i < 25; i++)
      canvas.dispatchEvent(new KeyboardEvent('keydown', { code: 'BracketLeft', bubbles: true }))
    expect(size.value).toBe('1')
    win.dispose()
  })

  it('the chosen size becomes the stroke line width', () => {
    const { win, canvas } = mount()
    flushRaf()
    const size = win.el.querySelector('.paint-size') as HTMLInputElement
    size.value = '12'
    pointer(canvas, 'pointerdown', 10, 10)
    pointer(canvas, 'pointermove', 20, 20)
    expect(ctx.lineWidth).toBe(12)
    win.dispose()
  })

  it('falls back to a line width of 4 when the size input is non-numeric', () => {
    const { win, canvas } = mount()
    flushRaf()
    const size = win.el.querySelector('.paint-size') as HTMLInputElement
    // A range input validates numeric values, so override the getter directly
    // to force parseInt -> NaN and exercise the `|| 4` fallback.
    Object.defineProperty(size, 'value', { configurable: true, get: () => 'oops' })
    pointer(canvas, 'pointerdown', 10, 10)
    pointer(canvas, 'pointermove', 20, 20)
    expect(ctx.lineWidth).toBe(4)
    win.dispose()
  })

  it('an unrelated key on the canvas does not change the size', () => {
    const { win, canvas } = mount()
    const size = win.el.querySelector('.paint-size') as HTMLInputElement
    canvas.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA', bubbles: true }))
    expect(size.value).toBe('4')
    win.dispose()
  })

  // --- save -------------------------------------------------------------------

  it('Save PNG downloads a blob via an anchor and revokes the object URL', () => {
    const { win, canvas } = mount()
    flushRaf()
    const blob = new Blob(['x'], { type: 'image/png' })
    ;(canvas as unknown as { toBlob: unknown }).toBlob = vi.fn(
      (cb: (b: Blob) => void) => cb(blob),
    )
    const createURL = vi.fn(() => 'blob:fake')
    const revokeURL = vi.fn()
    ;(globalThis.URL as unknown as { createObjectURL: unknown }).createObjectURL = createURL
    ;(globalThis.URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = revokeURL
    const clicks: HTMLAnchorElement[] = []
    const origClick = HTMLAnchorElement.prototype.click
    HTMLAnchorElement.prototype.click = function () {
      clicks.push(this as HTMLAnchorElement)
    }

    btn(win, 'Save PNG').click()

    expect(createURL).toHaveBeenCalledWith(blob)
    expect(revokeURL).toHaveBeenCalledWith('blob:fake')
    expect(clicks).toHaveLength(1)
    expect(clicks[0]!.href).toBe('blob:fake')
    expect(clicks[0]!.download).toMatch(/^paint-.*\.png$/)

    HTMLAnchorElement.prototype.click = origClick
    win.dispose()
  })

  it('Save PNG is a no-op when toBlob yields no blob', () => {
    const { win, canvas } = mount()
    flushRaf()
    ;(canvas as unknown as { toBlob: unknown }).toBlob = vi.fn(
      (cb: (b: Blob | null) => void) => cb(null),
    )
    const createURL = vi.fn()
    ;(globalThis.URL as unknown as { createObjectURL: unknown }).createObjectURL = createURL
    expect(() => btn(win, 'Save PNG').click()).not.toThrow()
    expect(createURL).not.toHaveBeenCalled()
    win.dispose()
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

  it('forces alpha to 255 on filled pixels even from a translucent seed', () => {
    const d = solid(2, 2, 0, 0, 0, 100) // seed alpha 100
    floodFillPixels(d, 2, 2, 0, 0, 10, 20, 30)
    for (let i = 0; i < d.length; i += 4) {
      expect([d[i], d[i + 1], d[i + 2], d[i + 3]]).toEqual([10, 20, 30, 255])
    }
  })

  it('matches on alpha — a same-RGB but different-alpha pixel is a wall', () => {
    // 3x1 row, all RGB black; middle pixel has a different alpha.
    const d = solid(3, 1, 0, 0, 0, 255)
    d[7] = 100 // middle alpha differs -> not part of the seed region
    floodFillPixels(d, 3, 1, 0, 0, 9, 9, 9)
    expect([d[0], d[1], d[2], d[3]]).toEqual([9, 9, 9, 255]) // left filled
    expect(d[7]).toBe(100) // alpha-wall untouched
    expect([d[8], d[9], d[10]]).toEqual([0, 0, 0]) // right side unreachable
  })

  it('spreads across all four neighbours from an interior seed', () => {
    // 3x3 cross: centre + 4 orthogonal neighbours are seed, corners are walls.
    const d = solid(3, 3, 0, 0, 0)
    const wall = (x: number, y: number) => {
      const i = (y * 3 + x) * 4
      d[i] = 200
      d[i + 1] = 200
      d[i + 2] = 200
    }
    wall(0, 0)
    wall(2, 0)
    wall(0, 2)
    wall(2, 2)
    floodFillPixels(d, 3, 3, 1, 1, 1, 2, 3)
    const at = (x: number, y: number) => {
      const i = (y * 3 + x) * 4
      return [d[i], d[i + 1], d[i + 2]]
    }
    expect(at(1, 1)).toEqual([1, 2, 3]) // centre
    expect(at(1, 0)).toEqual([1, 2, 3]) // up
    expect(at(1, 2)).toEqual([1, 2, 3]) // down
    expect(at(0, 1)).toEqual([1, 2, 3]) // left
    expect(at(2, 1)).toEqual([1, 2, 3]) // right
    expect(at(0, 0)).toEqual([200, 200, 200]) // corner wall untouched
  })

  it('fills the whole canvas from a corner seed', () => {
    const d = solid(4, 4, 50, 60, 70)
    floodFillPixels(d, 4, 4, 0, 0, 1, 1, 1)
    for (let i = 0; i < d.length; i += 4) {
      expect([d[i], d[i + 1], d[i + 2], d[i + 3]]).toEqual([1, 1, 1, 255])
    }
  })
})
