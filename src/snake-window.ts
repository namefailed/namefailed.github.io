/** Full-tile Snake with adaptive difficulty, pickups, HUD. */

import { createWindowChrome } from './window-chrome'
import { createCssVarCache, type CssVarCache } from './css-var-cache'

export interface SnakeWindowOptions {
  onClose: () => void
  onMinimize: () => void
  onMaximize: () => void
  onFocus: () => void
}

/** Larger target cell ⇒ fewer columns/rows ⇒ bigger snake & orbs (more “zoomed in”). */
const TARGET_CELL = 24
const MIN_COLS = 12
const MIN_ROWS = 10
const BASE_TICK_MS = 82
const MIN_TICK_MS = 34
const LENGTH_SPEED_STEP = 2.1 /** ms faster per segment beyond starter length */

type PowerKind = 'ghost' | 'gem' | 'trim' | 'growth'

/**
 * Keep a Snake round alive across a grid resize: return the head plus the
 * contiguous run of body segments that still fit the new bounds. Returns null
 * when the head itself no longer fits (the round can't continue). The score is
 * untouched — only the body may shorten.
 */
export function reflowSnakeIntoGrid(
  snake: ReadonlyArray<{ x: number; y: number }>,
  cols: number,
  rows: number,
): { x: number; y: number }[] | null {
  const inBounds = (c: { x: number; y: number }): boolean =>
    c.x >= 0 && c.x < cols && c.y >= 0 && c.y < rows
  const head = snake[0]
  if (!head || !inBounds(head)) return null
  const kept: { x: number; y: number }[] = []
  for (const seg of snake) {
    if (!inBounds(seg)) break
    kept.push({ x: seg.x, y: seg.y })
  }
  return kept
}

/**
 * Snake tile. One instance per open; the grid tracks the window size, and a
 * resize mid-game re-fits the snake into the new bounds rather than wiping the
 * score. `dispose()` stops the tick loop and the resize observer.
 */
export class SnakeWindow {
  readonly el: HTMLElement
  readonly command = 'snake' as const
  readonly onFocus: () => void

  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private wrap: HTMLElement
  private scoreEl: HTMLElement
  private lengthEl: HTMLElement
  private btnPause: HTMLButtonElement
  private btnRestart: HTMLButtonElement

  private timer: ReturnType<typeof window.setTimeout> | null = null
  private playing = false
  private disposed = false
  private gameOverActive = false

  private cols = 28
  private rows = 22
  private snake: { x: number; y: number }[] = []
  private dir: { x: number; y: number } = { x: 1, y: 0 }
  private pendingDir: { x: number; y: number } | null = null
  private food = { x: 5, y: 5 }
  private powerup: null | { x: number; y: number; kind: PowerKind } = null
  private score = 0
  private foodPhase = 0
  private powerPhase = 0
  /** Moves left where self-collision is ignored (ghost orb) */
  private ghostMovesLeft = 0
  /** Extra growth segments to apply on next non-food moves */
  private growDebt = 0

  private ro: ResizeObserver | null = null
  private cssVars: CssVarCache

  private onClose: () => void
  private onMinimize: () => void
  private onMaximize: () => void

