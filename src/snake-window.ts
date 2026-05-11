// ── snake-window.ts ───────────────────────────────────────────────────────────

export interface SnakeWindowOptions {
  onClose: () => void
  onMinimize: () => void
  onMaximize: () => void
  onFocus: () => void
}

/** Game tick cadence — slightly slower reads friendlier under terminal focus */
const TICK_MS = 94

export class SnakeWindow {
  readonly el: HTMLElement
  readonly command = 'snake' as const
  readonly onFocus: () => void

  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private wrap: HTMLElement
  private scoreEl: HTMLElement
  private timer: number | null = null
  /** True while the simulation interval is armed (playing or paused-draw only) */
  private playing = false
  /** Separate from playing — survives until next reset */
  private gameOverActive = false

  private cols = 20
  private rows = 15
  private snake: { x: number; y: number }[] = []
  private dir: { x: number; y: number } = { x: 1, y: 0 }
  private pendingDir: { x: number; y: number } | null = null
  private food = { x: 5, y: 5 }
  private score = 0
  /** Food shimmer phase (advance each tick + draw) */
  private foodPhase = 0

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
    this.scoreEl.textContent = '0'
    this.scoreEl.setAttribute('aria-label', 'score')
    const scoreLabel = document.createElement('span')
    scoreLabel.className = 'snake-score-label'
    scoreLabel.textContent = 'score'
    const hint = document.createElement('span')
    hint.className = 'snake-hint'
    hint.textContent = 'arrows · wasd · space restart'
    hud.append(scoreLabel, this.scoreEl, hint)

    this.wrap = document.createElement('div')
    this.wrap.className = 'snake-canvas-wrap'

