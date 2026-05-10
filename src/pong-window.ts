// ── pong-window.ts ────────────────────────────────────────────────────────────
// vs CPU (default) or local two-player — W/S vs ↑/↓

export interface PongWindowOptions {
  onClose: () => void
  onMinimize: () => void
  onMaximize: () => void
  onFocus: () => void
}

export type PongMode = 'cpu' | 'p2'

export class PongWindow {
  readonly el: HTMLElement
  readonly command = 'pong' as const
  readonly onFocus: () => void

  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private wrap: HTMLElement
  private modeSelect: HTMLSelectElement
  private hintEl: HTMLElement
  private scoreBoard!: HTMLElement

  private alive = true
  private raf: number | null = null

  private mode: PongMode = 'cpu'
  private w = 640
  private h = 360
  private paddleH = 56
  private paddleW = 10
  private ball = { x: 320, y: 180, vx: 4.2, vy: 2.1 }
  private leftY = 160
  private rightY = 160
  /** Normalized: 'w','s','ArrowUp','ArrowDown' */
  private keys = new Set<string>()
  private scoreL = 0
  private scoreR = 0

  /** Prefer `code` so W/S work regardless of OS layout / `key` quirks */
  private keyNorm(ev: KeyboardEvent): string | null {
    switch (ev.code) {
      case 'ArrowUp':
        return 'ArrowUp'
      case 'ArrowDown':
        return 'ArrowDown'
      case 'KeyW':
        return 'w'
      case 'KeyS':
        return 's'
      default:
        return null
    }
  }

  private onClose: () => void
  private onMinimize: () => void
  private onMaximize: () => void

