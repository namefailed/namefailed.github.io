/** Canvas raster tools: brush, eraser-to-bg, line, fill; mouse + touch. */

import { createWindowChrome } from './window-chrome'

export interface PaintWindowOptions {
  onClose: () => void
  onMinimize: () => void
  onMaximize: () => void
  onFocus: () => void
}

type PaintTool = 'brush' | 'eraser' | 'line' | 'fill'

export class PaintWindow {
  readonly el: HTMLElement
  readonly command = 'paint' as const
  readonly onFocus: () => void

  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private wrap: HTMLElement
  private painting = false
  private last: { x: number; y: number } | null = null
  private lineStart: { x: number; y: number } | null = null
  private tool: PaintTool = 'brush'

  /** Pixel snapshots for Undo (bounded — full canvas copies) */
  private undoStack: ImageData[] = []
  private static readonly UNDO_CAP = 12

  private onClose: () => void
  private onMinimize: () => void
  private onMaximize: () => void

  constructor(opts: PaintWindowOptions) {
    this.onClose = opts.onClose
    this.onMinimize = opts.onMinimize
    this.onMaximize = opts.onMaximize
    this.onFocus = opts.onFocus

    const chrome = createWindowChrome({
      title: 'paint',
      onClose: () => this.onClose(),
      onMinimize: () => this.onMinimize(),
      onMaximize: () => this.onMaximize(),
      onFocus: opts.onFocus,
    })
    this.el = chrome.el
    this.el.classList.add('paint-app')

    const toolbar = document.createElement('div')
    toolbar.className = 'paint-toolbar'

    const colorLabel = document.createElement('label')
    colorLabel.className = 'paint-tool-label'
    colorLabel.textContent = 'Color'
    const color = document.createElement('input')
    color.type = 'color'
    color.className = 'paint-color'
    color.value = '#cba6f7'
    colorLabel.appendChild(color)

    const sizeLabel = document.createElement('label')
    sizeLabel.className = 'paint-tool-label'
    sizeLabel.textContent = 'Size'
    const size = document.createElement('input')
    size.type = 'range'
    size.className = 'paint-size'
    size.min = '1'
    size.max = '36'
    size.value = '4'
    sizeLabel.appendChild(size)

    const mkTool = (name: string, t: PaintTool, active = false): HTMLButtonElement => {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'paint-btn os-toolbar-btn' + (active ? ' paint-btn--active' : '')
      b.textContent = name
      b.setAttribute('aria-pressed', active ? 'true' : 'false')
      b.addEventListener('click', () => {
        this.tool = t
        toolbar.querySelectorAll('.paint-btn--tool').forEach(x => {
          const btn = x as HTMLButtonElement
          const on = btn === b
          btn.classList.toggle('paint-btn--active', on)
          btn.setAttribute('aria-pressed', on ? 'true' : 'false')
        })
      })
      b.classList.add('paint-btn--tool')
      return b
    }

    const btnBrush = mkTool('Brush', 'brush', true)
    const btnEraser = mkTool('Eraser', 'eraser')
    const btnLine = mkTool('Line', 'line')
    const btnFill = mkTool('Fill', 'fill')

    const btnClear = document.createElement('button')
    btnClear.type = 'button'
    btnClear.className = 'paint-btn paint-btn--danger os-toolbar-btn'
    btnClear.textContent = 'Clear'
    btnClear.addEventListener('click', () => {
      this.pushPaintUndo()
      const r = this.wrap.getBoundingClientRect()
      this.ctx.fillStyle = this.canvasBgCss()
      this.ctx.fillRect(0, 0, r.width, r.height)
      btnUndo.disabled = this.undoStack.length === 0
    })

    const btnUndo = document.createElement('button')
    btnUndo.type = 'button'
    btnUndo.className = 'paint-btn os-toolbar-btn'
    btnUndo.textContent = 'Undo'
    btnUndo.disabled = true
    btnUndo.title = 'Undo last stroke or fill (up to 12 steps)'
    btnUndo.addEventListener('click', () => {
      this.popPaintUndo()
      btnUndo.disabled = this.undoStack.length === 0
    })

    const btnSave = document.createElement('button')
    btnSave.type = 'button'
    btnSave.className = 'paint-btn os-toolbar-btn'
    btnSave.textContent = 'Save PNG'
    btnSave.title = 'Download drawing as PNG'
    btnSave.addEventListener('click', () => {
      this.canvas.toBlob(blob => {
        if (!blob) return
        const u = URL.createObjectURL(blob)
        const a = document.createElement('a')
        const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
        a.href = u
        a.download = `paint-${stamp}.png`
        a.rel = 'noopener'
        a.click()
        URL.revokeObjectURL(u)
      }, 'image/png')
    })

    toolbar.append(
      colorLabel,
      sizeLabel,
      btnBrush,
      btnEraser,
      btnLine,
      btnFill,
      btnUndo,
      btnSave,
      btnClear,
    )

    this.wrap = document.createElement('div')
    this.wrap.className = 'paint-canvas-wrap'

    this.canvas = document.createElement('canvas')
    this.canvas.className = 'paint-canvas'
    this.canvas.tabIndex = 0
    const g = this.canvas.getContext('2d')
    if (!g) throw new Error('2d')
    this.ctx = g

    this.wrap.appendChild(this.canvas)

    const stack = document.createElement('div')
    stack.className = 'paint-stack'
    stack.appendChild(toolbar)
    stack.appendChild(this.wrap)

    this.el.appendChild(stack)

    const resize = (): void => {
      const r = this.wrap.getBoundingClientRect()
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const w = Math.max(80, Math.floor(r.width * dpr))
      const h = Math.max(80, Math.floor(r.height * dpr))
      this.canvas.width = w
      this.canvas.height = h
      this.canvas.style.width = `${r.width}px`
      this.canvas.style.height = `${r.height}px`
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const bg = this.canvasBgCss()
      this.ctx.fillStyle = bg
      this.ctx.fillRect(0, 0, r.width, r.height)
      this.undoStack.length = 0
      btnUndo.disabled = true
    }

    const ro = new ResizeObserver(() => resize())
    ro.observe(this.wrap)
    requestAnimationFrame(resize)

    const pos = (ev: PointerEvent): { x: number; y: number } => {
      const b = this.canvas.getBoundingClientRect()
      return { x: ev.clientX - b.left, y: ev.clientY - b.top }
    }

    const lw = (): number => parseInt(size.value, 10) || 4

    const strokeStyle = (): string => {
      if (this.tool === 'eraser') return this.canvasBgCss()
      return color.value
    }

    const prepStroke = (): void => {
      this.ctx.globalCompositeOperation = 'source-over'
      this.ctx.lineWidth = lw()
      this.ctx.lineCap = 'round'
      this.ctx.lineJoin = 'round'
      this.ctx.strokeStyle = strokeStyle()
    }

    const drawSegment = (x0: number, y0: number, x1: number, y1: number): void => {
      prepStroke()
      this.ctx.beginPath()
      this.ctx.moveTo(x0, y0)
      this.ctx.lineTo(x1, y1)
      this.ctx.stroke()
    }

    const floodFill = (sx: number, sy: number): void => {
      this.pushPaintUndo()
      const b = this.canvas.getBoundingClientRect()
      const px = Math.min(this.canvas.width - 1, Math.max(0, Math.floor((sx / b.width) * this.canvas.width)))
      const py = Math.min(this.canvas.height - 1, Math.max(0, Math.floor((sy / b.height) * this.canvas.height)))
      const w = this.canvas.width
      const h = this.canvas.height
      const idata = this.ctx.getImageData(0, 0, w, h)
      const d = idata.data
      const tgt = (py * w + px) * 4
      const tr = d[tgt]!
      const tg = d[tgt + 1]!
      const tb = d[tgt + 2]!
      const ta = d[tgt + 3]!
      const hex = color.value
      const nr = parseInt(hex.slice(1, 3), 16)
      const ng = parseInt(hex.slice(3, 5), 16)
      const nb = parseInt(hex.slice(5, 7), 16)
      if (tr === nr && tg === ng && tb === nb) return
      const stack: number[] = [px, py]
      const vis = new Uint8Array(w * h)
      const match = (i: number): boolean =>
        d[i] === tr && d[i + 1] === tg && d[i + 2] === tb && d[i + 3] === ta
      while (stack.length) {
        const y = stack.pop()!
        const x = stack.pop()!
        if (x < 0 || y < 0 || x >= w || y >= h) continue
        const p = y * w + x
        if (vis[p]) continue
        vis[p] = 1
        const i = p * 4
        if (!match(i)) continue
        d[i] = nr
        d[i + 1] = ng
        d[i + 2] = nb
        d[i + 3] = 255
        stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1)
      }
      this.ctx.putImageData(idata, 0, 0)
    }