    this.canvas = document.createElement('canvas')
    this.canvas.className = 'snake-canvas'
    this.canvas.tabIndex = 0
    this.canvas.setAttribute('role', 'img')
    this.canvas.setAttribute(
      'aria-label',
      'Snake playfield · green snake, eat pink fruit · arrow keys',
    )

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
    this.playing = false
    if (this.timer != null) {
      window.clearInterval(this.timer)
      this.timer = null
    }
  }

  private resetGame(): void {
    this.stopLoop()
    this.gameOverActive = false
    this.snake = [
      { x: 4, y: 7 },
      { x: 3, y: 7 },
      { x: 2, y: 7 },
    ]
    this.dir = { x: 1, y: 0 }
    this.pendingDir = null
    this.score = 0
    this.scoreEl.textContent = '0'
    this.foodPhase = 0
    this.placeFood()
    this.playing = true
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
    if (this.gameOverActive) return

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
    if (!this.playing) return
    if (this.el.classList.contains('minimized')) return
    this.foodPhase += 0.11

    if (this.pendingDir) {
      this.dir = this.pendingDir
      this.pendingDir = null
    }
    const head = this.snake[0]!
    const nh = { x: head.x + this.dir.x, y: head.y + this.dir.y }
    if (nh.x < 0 || nh.x >= this.cols || nh.y < 0 || nh.y >= this.rows) {
      this.enterGameOver()
      return
    }
    if (this.snake.some(s => s.x === nh.x && s.y === nh.y)) {
      this.enterGameOver()
      return
    }
    this.snake.unshift(nh)
    if (nh.x === this.food.x && nh.y === this.food.y) {
      this.score++
      this.scoreEl.textContent = String(this.score)
      this.placeFood()
    } else {
      this.snake.pop()
    }
    this.draw()
  }

  private enterGameOver(): void {
    if (this.timer != null) {
      window.clearInterval(this.timer)
      this.timer = null
    }
    this.playing = false
    this.gameOverActive = true
    this.draw()
  }

  /** Cell center in pixel space */
  private cc(x: number, y: number, cs: number): { ox: number; oy: number } {
    return { ox: x * cs + cs * 0.5, oy: y * cs + cs * 0.5 }
  }

  private buildSnakePath(cs: number, gw: number, gh: number): Path2D {
    const p = new Path2D()
    if (this.snake.length === 0) return p
    const { ox, oy } = this.cc(this.snake[0]!.x, this.snake[0]!.y, cs)
    const oxClamp = Math.min(gw - 1, Math.max(1, ox))
    const oyClamp = Math.min(gh - 1, Math.max(1, oy))
    p.moveTo(oxClamp, oyClamp)
    for (let i = 1; i < this.snake.length; i++) {
      const c = this.cc(this.snake[i]!.x, this.snake[i]!.y, cs)
      p.lineTo(Math.min(gw - 1, Math.max(1, c.ox)), Math.min(gh - 1, Math.max(1, c.oy)))
    }
    return p
  }

  private cssColor(key: string, fallback: string): string {
    const v = getComputedStyle(this.canvas).getPropertyValue(key).trim()
    return v || fallback
  }

  private draw(): void {
    const r = this.wrap.getBoundingClientRect()
    const cw = Math.max(120, r.width)
    const ch = Math.max(120, r.height)
    const cs = Math.floor(Math.min(cw / this.cols, ch / this.rows))
    const gw = cs * this.cols
    const gh = cs * this.rows

    const dpr = Math.min(2.25, window.devicePixelRatio || 1)
    this.canvas.width = Math.floor(gw * dpr)
    this.canvas.height = Math.floor(gh * dpr)
    this.canvas.style.width = `${gw}px`
    this.canvas.style.height = `${gh}px`
    const ctx = this.ctx
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const bg0 = this.cssColor('--snake-bg-a', '#0c0d12')
    const bg1 = this.cssColor('--snake-bg-b', '#13151e')
    const body = this.cssColor('--snake-fg', '#a6e3a1')
    const bodyMid = this.cssColor('--snake-fg-mid', '#7abf8f')
    const outline = this.cssColor('--snake-outline', '#1a3d29')
    const headFill = this.cssColor('--snake-head', '#b8efc2')
    const food = this.cssColor('--snake-food', '#f38ba8')
    const foodHot = this.cssColor('--snake-food-hot', '#ffeefb')
    const grid = this.cssColor('--snake-grid', 'rgba(148,156,212,0.06)')

    const gLin = ctx.createLinearGradient(0, 0, gw, gh)
    gLin.addColorStop(0, bg0)
    gLin.addColorStop(1, bg1)
    ctx.fillStyle = gLin
    ctx.fillRect(0, 0, gw, gh)

    // Subtle vignette corners
    const vig = ctx.createRadialGradient(gw * 0.5, gh * 0.45, cs * 1.5, gw * 0.5, gh * 0.5, Math.hypot(gw, gh) * 0.72)
    vig.addColorStop(0, 'rgba(15,17,26,0)')
    vig.addColorStop(1, 'rgba(8,8,14,0.55)')
    ctx.fillStyle = vig
    ctx.fillRect(0, 0, gw, gh)

    // Grid dots (lighter than stroked lines — less cafeteria-table)
    ctx.fillStyle = grid
    const stepDots = cs >= 28 ? 1 : cs >= 20 ? 2 : 3
    for (let gy = stepDots; gy < this.rows; gy += stepDots) {
      for (let gx = stepDots; gx < this.cols; gx += stepDots) {
        const cx = gx * cs
        const cy = gy * cs
        ctx.beginPath()
        ctx.arc(cx + cs * 0.12, cy + cs * 0.12, 0.85, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    const path = this.buildSnakePath(cs, gw, gh)
    const thick = cs * 0.78

    if (this.snake.length >= 1) {
      ctx.save()

      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'

      ctx.shadowColor = 'rgba(138,243,173,0.35)'
      ctx.shadowBlur = cs * 0.42
      ctx.strokeStyle = outline
      ctx.lineWidth = thick + cs * 0.06
      ctx.stroke(path)

      ctx.shadowBlur = 0

      const gBody = ctx.createLinearGradient(0, 0, gw, gh)
      gBody.addColorStop(0, headFill)
      gBody.addColorStop(0.45, body)
      gBody.addColorStop(1, bodyMid)

      ctx.strokeStyle = outline
      ctx.lineWidth = thick + cs * 0.035
      ctx.stroke(path)

      ctx.strokeStyle = gBody
      ctx.lineWidth = thick
      ctx.stroke(path)

      ctx.restore()

      // Head capsule + eyes
      const hd = this.snake[0]!
      const { ox: hx, oy: hy } = this.cc(hd.x, hd.y, cs)
      const headR = cs * 0.44

      ctx.save()
      const headGrad = ctx.createRadialGradient(hx - headR * 0.35, hy - headR * 0.35, cs * 0.05, hx, hy, headR + 2)
      headGrad.addColorStop(0, headFill)
      headGrad.addColorStop(1, body)
      ctx.fillStyle = headGrad
      ctx.beginPath()
      ctx.arc(hx, hy, headR, 0, Math.PI * 2)
      ctx.fill()

      ctx.lineWidth = 1.25
      ctx.strokeStyle = 'rgba(26,61,41,0.55)'
      ctx.stroke()

      // Eyes (sit slightly forward relative to velocity)
      const ex = Math.max(-1, Math.min(1, this.dir.x)) * cs * 0.06
      const ey = Math.max(-1, Math.min(1, this.dir.y)) * cs * 0.06
      const perp = this.dir.x === 0 ? { px: cs * 0.15, py: 0 } : { px: 0, py: cs * 0.15 }
      const eBaseX = hx + ex
      const eBaseY = hy + ey

      const eyeR = cs * 0.11
      for (const sgn of [-1, 1] as const) {
        ctx.fillStyle = 'rgba(255,253,246,0.96)'
        ctx.beginPath()
        ctx.arc(eBaseX + perp.px * sgn, eBaseY + perp.py * sgn, eyeR, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = 'rgba(26,42,52,0.92)'
        ctx.beginPath()
        ctx.arc(eBaseX + perp.px * sgn + ex * 0.15, eBaseY + perp.py * sgn + ey * 0.15, eyeR * 0.38, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    }

    // Fruit
    const { ox: fx, oy: fy } = this.cc(this.food.x, this.food.y, cs)
    const pulse = (Math.sin(this.foodPhase) + 1) * 0.5
    const fr = cs * (0.32 + pulse * 0.05)

    ctx.save()
    ctx.shadowColor = 'rgba(243,139,168,0.55)'
    ctx.shadowBlur = cs * (0.35 + pulse * 0.2)

    const fGrad = ctx.createRadialGradient(fx - fr * 0.35, fy - fr * 0.4, cs * 0.02, fx, fy, fr * 1.25)
    fGrad.addColorStop(0, foodHot)
    fGrad.addColorStop(0.45, food)
    fGrad.addColorStop(1, '#7a2942')

    ctx.fillStyle = fGrad
    ctx.beginPath()
    ctx.arc(fx, fy, fr, 0, Math.PI * 2)
    ctx.fill()
    ctx.lineWidth = 1.25
    ctx.strokeStyle = 'rgba(94,42,61,0.45)'
    ctx.stroke()
    ctx.restore()

    // Game overlay
    if (this.gameOverActive) {
      ctx.save()
      ctx.fillStyle = 'rgba(5,7,14,0.58)'
      ctx.fillRect(0, 0, gw, gh)

      ctx.strokeStyle = 'rgba(245,194,231,0.22)'
      ctx.lineWidth = 1
      const mx = gw * 0.5
      const my = gh * 0.42
      const bw = Math.min(gw * 0.72, 320)
      const bh = gh * 0.28
      ctx.beginPath()
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(mx - bw * 0.5, my - bh * 0.5 - cs * 0.2, bw, bh, 10)
      } else ctx.rect(mx - bw * 0.5, my - bh * 0.5 - cs * 0.2, bw, bh)
      ctx.stroke()

      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = this.cssColor('--snake-msg', '#e8eaf6')
      ctx.font = `600 ${Math.max(15, cs * 0.46)}px "JetBrains Mono", ui-monospace, system-ui`
      ctx.fillText('game over', mx, my - cs * 0.06)
      ctx.fillStyle = 'rgba(214,217,239,0.68)'
      ctx.font = `${Math.max(11, cs * 0.28)}px "JetBrains Mono", ui-monospace, system-ui`
      ctx.fillText('space · restart          score ' + String(this.score), mx, my + cs * 0.44)
      ctx.restore()
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