  constructor(opts: SnakeWindowOptions) {
    this.onClose = opts.onClose
    this.onMinimize = opts.onMinimize
    this.onMaximize = opts.onMaximize
    this.onFocus = opts.onFocus
    this.cssVars = createCssVarCache(() => this.canvas)

    const chrome = createWindowChrome({
      title: 'snake',
      onClose: () => { this.stopLoop(); this.onClose() },
      onMinimize: () => this.onMinimize(),
      onMaximize: () => this.onMaximize(),
      onFocus: opts.onFocus,
    })
    this.el = chrome.el
    this.el.classList.add('snake-app')
    this.el.tabIndex = -1

    const hud = document.createElement('div')
    hud.className = 'snake-hud'

    const scoreBlock = document.createElement('div')
    scoreBlock.className = 'snake-hud-scoreblock'
    const scoreLabel = document.createElement('span')
    scoreLabel.className = 'snake-score-label'
    scoreLabel.textContent = 'score'
    this.scoreEl = document.createElement('span')
    this.scoreEl.className = 'snake-score'
    this.scoreEl.textContent = '0'
    this.scoreEl.setAttribute('aria-label', 'score')
    const lenLabel = document.createElement('span')
    lenLabel.className = 'snake-score-label snake-score-label--dim'
    lenLabel.textContent = 'len'
    this.lengthEl = document.createElement('span')
    this.lengthEl.className = 'snake-length'
    this.lengthEl.textContent = '3'
    scoreBlock.append(scoreLabel, this.scoreEl, lenLabel, this.lengthEl)

    const hint = document.createElement('span')
    hint.className = 'snake-hint'
    hint.textContent = 'arrows · wasd · fruit · orbs: ghost · gem · trim · growth'

    const tools = document.createElement('div')
    tools.className = 'snake-hud-tools'
    this.btnRestart = document.createElement('button')
    this.btnRestart.type = 'button'
    this.btnRestart.className = 'snake-hud-btn snake-hud-btn--primary'
    this.btnRestart.textContent = 'Restart'
    this.btnRestart.title = 'Restart game (Space)'
    this.btnRestart.addEventListener('click', e => {
      e.stopPropagation()
      this.resetGame()
    })
    this.btnPause = document.createElement('button')
    this.btnPause.type = 'button'
    this.btnPause.className = 'snake-hud-btn'
    this.btnPause.textContent = 'Pause'
    this.btnPause.title = 'Pause / resume (P)'
    this.btnPause.addEventListener('click', e => {
      e.stopPropagation()
      this.togglePause()
    })
    tools.append(this.btnRestart, this.btnPause)

    hud.append(scoreBlock, hint, tools)

    this.wrap = document.createElement('div')
    this.wrap.className = 'snake-canvas-wrap'

    this.canvas = document.createElement('canvas')
    this.canvas.className = 'snake-canvas'
    this.canvas.tabIndex = 0
    this.canvas.setAttribute('role', 'img')
    this.canvas.setAttribute(
      'aria-label',
      'Snake · eat fruit · collect powerups · arrow keys',
    )

    const g = this.canvas.getContext('2d')
    if (!g) throw new Error('2d')
    this.ctx = g

    this.wrap.appendChild(this.canvas)

    const stack = document.createElement('div')
    stack.className = 'snake-stack'
    stack.appendChild(hud)
    stack.appendChild(this.wrap)

    this.el.appendChild(stack)

    this.ro = new ResizeObserver(() => this.onWrapResize())
    this.ro.observe(this.wrap)

    this.el.addEventListener('keydown', e => this.onKey(e), true)

    requestAnimationFrame(() => {
      if (this.disposed) return
      this.syncGridFromWrap()
      this.resetGame()
    })
  }

  private onWrapResize(): void {
    const prevC = this.cols
    const prevR = this.rows
    this.syncGridFromWrap()
    if (this.cols !== prevC || this.rows !== prevR) {
      if (this.playing && !this.gameOverActive) {
        this.reflowIntoGrid()
        return
      }
    }
    this.draw()
  }

  /** Re-fit the snake, food, and powerup after a grid resize without resetting the score. */
  private reflowIntoGrid(): void {
    const kept = reflowSnakeIntoGrid(this.snake, this.cols, this.rows)
    if (!kept) {
      this.enterGameOver()
      return
    }
    this.snake = kept
    this.lengthEl.textContent = String(this.snake.length)
    const inBounds = (c: { x: number; y: number }): boolean =>
      c.x >= 0 && c.x < this.cols && c.y >= 0 && c.y < this.rows
    if (!inBounds(this.food)) this.placeFood()
    if (this.powerup && !inBounds(this.powerup)) this.powerup = null
    this.draw()
  }