    this.canvas.addEventListener('pointerdown', ev => {
      ev.preventDefault()
      const p = pos(ev)
      opts.onFocus()
      if (this.tool === 'fill') {
        floodFill(p.x, p.y)
        btnUndo.disabled = this.undoStack.length === 0
        return
      }
      this.pushPaintUndo()
      this.canvas.setPointerCapture(ev.pointerId)
      this.painting = true
      if (this.tool === 'line') {
        this.lineStart = p
        this.last = p
        return
      }
      this.last = p
      prepStroke()
      this.ctx.beginPath()
      this.ctx.arc(p.x, p.y, lw() / 2, 0, Math.PI * 2)
      this.ctx.fill()
    })

    this.canvas.addEventListener('pointermove', ev => {
      if (!this.painting) return
      const p = pos(ev)
      if (this.tool === 'line') return
      if (this.last) drawSegment(this.last.x, this.last.y, p.x, p.y)
      this.last = p
    })

    const end = (ev: PointerEvent): void => {
      if (!this.painting) return
      if (this.tool === 'line' && this.lineStart) {
        const p = pos(ev)
        drawSegment(this.lineStart.x, this.lineStart.y, p.x, p.y)
      }
      this.painting = false
      this.last = null
      this.lineStart = null
      btnUndo.disabled = this.undoStack.length === 0
    }
    this.canvas.addEventListener('pointerup', end)
    this.canvas.addEventListener('pointercancel', end)

