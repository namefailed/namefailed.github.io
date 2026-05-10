// ── snake-window.ts ───────────────────────────────────────────────────────────

export interface SnakeWindowOptions {
  onClose: () => void
  onMinimize: () => void
  onMaximize: () => void
  onFocus: () => void
}

/** Slightly slower game loop — tune feel vs `pendingDir` latency */
const TICK_MS = 96

export class SnakeWindow {
  readonly el: HTMLElement
  readonly command = 'snake' as const
  readonly onFocus: () => void

  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private wrap: HTMLElement
  private scoreEl: HTMLElement
  private alive = true
  private timer: number | null = null

  private cols = 20
  private rows = 15
  private snake: { x: number; y: number }[] = []
  private dir: { x: number; y: number } = { x: 1, y: 0 }
  private pendingDir: { x: number; y: number } | null = null
  private food = { x: 5, y: 5 }
  private score = 0

  private onClose: () => void
  private onMinimize: () => void
  private onMaximize: () => void

  constructor(opts: SnakeWindowOptions) {
    this.onClose = opts.onClose
    this.onMinimize = opts.onMinimize
    this.onMaximize = opts.onMaximize
    this.onFocus = opts.onFocus

    this.el = document.createElement('div')
    this.el.className = 'app-window content-window snake-app'
    this.el.tabIndex = -1

    const bar = document.createElement('div')
    bar.className = 'win-titlebar'
    bar.innerHTML = `
      <div class="win-title-left">
        <span class="win-title">snake</span>
      </div>
      <div class="win-traffic">
        <span class="dot dot-min" title="minimize (ctrl+m)"></span>
        <span class="dot dot-max" title="maximize / restore (ctrl+f)"></span>
        <span class="dot dot-close" title="close (ctrl+q)"></span>
      </div>
    `
    bar.querySelector('.dot-close')!.addEventListener('click', e => {
      e.stopPropagation()
      this.stopLoop()
      this.onClose()
    })
    bar.querySelector('.dot-min')!.addEventListener('click', e => {
      e.stopPropagation()
      this.onMinimize()
    })
    bar.querySelector('.dot-max')!.addEventListener('click', e => {
      e.stopPropagation()
      this.onMaximize()
    })

    const hud = document.createElement('div')
    hud.className = 'snake-hud'
    this.scoreEl = document.createElement('span')
    this.scoreEl.className = 'snake-score'
    this.scoreEl.textContent = 'Score · 0'
    const hint = document.createElement('span')
    hint.className = 'snake-hint'
    hint.textContent = 'Arrows · WASD · Space restart'
    hud.append(this.scoreEl, hint)

    this.wrap = document.createElement('div')
    this.wrap.className = 'snake-canvas-wrap'

    this.canvas = document.createElement('canvas')
    this.canvas.className = 'snake-canvas'
    this.canvas.tabIndex = 0
    const g = this.canvas.getContext('2d')
    if (!g) throw new Error('2d')
    this.ctx = g

    this.wrap.appendChild(this.canvas)

    const stack = document.createElement('div')
    stack.className = 'snake-stack'
    stack.appendChild(hud)
    stack.appendChild(this.wrap)

    this.el.appendChild(bar)
    this.el.appendChild(stack)

    this.resetGame()

    const ro = new ResizeObserver(() => this.draw())
    ro.observe(this.wrap)

    this.el.addEventListener('keydown', e => this.onKey(e), true)

    this.el.addEventListener('mousedown', () => opts.onFocus())
    bar.addEventListener('mousedown', () => opts.onFocus())
  }

  private stopLoop(): void {
    this.alive = false
    if (this.timer != null) {
      window.clearInterval(this.timer)
      this.timer = null
    }
  }

  private resetGame(): void {
    this.snake = [
      { x: 4, y: 7 },
      { x: 3, y: 7 },
      { x: 2, y: 7 },
    ]
    this.dir = { x: 1, y: 0 }
    this.pendingDir = null
    this.score = 0
    this.scoreEl.textContent = 'Score · 0'
    this.placeFood()
    if (this.timer != null) window.clearInterval(this.timer)
    this.alive = true
    this.timer = window.setInterval(() => this.tick(), TICK_MS)
    this.draw()
  }

  private placeFood(): void {
    let ok = false
    while (!ok) {
      this.food = {
        x: Math.floor(Math.random() * this.cols),
        y: Math.floor(Math.random() * this.rows),
      }
      ok = !this.snake.some(s => s.x === this.food.x && s.y === this.food.y)
    }
  }