  private syncGridFromWrap(): void {
    const cw = Math.max(140, Math.floor(this.wrap.clientWidth || 400))
    const ch = Math.max(140, Math.floor(this.wrap.clientHeight || 320))
    this.cols = Math.max(MIN_COLS, Math.floor(cw / TARGET_CELL))
    this.rows = Math.max(MIN_ROWS, Math.floor(ch / TARGET_CELL))
  }

  private stopLoop(): void {
    this.playing = false
    if (this.timer != null) {
      window.clearTimeout(this.timer)
      this.timer = null
    }
    this.syncPauseButton()
  }

  private getTickMs(): number {
    const extra = Math.max(0, this.snake.length - 3)
    const faster = Math.min(48, extra * LENGTH_SPEED_STEP)
    return Math.max(MIN_TICK_MS, Math.floor(BASE_TICK_MS - faster))
  }

  private scheduleNextTick(): void {
    if (!this.playing || this.gameOverActive) return
    if (this.timer != null) window.clearTimeout(this.timer)
    this.timer = window.setTimeout(() => {
      this.timer = null
      this.tick()
    }, this.getTickMs())
  }

  private togglePause(): void {
    if (this.gameOverActive) return
    if (this.playing) {
      this.stopLoop()
    } else {
      this.playing = true
      this.scheduleNextTick()
    }
    this.draw()
  }

  private syncPauseButton(): void {
    this.btnPause.textContent = this.playing ? 'Pause' : 'Resume'
    this.btnPause.disabled = this.gameOverActive
    this.btnPause.classList.toggle('snake-hud-btn--active', !this.playing && !this.gameOverActive)
  }

  private resetGame(): void {
    if (this.disposed) return
    this.stopLoop()
    this.gameOverActive = false
    this.syncGridFromWrap()
    this.ghostMovesLeft = 0
    this.growDebt = 0
    this.powerup = null

    const midY = Math.floor(this.rows / 2)
    const headX = Math.min(this.cols - 6, Math.max(5, Math.floor(this.cols / 2)))
    this.snake = [
      { x: headX, y: midY },
      { x: headX - 1, y: midY },
      { x: headX - 2, y: midY },
    ]
    this.dir = { x: 1, y: 0 }
    this.pendingDir = null
    this.score = 0
    this.scoreEl.textContent = '0'
    this.lengthEl.textContent = String(this.snake.length)
    this.foodPhase = 0
    this.powerPhase = 0
    this.placeFood()
    this.trySpawnPowerup(0.22)
    this.playing = true
    this.syncPauseButton()
    this.draw()
    requestAnimationFrame(() => {
      if (this.playing && !this.gameOverActive) this.scheduleNextTick()
    })
  }