  constructor(opts: PongWindowOptions) {
    this.onClose = opts.onClose
    this.onMinimize = opts.onMinimize
    this.onMaximize = opts.onMaximize
    this.onFocus = opts.onFocus

    this.el = document.createElement('div')
    this.el.className = 'app-window content-window pong-app'
    this.el.tabIndex = -1

    const bar = document.createElement('div')
    bar.className = 'win-titlebar'
    bar.innerHTML = `
      <div class="win-title-left">
        <span class="win-title">pong</span>
      </div>
      <div class="win-traffic">
        <span class="dot dot-min" title="minimize (ctrl+m)"></span>
        <span class="dot dot-max" title="maximize / restore (ctrl+f)"></span>
        <span class="dot dot-close" title="close (ctrl+q)"></span>
      </div>
    `
    bar.querySelector('.dot-close')!.addEventListener('click', e => {
      e.stopPropagation()
      this.dispose()
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
    hud.className = 'pong-hud'

    this.scoreBoard = document.createElement('div')
    this.scoreBoard.className = 'pong-score'
    this.scoreBoard.textContent = '0 — 0'

    this.modeSelect = document.createElement('select')
    this.modeSelect.className = 'pong-mode'
    this.modeSelect.innerHTML = `
      <option value="cpu">vs computer</option>
      <option value="p2">two players</option>
    `
    this.modeSelect.addEventListener('change', () => {
      this.mode = this.modeSelect.value as PongMode
      this.syncHint()
      this.resetBall(true)
    })

    this.hintEl = document.createElement('div')
    this.hintEl.className = 'pong-hint'
    this.syncHint()

    hud.append(this.scoreBoard, this.modeSelect, this.hintEl)

    this.wrap = document.createElement('div')
    this.wrap.className = 'pong-canvas-wrap'

    this.canvas = document.createElement('canvas')
    this.canvas.width = this.w
    this.canvas.height = this.h
    const g = this.canvas.getContext('2d')
    if (!g) throw new Error('2d')
    this.ctx = g

    this.wrap.appendChild(this.canvas)

    const stack = document.createElement('div')
    stack.className = 'pong-stack'
    stack.appendChild(hud)
    stack.appendChild(this.wrap)

    this.el.appendChild(bar)
    this.el.appendChild(stack)

    const kd = (e: KeyboardEvent): void => {
      const nk = this.keyNorm(e)
      if (!nk) return
      e.preventDefault()
      this.keys.add(nk)
    }
    const ku = (e: KeyboardEvent): void => {
      const nk = this.keyNorm(e)
      if (!nk) return
      this.keys.delete(nk)
    }
    this.el.addEventListener('keydown', kd, true)
    this.el.addEventListener('keyup', ku, true)

    this.canvas.tabIndex = 0
    this.canvas.addEventListener('keydown', kd, true)
    this.canvas.addEventListener('keyup', ku, true)

    this.el.addEventListener('mousedown', () => opts.onFocus())
    bar.addEventListener('mousedown', () => opts.onFocus())
    this.wrap.addEventListener('mousedown', () => {
      opts.onFocus()
      this.canvas.focus()
    })

    this.loop = this.loop.bind(this)
    this.raf = requestAnimationFrame(this.loop)
  }

  /** Predict impact Y on the right edge; move with bounded speed and slight human error. */
  private aiRightPaddle(pad: number, maxY: number): number {
    const rx = this.w - pad - this.paddleW
    let target = this.h / 2 - this.paddleH / 2
    if (this.ball.vx > 0) {
      let x = this.ball.x
      let y = this.ball.y
      let vx = this.ball.vx
      let vy = this.ball.vy
      for (let i = 0; i < 500; i++) {
        if (x >= rx - 6) {
          target = y - this.paddleH / 2
          break
        }
        x += vx
        y += vy
        if (y < 10 || y > this.h - 10) vy *= -1
      }
    } else {
      target = this.h / 2 - this.paddleH / 2 + Math.sin(performance.now() / 850) * 20
    }
    const err = target - this.rightY
    const urgency = Math.min(1, Math.abs(this.ball.vx) / 7)
    const maxStep = 4.8 + urgency * 7
    let next = this.rightY + Math.sign(err) * Math.min(Math.abs(err), maxStep)
    if (Math.abs(err) < 4 && Math.abs(this.ball.vx) > 5)
      next += (Math.random() - 0.5) * 2.8 * (1 - urgency * 0.85)
    return Math.max(pad, Math.min(maxY, next))
  }

  private syncHint(): void {
    this.hintEl.textContent =
      this.mode === 'cpu'
        ? 'You: W / S · Computer: right paddle'
        : 'Left: W/S · Right: ↑ / ↓'
  }

  private resetBall(center = false): void {
    this.ball.x = this.w / 2
    this.ball.y = this.h / 2
    const spd = 4 + Math.random() * 1.5
    const ang = (Math.random() * 0.6 + 0.2) * Math.PI
    const dir = Math.random() > 0.5 ? 1 : -1
    this.ball.vx = Math.cos(ang) * spd * dir
    this.ball.vy = (Math.sin(ang) * spd * (Math.random() > 0.5 ? 1 : -1))
    if (center) {
      this.leftY = this.h / 2 - this.paddleH / 2
      this.rightY = this.leftY
    }
  }

  private loop(): void {
    if (!this.alive) return
    if (this.el.classList.contains('minimized')) {
      this.raf = requestAnimationFrame(this.loop)
      return
    }

    const pad = 24
    const maxY = this.h - this.paddleH - pad
    const paddleSpeed = 9.5

    if (this.keys.has('w')) this.leftY = Math.max(pad, this.leftY - paddleSpeed)
    if (this.keys.has('s')) this.leftY = Math.min(maxY, this.leftY + paddleSpeed)

    if (this.mode === 'p2') {
      if (this.keys.has('ArrowUp')) this.rightY = Math.max(pad, this.rightY - paddleSpeed)
      if (this.keys.has('ArrowDown')) this.rightY = Math.min(maxY, this.rightY + paddleSpeed)
    } else {
      this.rightY = this.aiRightPaddle(pad, maxY)
    }

    this.ball.x += this.ball.vx
    this.ball.y += this.ball.vy

    if (this.ball.y < 10 || this.ball.y > this.h - 10) this.ball.vy *= -1

    const lx = pad
    const rx = this.w - pad - this.paddleW

    if (
      this.ball.vx < 0 &&
      this.ball.x < lx + this.paddleW &&
      this.ball.y > this.leftY &&
      this.ball.y < this.leftY + this.paddleH
    ) {
      this.ball.vx *= -1.05
      this.ball.x = lx + this.paddleW + 1
    }
    if (
      this.ball.vx > 0 &&
      this.ball.x > rx - 8 &&
      this.ball.y > this.rightY &&
      this.ball.y < this.rightY + this.paddleH
    ) {
      this.ball.vx *= -1.05
      this.ball.x = rx - 8
    }

    if (this.ball.x < 0) {
      this.scoreR++
      this.updateScore()
      this.resetBall()
    } else if (this.ball.x > this.w) {
      this.scoreL++
      this.updateScore()
      this.resetBall()
    }

    const accent = getComputedStyle(this.canvas).getPropertyValue('--th-accent').trim() || '#cba6f7'
    const dim = getComputedStyle(this.canvas).getPropertyValue('--th-text-muted').trim() || '#6c7086'
    const bg = getComputedStyle(this.canvas).getPropertyValue('--th-base').trim() || '#11111b'

    this.ctx.fillStyle = bg
    this.ctx.fillRect(0, 0, this.w, this.h)

    this.ctx.strokeStyle = dim
    this.ctx.setLineDash([6, 10])
    this.ctx.beginPath()
    this.ctx.moveTo(this.w / 2, 0)
    this.ctx.lineTo(this.w / 2, this.h)
    this.ctx.stroke()
    this.ctx.setLineDash([])

    this.ctx.fillStyle = accent
    this.ctx.fillRect(lx, this.leftY, this.paddleW, this.paddleH)
    this.ctx.fillRect(rx, this.rightY, this.paddleW, this.paddleH)

    this.ctx.beginPath()
    this.ctx.arc(this.ball.x, this.ball.y, 7, 0, Math.PI * 2)
    this.ctx.fill()

    this.raf = requestAnimationFrame(this.loop)
  }

  private updateScore(): void {
    this.scoreBoard.textContent = `${this.scoreL} — ${this.scoreR}`
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

  dispose(): void {
    this.alive = false
    if (this.raf != null) cancelAnimationFrame(this.raf)
    this.raf = null
  }
}