  private onKey(ev: KeyboardEvent): void {
    if (ev.code === 'Space') {
      ev.preventDefault()
      ev.stopPropagation()
      this.resetGame()
      return
    }
    let nx = 0
    let ny = 0
    switch (ev.code) {
      case 'ArrowUp':
      case 'KeyW':
        nx = 0
        ny = -1
        break
      case 'ArrowDown':
      case 'KeyS':
        nx = 0
        ny = 1
        break
      case 'ArrowLeft':
      case 'KeyA':
        nx = -1
        ny = 0
        break
      case 'ArrowRight':
      case 'KeyD':
        nx = 1
        ny = 0
        break
      default:
        return
    }
    ev.preventDefault()
    ev.stopPropagation()
    if (nx === -this.dir.x && ny === -this.dir.y) return
    this.pendingDir = { x: nx, y: ny }
  }

  private tick(): void {
    if (!this.alive) return
    if (this.el.classList.contains('minimized')) return
    if (this.pendingDir) {
      this.dir = this.pendingDir
      this.pendingDir = null
    }
    const head = this.snake[0]!
    const nh = { x: head.x + this.dir.x, y: head.y + this.dir.y }
    if (nh.x < 0 || nh.x >= this.cols || nh.y < 0 || nh.y >= this.rows) {
      this.gameOver()
      return
    }
    if (this.snake.some(s => s.x === nh.x && s.y === nh.y)) {
      this.gameOver()
      return
    }
    this.snake.unshift(nh)
    if (nh.x === this.food.x && nh.y === this.food.y) {
      this.score++
      this.scoreEl.textContent = `Score · ${this.score}`
      this.placeFood()
    } else {
      this.snake.pop()
    }
    this.draw()
  }

  private gameOver(): void {
    if (this.timer != null) window.clearInterval(this.timer)
    this.timer = null
    this.ctx.save()
    this.ctx.fillStyle = 'rgba(0,0,0,0.55)'
    const r = this.canvas.getBoundingClientRect()
    this.ctx.fillRect(0, 0, r.width, r.height)
    this.ctx.fillStyle = getComputedStyle(this.canvas).color || '#cdd6f4'
    this.ctx.font = 'bold 18px system-ui,sans-serif'
    this.ctx.textAlign = 'center'
    this.ctx.fillText('Game over — Space to restart', r.width / 2, r.height / 2)
    this.ctx.restore()
  }

  private draw(): void {
    const r = this.wrap.getBoundingClientRect()
    const cw = Math.max(120, r.width)
    const ch = Math.max(120, r.height)
    const cs = Math.floor(Math.min(cw / this.cols, ch / this.rows))
    const gw = cs * this.cols
    const gh = cs * this.rows
    this.canvas.width = gw
    this.canvas.height = gh
    this.canvas.style.width = `${gw}px`
    this.canvas.style.height = `${gh}px`

    const bg = getComputedStyle(this.canvas).getPropertyValue('--snake-bg').trim() || '#11111b'
    const fg = getComputedStyle(this.canvas).getPropertyValue('--snake-fg').trim() || '#a6e3a1'
    const fd = getComputedStyle(this.canvas).getPropertyValue('--snake-food').trim() || '#f38ba8'

    this.ctx.fillStyle = bg
    this.ctx.fillRect(0, 0, gw, gh)

    const pad = Math.max(1, Math.floor(cs * 0.14))
    const rad = Math.max(2, Math.floor(cs * 0.2))

    const fillCell = (
      gx: number,
      gy: number,
      inset: number,
      fillStyle: string,
      alpha = 1,
      corner = rad,
    ): void => {
      this.ctx.fillStyle = fillStyle
      this.ctx.globalAlpha = alpha
      const x = gx * cs + inset
      const y = gy * cs + inset
      const w = cs - inset * 2
      const h = cs - inset * 2
      if (typeof this.ctx.roundRect === 'function') {
        this.ctx.beginPath()
        this.ctx.roundRect(x, y, w, h, corner)
        this.ctx.fill()
      } else {
        this.ctx.fillRect(x, y, w, h)
      }
      this.ctx.globalAlpha = 1
    }

    fillCell(this.food.x, this.food.y, pad, fd)

    for (let i = 0; i < this.snake.length; i++) {
      const s = this.snake[i]!
      const head = i === 0
      const inset = head ? pad : pad + 1
      fillCell(s.x, s.y, inset, fg, head ? 1 : 0.9, head ? rad : Math.max(1, rad - 1))
    }

    this.ctx.strokeStyle = 'rgba(255,255,255,0.06)'
    this.ctx.lineWidth = 1
    for (let x = 0; x <= this.cols; x++) {
      this.ctx.beginPath()
      this.ctx.moveTo(x * cs, 0)
      this.ctx.lineTo(x * cs, gh)
      this.ctx.stroke()
    }
    for (let y = 0; y <= this.rows; y++) {
      this.ctx.beginPath()
      this.ctx.moveTo(0, y * cs)
      this.ctx.lineTo(gw, y * cs)
      this.ctx.stroke()
    }
  }

  focusCanvas(): void {
    this.el.focus()
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

  dispose(): void {
    this.stopLoop()
  }
}
