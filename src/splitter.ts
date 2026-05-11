/**
 * Pointer-based splitters (`h`: terminal vs stack width; `v`: height above pane). Mouse + touch.
 */

export type SplitterOrientation = 'h' | 'v'

export interface SplitterOptions {
  el: HTMLElement
  orientation: SplitterOrientation
  target: HTMLElement
  min?: number
  max?: () => number
  container: HTMLElement
  onResize?: () => void
}

export class Splitter {
  private opts: Required<Omit<SplitterOptions, 'onResize'>> & Pick<SplitterOptions, 'onResize'>

  constructor(opts: SplitterOptions) {
    this.opts = {
      min: 200,
      max: () => {
        const total =
          opts.orientation === 'h'
            ? opts.container.clientWidth
            : opts.container.clientHeight
        return Math.max(200, total - 200)
      },
      onResize: undefined,
      ...opts,
    }
    opts.el.addEventListener('pointerdown', e => this.onPointerDown(e))
  }

  private onPointerDown(e: PointerEvent): void {
    if (!e.isPrimary) return
    if (e.pointerType === 'mouse' && e.button !== 0) return

    e.preventDefault()
    const { orientation, target, container, el } = this.opts
    el.classList.add('dragging')
    document.body.classList.add('resizing', `resizing-${orientation}`)

    try {
      el.setPointerCapture(e.pointerId)
    } catch {
      /* capture unsupported — fall through; move/up still work on desktop */
    }

    const rect = container.getBoundingClientRect()

    const onMove = (ev: PointerEvent): void => {
      let size: number
      if (orientation === 'h') {
        size = ev.clientX - rect.left - target.offsetLeft
      } else {
        size = ev.clientY - rect.top - target.offsetTop
      }
      const min = this.opts.min
      const max = this.opts.max()
      size = Math.max(min, Math.min(max, size))

      if (orientation === 'h') {
        target.style.width = `${size}px`
        target.style.flex = `0 0 ${size}px`
      } else {
        target.style.height = `${size}px`
        target.style.flex = `0 0 ${size}px`
      }
      this.opts.onResize?.()
    }

    const onUp = (ev: PointerEvent): void => {
      el.classList.remove('dragging')
      document.body.classList.remove('resizing', `resizing-${orientation}`)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      try {
        el.releasePointerCapture(ev.pointerId)
      } catch {
        /* noop */
      }
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }
}
