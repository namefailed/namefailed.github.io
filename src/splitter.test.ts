// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Splitter, type SplitterOptions } from './splitter'

/**
 * happy-dom doesn't dispatch a real PointerEvent type in all paths, so build a
 * plain Event and decorate it with the pointer fields the module reads.
 */
function pointerEvent(
  type: string,
  props: Partial<{
    isPrimary: boolean
    pointerType: string
    button: number
    pointerId: number
    clientX: number
    clientY: number
  }> = {},
): PointerEvent {
  const ev = new Event(type, { bubbles: true, cancelable: true }) as unknown as PointerEvent
  Object.assign(ev, {
    isPrimary: true,
    pointerType: 'mouse',
    button: 0,
    pointerId: 1,
    clientX: 0,
    clientY: 0,
    ...props,
  })
  return ev
}

interface Harness {
  splitter: Splitter
  el: HTMLElement
  target: HTMLElement
  container: HTMLElement
  onResize: ReturnType<typeof vi.fn>
}

function mount(overrides: Partial<SplitterOptions> = {}): Harness {
  const container = document.createElement('div')
  const target = document.createElement('div')
  const el = document.createElement('div')
  container.appendChild(target)
  container.appendChild(el)
  document.body.appendChild(container)

  // Stub layout geometry happy-dom doesn't compute.
  container.getBoundingClientRect = () =>
    ({ left: 100, top: 50, width: 1000, height: 800, right: 1100, bottom: 850, x: 100, y: 50, toJSON: () => ({}) }) as DOMRect
  Object.defineProperty(target, 'offsetLeft', { value: 10, configurable: true })
  Object.defineProperty(target, 'offsetTop', { value: 20, configurable: true })
  // Default max() reads these; give room so explicit-value tests aren't capped.
  Object.defineProperty(container, 'clientWidth', { value: 5000, configurable: true })
  Object.defineProperty(container, 'clientHeight', { value: 5000, configurable: true })

  // Pointer capture isn't implemented in happy-dom; spy so we can assert calls.
  el.setPointerCapture = vi.fn()
  el.releasePointerCapture = vi.fn()

  const onResize = vi.fn()
  const splitter = new Splitter({
    el,
    target,
    container,
    orientation: 'h',
    onResize,
    ...overrides,
  })
  return { splitter, el, target, container, onResize }
}