    const bumpSize = (delta: number): void => {
      const n = Math.min(36, Math.max(1, parseInt(size.value, 10) + delta))
      size.value = String(n)
    }
    this.canvas.addEventListener('keydown', ev => {
      if (ev.code === 'BracketRight') {
        bumpSize(2)
        ev.preventDefault()
      } else if (ev.code === 'BracketLeft') {
        bumpSize(-2)
        ev.preventDefault()
      }
    })
  }

  private canvasBgCss(): string {
    return getComputedStyle(this.canvas).getPropertyValue('--paint-bg').trim() || '#181825'
  }

  private pushPaintUndo(): void {
    const w = this.canvas.width
    const h = this.canvas.height
    if (w < 1 || h < 1) return
    try {
      const snap = this.ctx.getImageData(0, 0, w, h)
      this.undoStack.push(snap)
      while (this.undoStack.length > PaintWindow.UNDO_CAP) this.undoStack.shift()
    } catch {
      /* ignore quota / tainted */
    }
  }

  private popPaintUndo(): void {
    const prev = this.undoStack.pop()
    if (!prev) return
    const w = this.canvas.width
    const h = this.canvas.height
    if (prev.width !== w || prev.height !== h) return
    try {
      this.ctx.putImageData(prev, 0, 0)
    } catch {
      /* ignore */
    }
  }

  focusCanvas(): void {
    this.canvas.focus()
  }

  setActive(active: boolean): void {
    this.el.classList.toggle('active', active)
  }

  setMinimized(min: boolean): void {
    this.el.classList.toggle('minimized', min)
  }

  scrollBy(delta: number): void {
    this.wrap.scrollBy({ top: delta, behavior: 'smooth' })
  }

  isMaximized(): boolean {
    return this.el.classList.contains('maximized')
  }
}