  private emptyCell(): { x: number; y: number } | null {
    const taken = new Set(this.snake.map(s => `${s.x},${s.y}`))
    taken.add(`${this.food.x},${this.food.y}`)
    if (this.powerup) taken.add(`${this.powerup.x},${this.powerup.y}`)
    const holes: { x: number; y: number }[] = []
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const k = `${x},${y}`
        if (!taken.has(k)) holes.push({ x, y })
      }
    }
    if (!holes.length) return null
    return holes[Math.floor(Math.random() * holes.length)]!
  }

  private placeFood(): void {
    const c = this.emptyCell()
    if (!c) return
    this.food = c
  }

  private trySpawnPowerup(baseChance: number): void {
    if (this.powerup) return
    if (Math.random() > baseChance) return
    const c = this.emptyCell()
    if (!c) return
    const roll = Math.random()
    const kind: PowerKind =
      roll < 0.26 ? 'ghost' : roll < 0.5 ? 'gem' : roll < 0.72 ? 'trim' : 'growth'
    this.powerup = { ...c, kind }
  }

  private onKey(ev: KeyboardEvent): void {
    if (ev.code === 'Space') {
      ev.preventDefault()
      ev.stopPropagation()
      this.resetGame()
      return
    }
    if (ev.code === 'KeyP') {
      ev.preventDefault()
      ev.stopPropagation()
      if (this.gameOverActive) return
      this.togglePause()
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
    if (this.el.classList.contains('minimized')) {
      this.scheduleNextTick()
      return
    }
    this.foodPhase += 0.11
    this.powerPhase += 0.09

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

    const willEatFood = nh.x === this.food.x && nh.y === this.food.y
    const willEatPower = this.powerup && nh.x === this.powerup.x && nh.y === this.powerup.y

    const tail = this.snake[this.snake.length - 1]
    const ignoreTail =
      !willEatFood &&
      !willEatPower &&
      this.growDebt === 0 &&
      tail &&
      nh.x === tail.x &&
      nh.y === tail.y

    const hitSelf =
      !this.ghostMovesLeft &&
      this.snake.some((s, i) => {
        if (s.x !== nh.x || s.y !== nh.y) return false
        if (ignoreTail && i === this.snake.length - 1) return false
        return true
      })

    if (hitSelf) {
      this.enterGameOver()
      return
    }

    this.snake.unshift(nh)
    if (this.ghostMovesLeft > 0) this.ghostMovesLeft--

    if (willEatFood) {
      this.score++
      this.scoreEl.textContent = String(this.score)
      this.placeFood()
      this.trySpawnPowerup(0.12)
    } else if (willEatPower && this.powerup) {
      this.snake.pop()
      const k = this.powerup.kind
      this.powerup = null
      if (k === 'ghost') {
        this.ghostMovesLeft += 16
        this.score += 2
      } else if (k === 'gem') {
        this.score += 6
      } else if (k === 'growth') {
        this.growDebt += 2
        this.score += 1
      } else {
        const cut = Math.min(4, Math.max(0, this.snake.length - 4))
        for (let i = 0; i < cut; i++) this.snake.pop()
      }
      this.scoreEl.textContent = String(this.score)
      this.trySpawnPowerup(0.08)
    } else {
      if (this.growDebt > 0) {
        this.growDebt--
      } else {
        this.snake.pop()
      }
    }

    this.lengthEl.textContent = String(this.snake.length)
    this.draw()
    if (this.playing && !this.gameOverActive) this.scheduleNextTick()
  }

  private enterGameOver(): void {
    if (this.timer != null) {
      window.clearTimeout(this.timer)
      this.timer = null
    }
    this.playing = false
    this.gameOverActive = true
    this.syncPauseButton()
    this.draw()
  }

  private cellCenter(x: number, y: number, cs: number): { ox: number; oy: number } {
    return { ox: x * cs + cs * 0.5, oy: y * cs + cs * 0.5 }
  }

  private buildSnakePath(cs: number, gw: number, gh: number): Path2D {
    const p = new Path2D()
    if (this.snake.length === 0) return p
    const { ox, oy } = this.cellCenter(this.snake[0]!.x, this.snake[0]!.y, cs)
    const oxClamp = Math.min(gw - 1, Math.max(1, ox))
    const oyClamp = Math.min(gh - 1, Math.max(1, oy))
    p.moveTo(oxClamp, oyClamp)
    for (let i = 1; i < this.snake.length; i++) {
      const c = this.cellCenter(this.snake[i]!.x, this.snake[i]!.y, cs)
      p.lineTo(Math.min(gw - 1, Math.max(1, c.ox)), Math.min(gh - 1, Math.max(1, c.oy)))
    }
    return p
  }

  private themeColor(key: string, fallback: string): string {
    return this.cssVars.get(key, fallback)
  }

  private draw(): void {
    this.syncGridFromWrap()
    const r = this.wrap.getBoundingClientRect()
    const cw = Math.max(120, Math.floor(r.width))
    const ch = Math.max(120, Math.floor(r.height))
    const cs = Math.min(cw / this.cols, ch / this.rows)
    const gw = this.cols * cs
    const gh = this.rows * cs
    const ox = Math.floor((cw - gw) * 0.5)
    const oy = Math.floor((ch - gh) * 0.5)

    const dpr = Math.min(2.25, window.devicePixelRatio || 1)
    this.canvas.width = Math.floor(cw * dpr)
    this.canvas.height = Math.floor(ch * dpr)
    this.canvas.style.width = `${cw}px`
    this.canvas.style.height = `${ch}px`
    const ctx = this.ctx
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const bg0 = this.themeColor('--snake-bg-a', '#0a0b10')
    const bg1 = this.themeColor('--snake-bg-b', '#161825')
    const body = this.themeColor('--snake-fg', '#8fe0a8')
    const bodyMid = this.themeColor('--snake-fg-mid', '#5cb87a')
    const outline = this.themeColor('--snake-outline', '#153428')
    const headFill = this.themeColor('--snake-head', '#c8fad3')
    const food = this.themeColor('--snake-food', '#f591b2')
    const foodHot = this.themeColor('--snake-food-hot', '#fff5fb')
    const gridMaj = this.themeColor('--snake-grid-major', 'rgba(180,190,255,0.09)')
    const gridMin = this.themeColor('--snake-grid-minor', 'rgba(180,190,255,0.045)')

    ctx.fillStyle = '#05060a'
    ctx.fillRect(0, 0, cw, ch)

    ctx.save()
    ctx.translate(ox, oy)

    const gLin = ctx.createLinearGradient(0, 0, gw, gh)
    gLin.addColorStop(0, bg0)
    gLin.addColorStop(1, bg1)
    ctx.fillStyle = gLin
    ctx.fillRect(0, 0, gw, gh)

    const vig = ctx.createRadialGradient(gw * 0.5, gh * 0.45, cs * 1.2, gw * 0.5, gh * 0.5, Math.hypot(gw, gh) * 0.75)
    vig.addColorStop(0, 'rgba(15,17,26,0)')
    vig.addColorStop(1, 'rgba(6,6,12,0.5)')
    ctx.fillStyle = vig
    ctx.fillRect(0, 0, gw, gh)

    // Light grid lines
    ctx.lineWidth = 1
    ctx.strokeStyle = gridMin
    ctx.beginPath()
    for (let gx = 0; gx <= this.cols; gx++) {
      const x = gx * cs
      ctx.moveTo(x, 0)
      ctx.lineTo(x, gh)
    }
    for (let gy = 0; gy <= this.rows; gy++) {
      const y = gy * cs
      ctx.moveTo(0, y)
      ctx.lineTo(gw, y)
    }
    ctx.stroke()

    ctx.strokeStyle = gridMaj
    ctx.lineWidth = 1
    ctx.strokeRect(0.5, 0.5, gw - 1, gh - 1)

    const path = this.buildSnakePath(cs, gw, gh)
    const thick = cs * 0.78

    if (this.snake.length >= 1) {
      ctx.save()
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.shadowColor = 'rgba(138,243,173,0.32)'
      ctx.shadowBlur = cs * 0.38
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

      const hd = this.snake[0]!
      const { ox: hx, oy: hy } = this.cellCenter(hd.x, hd.y, cs)
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

    const pulse = (Math.sin(this.foodPhase) + 1) * 0.5
    const { ox: fx, oy: fy } = this.cellCenter(this.food.x, this.food.y, cs)
    const fr = cs * (0.3 + pulse * 0.06)
    ctx.save()
    ctx.shadowColor = 'rgba(243,139,168,0.5)'
    ctx.shadowBlur = cs * (0.32 + pulse * 0.18)
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

    if (this.powerup) {
      const { ox: px, oy: py } = this.cellCenter(this.powerup.x, this.powerup.y, cs)
      const pr = cs * (0.28 + Math.sin(this.powerPhase) * 0.04)
      ctx.save()
      if (this.powerup.kind === 'ghost') {
        ctx.shadowColor = 'rgba(203,166,247,0.65)'
        ctx.fillStyle = 'rgba(203,166,247,0.92)'
        ctx.strokeStyle = 'rgba(245,194,231,0.5)'
      } else if (this.powerup.kind === 'gem') {
        ctx.shadowColor = 'rgba(137,180,250,0.55)'
        ctx.fillStyle = 'rgba(137,180,250,0.95)'
        ctx.strokeStyle = 'rgba(180,210,255,0.45)'
      } else if (this.powerup.kind === 'growth') {
        ctx.shadowColor = 'rgba(166,227,161,0.55)'
        ctx.fillStyle = 'rgba(166,227,161,0.88)'
        ctx.strokeStyle = 'rgba(80,140,100,0.55)'
      } else {
        ctx.shadowColor = 'rgba(249,226,175,0.45)'
        ctx.fillStyle = 'rgba(249,226,175,0.9)'
        ctx.strokeStyle = 'rgba(200,170,120,0.5)'
      }
      ctx.shadowBlur = cs * 0.35
      ctx.beginPath()
      ctx.arc(px, py, pr, 0, Math.PI * 2)
      ctx.fill()
      ctx.lineWidth = 1.5
      ctx.stroke()
      ctx.restore()
    }

    if (this.ghostMovesLeft > 0) {
      ctx.save()
      ctx.font = `${Math.max(10, cs * 0.28)}px ui-monospace, monospace`
      ctx.fillStyle = 'rgba(203,166,247,0.75)'
      ctx.textAlign = 'right'
      ctx.textBaseline = 'top'
      ctx.fillText(`ghost ${this.ghostMovesLeft}`, gw - 4, 4)
      ctx.restore()
    }

    ctx.restore()

    if (!this.playing && !this.gameOverActive) {
      this.drawOverlay(ctx, cw, ch, cs, 'paused', ['p · resume', 'space · restart'])
    }
    if (this.gameOverActive) {
      this.drawOverlay(ctx, cw, ch, cs, 'game over', ['space · restart', `score ${this.score}`])
    }
  }

  private drawOverlay(
    ctx: CanvasRenderingContext2D,
    cw: number,
    ch: number,
    cs: number,
    title: string,
    subLines: readonly string[],
  ): void {
    ctx.save()
    ctx.fillStyle = 'rgba(5,7,14,0.55)'
    ctx.fillRect(0, 0, cw, ch)

    const titleSize = Math.max(17, Math.min(30, cs * 0.55))
    const subSize = Math.max(12, Math.min(16, cs * 0.32))
    const titleFont = `700 ${titleSize}px "JetBrains Mono", ui-monospace, system-ui`
    const subFont = `${subSize}px "JetBrains Mono", ui-monospace, system-ui`

    const titleLineH = titleSize * 1.12
    const subLineH = subSize * 1.38
    const gapTitleSub = Math.max(8, subSize * 0.5)
    const padV = 20
    const contentH = titleLineH + gapTitleSub + subLines.length * subLineH
    const bh = Math.min(ch * 0.46, Math.max(112, contentH + padV * 2))
    const bw = Math.min(cw * 0.88, 440)
    const boxLeft = (cw - bw) * 0.5
    const boxTop = (ch - bh) * 0.5
    const mx = cw * 0.5

    ctx.strokeStyle = 'rgba(245,194,231,0.28)'
    ctx.fillStyle = 'rgba(22,24,38,0.72)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    if (typeof ctx.roundRect === 'function') ctx.roundRect(boxLeft, boxTop, bw, bh, 14)
    else ctx.rect(boxLeft, boxTop, bw, bh)
    ctx.fill()
    ctx.stroke()

    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    let y = boxTop + padV
    ctx.fillStyle = this.themeColor('--snake-msg', '#e8eaf6')
    ctx.font = titleFont
    ctx.fillText(title, mx, y)
    y += titleLineH + gapTitleSub
    ctx.fillStyle = 'rgba(214,217,239,0.78)'
    ctx.font = subFont
    for (const line of subLines) {
      ctx.fillText(line, mx, y)
      y += subLineH
    }
    ctx.restore()
  }

  /** Focus the window element (not the canvas) so WM chords and arrow keys land here. */
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
    this.disposed = true
    this.stopLoop()
    this.ro?.disconnect()
    this.ro = null
    this.cssVars.destroy()
  }
}