describe('Splitter', () => {
  beforeEach(() => {
    document.body.replaceChildren()
    document.body.className = ''
  })

  afterEach(() => {
    document.body.replaceChildren()
    document.body.className = ''
    vi.restoreAllMocks()
  })

  it('ignores non-primary pointers', () => {
    const h = mount()
    h.el.dispatchEvent(pointerEvent('pointerdown', { isPrimary: false }))
    expect(h.el.classList.contains('dragging')).toBe(false)
    expect(h.el.setPointerCapture).not.toHaveBeenCalled()
  })

  it('ignores non-left mouse buttons', () => {
    const h = mount()
    h.el.dispatchEvent(pointerEvent('pointerdown', { button: 1 }))
    expect(h.el.classList.contains('dragging')).toBe(false)
  })

  it('starts a non-mouse (touch) drag regardless of button', () => {
    const h = mount()
    // touch reports button 0 anyway, but the guard only applies to mouse
    h.el.dispatchEvent(pointerEvent('pointerdown', { pointerType: 'touch', button: 2 }))
    expect(h.el.classList.contains('dragging')).toBe(true)
  })

  it('adds dragging + resizing classes and captures the pointer on pointerdown', () => {
    const h = mount({ orientation: 'h' })
    h.el.dispatchEvent(pointerEvent('pointerdown', { pointerId: 7 }))

    expect(h.el.classList.contains('dragging')).toBe(true)
    expect(document.body.classList.contains('resizing')).toBe(true)
    expect(document.body.classList.contains('resizing-h')).toBe(true)
    expect(h.el.setPointerCapture).toHaveBeenCalledWith(7)
  })

  it('uses the vertical resizing class for v orientation', () => {
    const h = mount({ orientation: 'v' })
    h.el.dispatchEvent(pointerEvent('pointerdown'))
    expect(document.body.classList.contains('resizing-v')).toBe(true)
    expect(document.body.classList.contains('resizing-h')).toBe(false)
  })

  it('survives setPointerCapture throwing', () => {
    const h = mount()
    ;(h.el.setPointerCapture as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('unsupported')
    })
    expect(() => h.el.dispatchEvent(pointerEvent('pointerdown'))).not.toThrow()
    expect(h.el.classList.contains('dragging')).toBe(true)
  })

  it('resizes width on horizontal pointermove using container rect and target offset', () => {
    const h = mount({ orientation: 'h' })
    h.el.dispatchEvent(pointerEvent('pointerdown'))

    // clientX 600 - rect.left 100 - offsetLeft 10 = 490
    window.dispatchEvent(pointerEvent('pointermove', { clientX: 600 }))

    expect(h.target.style.width).toBe('490px')
    expect(h.target.style.flex).toBe('0 0 490px')
    expect(h.target.style.height).toBe('')
    expect(h.onResize).toHaveBeenCalledTimes(1)
  })

  it('resizes height on vertical pointermove', () => {
    const h = mount({ orientation: 'v' })
    h.el.dispatchEvent(pointerEvent('pointerdown'))

    // clientY 500 - rect.top 50 - offsetTop 20 = 430
    window.dispatchEvent(pointerEvent('pointermove', { clientY: 500 }))

    expect(h.target.style.height).toBe('430px')
    expect(h.target.style.flex).toBe('0 0 430px')
    expect(h.target.style.width).toBe('')
  })

  it('clamps to the min size', () => {
    const h = mount({ orientation: 'h', min: 250 })
    h.el.dispatchEvent(pointerEvent('pointerdown'))

    // raw size would be 0 - 100 - 10 = -110, clamped up to 250
    window.dispatchEvent(pointerEvent('pointermove', { clientX: 0 }))
    expect(h.target.style.width).toBe('250px')
  })

  it('clamps to a custom max size', () => {
    const max = vi.fn(() => 300)
    const h = mount({ orientation: 'h', max })
    h.el.dispatchEvent(pointerEvent('pointerdown'))

    // raw size 9999 - 100 - 10 = 9889, clamped down to 300
    window.dispatchEvent(pointerEvent('pointermove', { clientX: 9999 }))
    expect(h.target.style.width).toBe('300px')
    expect(max).toHaveBeenCalled()
  })

  it('default max uses container clientWidth - 200 (h)', () => {
    const h = mount({ orientation: 'h' })
    Object.defineProperty(h.container, 'clientWidth', { value: 1000, configurable: true })
    h.el.dispatchEvent(pointerEvent('pointerdown'))

    // default max = max(200, 1000 - 200) = 800; raw size clamps to 800
    window.dispatchEvent(pointerEvent('pointermove', { clientX: 99999 }))
    expect(h.target.style.width).toBe('800px')
  })

  it('default min is 200 when not provided', () => {
    const h = mount({ orientation: 'h' })
    h.el.dispatchEvent(pointerEvent('pointerdown'))
    window.dispatchEvent(pointerEvent('pointermove', { clientX: -5000 }))
    expect(h.target.style.width).toBe('200px')
  })

  it('does not throw when onResize is omitted', () => {
    const h = mount({ onResize: undefined })
    h.el.dispatchEvent(pointerEvent('pointerdown'))
    expect(() => window.dispatchEvent(pointerEvent('pointermove', { clientX: 600 }))).not.toThrow()
    expect(h.target.style.width).toBe('490px')
  })

  it('cleans up classes, releases capture, and detaches listeners on pointerup', () => {
    const h = mount({ orientation: 'h' })
    h.el.dispatchEvent(pointerEvent('pointerdown', { pointerId: 3 }))
    expect(h.el.classList.contains('dragging')).toBe(true)

    window.dispatchEvent(pointerEvent('pointerup', { pointerId: 3 }))

    expect(h.el.classList.contains('dragging')).toBe(false)
    expect(document.body.classList.contains('resizing')).toBe(false)
    expect(document.body.classList.contains('resizing-h')).toBe(false)
    expect(h.el.releasePointerCapture).toHaveBeenCalledWith(3)

    // listener detached: a post-up move must not mutate the target further
    h.target.style.width = '123px'
    window.dispatchEvent(pointerEvent('pointermove', { clientX: 600 }))
    expect(h.target.style.width).toBe('123px')
  })

  it('also ends the drag on pointercancel', () => {
    const h = mount()
    h.el.dispatchEvent(pointerEvent('pointerdown'))
    window.dispatchEvent(pointerEvent('pointercancel'))
    expect(h.el.classList.contains('dragging')).toBe(false)
    expect(document.body.classList.contains('resizing')).toBe(false)
  })

  it('survives releasePointerCapture throwing on pointerup', () => {
    const h = mount()
    ;(h.el.releasePointerCapture as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('noop')
    })
    h.el.dispatchEvent(pointerEvent('pointerdown'))
    expect(() => window.dispatchEvent(pointerEvent('pointerup'))).not.toThrow()
    expect(h.el.classList.contains('dragging')).toBe(false)
  })

  it('handles multiple sequential drags independently', () => {
    const h = mount({ orientation: 'h' })

    h.el.dispatchEvent(pointerEvent('pointerdown'))
    window.dispatchEvent(pointerEvent('pointermove', { clientX: 600 }))
    window.dispatchEvent(pointerEvent('pointerup'))
    expect(h.target.style.width).toBe('490px')

    h.el.dispatchEvent(pointerEvent('pointerdown'))
    window.dispatchEvent(pointerEvent('pointermove', { clientX: 400 }))
    expect(h.target.style.width).toBe('290px')
    expect(h.el.classList.contains('dragging')).toBe(true)
  })
})
