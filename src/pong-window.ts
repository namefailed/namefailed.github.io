/** Local Pong vs CPU or P2 — W/S vs arrows; fixed step on requestAnimationFrame. */

import { createWindowChrome } from './window-chrome'
import { createCssVarCache, type CssVarCache } from './css-var-cache'

export interface PongWindowOptions {
  onClose: () => void
  onMinimize: () => void
  onMaximize: () => void
  onFocus: () => void
}

export type PongMode = 'cpu' | 'p2'

const LOGICAL_W = 960
const LOGICAL_H = 540

export class PongWindow {
  readonly el: HTMLElement
  readonly command = 'pong' as const
  readonly onFocus: () => void

  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private wrap: HTMLElement
  private modeSelect: HTMLSelectElement
  private hintEl: HTMLElement
  private scoreYOU!: HTMLElement
  private scoreCPU!: HTMLElement
  private labelRow!: HTMLElement

  private alive = true
  private raf: number | null = null
  private readonly ro: ResizeObserver

  private readonly w = LOGICAL_W
  private readonly h = LOGICAL_H

  private readonly BALL_R = 8
  private readonly paddleH = 88
  private readonly paddleW = 12

  /** Min share of velocity along each axis avoids “forever creeping” rallies */
  private readonly MIN_AXIAL_RATIO = 0.42
  private readonly SPEED_MIN = 5.05
  private readonly SPEED_MAX = 13.8
  private readonly SPEEDUP_HIT = 1.045

  private mode: PongMode = 'cpu'
  private ball = {
    x: LOGICAL_W / 2,
    y: LOGICAL_H / 2,
    vx: -5,
    vy: 3,
  }

  /** Wall / goal padding aligns with paddles */
  private readonly EDGE_PAD = 28
  private leftY = LOGICAL_H / 2 - this.paddleH / 2
  private rightY = this.leftY

  private keys = new Set<string>()
  private detachInput: () => void = () => {}
  private scoreL = 0
  private scoreR = 0
  private cssVars: CssVarCache

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

    const chrome = createWindowChrome({
      title: 'pong',
      onClose: () => { this.dispose(); this.onClose() },
      onMinimize: () => this.onMinimize(),
      onMaximize: () => this.onMaximize(),
      onFocus: opts.onFocus,
    })
    this.el = chrome.el
    this.el.classList.add('pong-app')
    this.el.tabIndex = -1

    const hud = document.createElement('header')
    hud.className = 'pong-hud'

    const hudBar = document.createElement('div')
    hudBar.className = 'pong-hud-bar'

    const mid = document.createElement('div')
    mid.className = 'pong-hud-tools'

    const scoreRow = document.createElement('div')
    scoreRow.className = 'pong-score-row'
    scoreRow.setAttribute('role', 'presentation')

    const bl = document.createElement('div')
    bl.className = 'pong-score-block'
    const blLbl = document.createElement('span')
    blLbl.className = 'pong-score-role'
    blLbl.textContent = 'you'
    this.scoreYOU = document.createElement('span')
    this.scoreYOU.className = 'pong-score-val'
    this.scoreYOU.textContent = '0'
    bl.append(blLbl, this.scoreYOU)

    const sep = document.createElement('span')
    sep.className = 'pong-score-sep'
    sep.textContent = '∶'
    sep.setAttribute('aria-hidden', 'true')

    const br = document.createElement('div')
    br.className = 'pong-score-block pong-score-block--guest'
    this.labelRow = document.createElement('span')
    this.labelRow.className = 'pong-score-role'
    this.labelRow.textContent = 'computer'
    this.scoreCPU = document.createElement('span')
    this.scoreCPU.className = 'pong-score-val'
    this.scoreCPU.textContent = '0'
    br.append(this.labelRow, this.scoreCPU)

    scoreRow.append(bl, sep, br)

    this.modeSelect = document.createElement('select')
    this.modeSelect.className = 'pong-mode'
    this.modeSelect.innerHTML =
      `<option value="cpu">Vs CPU</option><option value="p2">2 players</option>`
    this.modeSelect.addEventListener('change', () => {
      this.mode = this.modeSelect.value as PongMode
      this.syncHudLabels()
      this.syncHint()
      this.resetBall(true)
    })

    this.hintEl = document.createElement('span')
    this.hintEl.className = 'pong-hint'
    this.syncHint()

    mid.appendChild(this.modeSelect)

    hudBar.append(scoreRow, mid)
    hud.append(hudBar, this.hintEl)

    this.wrap = document.createElement('div')
    this.wrap.className = 'pong-canvas-wrap'

    this.canvas = document.createElement('canvas')
    this.canvas.className = 'pong-stage'
    this.canvas.tabIndex = 0

    const g = this.canvas.getContext('2d')
    if (!g) throw new Error('2d')
    this.ctx = g
    this.cssVars = createCssVarCache(() => this.canvas)

    this.wrap.appendChild(this.canvas)

    const stack = document.createElement('div')
    stack.className = 'pong-stack'
    stack.appendChild(hud)
    stack.appendChild(this.wrap)

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
    // A keyup never arrives if focus leaves mid-press (alt-tab, or focus moves
    // to the mode <select>), so drop every held key on focus loss — otherwise
    // the paddle keeps drifting forever.
    const clearKeys = (): void => this.keys.clear()
    this.el.addEventListener('keydown', kd, true)
    this.el.addEventListener('keyup', ku, true)
    this.el.addEventListener('focusout', clearKeys)
    window.addEventListener('blur', clearKeys)
    this.detachInput = () => {
      this.el.removeEventListener('keydown', kd, true)
      this.el.removeEventListener('keyup', ku, true)
      this.el.removeEventListener('focusout', clearKeys)
      window.removeEventListener('blur', clearKeys)
    }

    this.wrap.addEventListener('mousedown', () => {
      opts.onFocus()
      this.canvas.focus()
    })

    this.syncHudLabels()
    this.resizeCanvas()
    this.ro = new ResizeObserver(() => this.resizeCanvas())
    this.ro.observe(this.wrap)

    this.loop = this.loop.bind(this)
    this.raf = requestAnimationFrame(this.loop)
  }

  private resizeCanvas(): void {
    const r = this.wrap.getBoundingClientRect()
    const cw = Math.max(200, Math.floor(r.width || this.w))
    const ch = Math.max(160, Math.floor(r.height || this.h))

    let dispW = Math.min(this.w, cw)
    let dispH = dispW * (this.h / this.w)
    if (dispH > ch) {
      dispH = ch
      dispW = dispH * (this.w / this.h)
    }

    const dpr = Math.min(2.25, window.devicePixelRatio || 1)

    this.canvas.style.width = `${Math.floor(dispW)}px`
    this.canvas.style.height = `${Math.floor(dispH)}px`
    const bw = Math.max(480, Math.floor(dispW * dpr))
    const bh = Math.floor(bw * (this.h / this.w))

    if (this.canvas.width !== bw || this.canvas.height !== bh) {
      this.canvas.width = bw
      this.canvas.height = bh
      this.ctx.setTransform(bw / this.w, 0, 0, bh / this.h, 0, 0)
    }
  }

  private clampSpeedAndAxes(vx: number, vy: number): { vx: number; vy: number } {
    let sp = Math.hypot(vx, vy)
    if (sp < 1e-4) {
      const fx = Math.random() > 0.5 ? 1 : -1
      const fy = Math.random() > 0.5 ? 1 : -1
      vx = fx * this.SPEED_MIN * 0.65
      vy = fy * this.SPEED_MIN * 0.65
      sp = Math.hypot(vx, vy)
    }

    sp = Math.min(this.SPEED_MAX, Math.max(this.SPEED_MIN, sp))

    let nx = vx / sp
    let ny = vy / sp
    const mr = this.MIN_AXIAL_RATIO
    const fix = (): void => {
      let ax = Math.abs(nx)
      let ay = Math.abs(ny)
      const sx = Math.sign(nx) || (Math.random() > 0.5 ? 1 : -1)
      const sy = Math.sign(ny) || (Math.random() > 0.5 ? 1 : -1)
      if (ax < mr) nx = sx * mr
      if (ay < mr) ny = sy * mr
      const m = Math.hypot(nx, ny)
      nx /= m
      ny /= m
    }

    fix()
    fix()

    return { vx: nx * sp, vy: ny * sp }
  }

  /**
   * Left paddle rebound sends the ball toward +X; right paddle toward −X.
   * Applies “english” vertically so shallow horizontal grinding can’t stall.
   */
  private reboundFromPaddle(towardRightAfter: boolean, paddleMidY: number): void {
    const half = this.paddleH * 0.5
    const rel = Math.max(-1, Math.min(1, half > 1e-3 ? (this.ball.y - paddleMidY) / half : 0))

    const base = Math.hypot(this.ball.vx, this.ball.vy)
    const sp = Math.min(this.SPEED_MAX, Math.max(this.SPEED_MIN, base * this.SPEEDUP_HIT))

    const minHorizAbs = Math.max(sp * this.MIN_AXIAL_RATIO, this.SPEED_MIN * this.MIN_AXIAL_RATIO)
    const vyClamp = Math.sqrt(Math.max(0, sp * sp - minHorizAbs * minHorizAbs))
    let vy = Math.max(-vyClamp, Math.min(vyClamp, this.ball.vy + rel * 4.4))
    const vxMag = Math.sqrt(Math.max(sp * sp - vy * vy, minHorizAbs * minHorizAbs))
    let vx = (towardRightAfter ? 1 : -1) * vxMag

    const fused = this.clampSpeedAndAxes(vx, vy)
    vx = towardRightAfter ? Math.abs(fused.vx) : -Math.abs(fused.vx)
    vy = fused.vy
    let out = this.clampSpeedAndAxes(vx, vy)
    this.ball.vx = out.vx
    this.ball.vy = out.vy
    if (
      towardRightAfter ? this.ball.vx <= 0 :
      this.ball.vx >= 0
    ) {
      vx = towardRightAfter ? this.SPEED_MIN * 1.05 : -this.SPEED_MIN * 1.05
      out = this.clampSpeedAndAxes(vx, this.ball.vy)
      this.ball.vx = out.vx
      this.ball.vy = out.vy
    }
  }

  private syncHudLabels(): void {
    this.labelRow.textContent = this.mode === 'cpu' ? 'cpu' : 'p2'
  }

  private aiRightPaddle(pad: number, maxY: number): number {
    const rx = this.w - pad - this.paddleW - this.BALL_R * 0.5
    let target = this.h / 2 - this.paddleH / 2
    if (this.ball.vx > 0) {
      let x = this.ball.x
      let y = this.ball.y
      let vx = this.ball.vx
      let vy = this.ball.vy

      const topMargin = this.EDGE_PAD
      const botMargin = this.h - this.EDGE_PAD

      for (let i = 0; i < 700; i++) {
        const nextY = y + vy
        if (nextY < topMargin || nextY > botMargin) {
          vy *= -1
          y = nextY < topMargin ? topMargin : botMargin
        } else {
          y = nextY
        }
        x += vx
        if (x >= rx - 4) {
          target = y - this.paddleH / 2
          break
        }
      }
    } else {
      target = this.h / 2 - this.paddleH / 2 + Math.sin(performance.now() / 820) * 22
    }
    const err = target - this.rightY
    const urgency = Math.min(1, Math.abs(this.ball.vx) / 8.5)
    const maxStep = 5.4 + urgency * 7.2
    let next = this.rightY + Math.sign(err) * Math.min(Math.abs(err), maxStep)
    if (Math.abs(err) < 5 && Math.abs(this.ball.vx) > 5.5)
      next += (Math.random() - 0.5) * 2.4 * (1 - urgency * 0.88)
    return Math.max(pad, Math.min(maxY, next))
  }

  private syncHint(): void {
    this.hintEl.textContent =
      this.mode === 'cpu' ? 'You · W / S   ·   CPU defends right' : 'Left · W/S   ·   Right · ↑ / ↓'
  }

  private resetBall(center = false): void {
    this.ball.x = this.w / 2
    this.ball.y = this.h / 2

    const dirX = Math.random() > 0.5 ? 1 : -1
    const dirY = Math.random() > 0.5 ? 1 : -1

    const mr = this.MIN_AXIAL_RATIO * 0.9
    let ang: number
    do {
      ang = (Math.random() * 0.74 + 0.13) * Math.PI
    } while (Math.min(Math.abs(Math.cos(ang)), Math.abs(Math.sin(ang))) < mr)

    const spd = this.SPEED_MIN + Math.random() * 1.35
    let vx = Math.cos(ang) * spd * dirX
    let vy = Math.sin(ang) * spd * dirY

    const c = this.clampSpeedAndAxes(vx, vy)
    this.ball.vx = c.vx
    this.ball.vy = c.vy

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

    const pad = this.EDGE_PAD
    const maxY = this.h - this.paddleH - pad
    const paddleSpeed = 11.2

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

    const topM = this.EDGE_PAD
    const botM = this.h - this.EDGE_PAD
    if (this.ball.y < topM) {
      this.ball.y = topM
      this.ball.vy = Math.abs(this.ball.vy)
    } else if (this.ball.y > botM) {
      this.ball.y = botM
      this.ball.vy = -Math.abs(this.ball.vy)
    }

    const lx = pad
    const rx = this.w - pad - this.paddleW

    const ballL = this.ball.x - this.BALL_R
    const ballR = this.ball.x + this.BALL_R

    const hitLeft =
      this.ball.vx < 0 &&
      ballL <= lx + this.paddleW &&
      ballR >= lx &&
      this.ball.y + this.BALL_R > this.leftY &&
      this.ball.y - this.BALL_R < this.leftY + this.paddleH

    const hitRight =
      this.ball.vx > 0 &&
      ballR >= rx &&
      ballL <= rx + this.paddleW &&
      this.ball.y + this.BALL_R > this.rightY &&
      this.ball.y - this.BALL_R < this.rightY + this.paddleH

    if (hitLeft) {
      this.reboundFromPaddle(true, this.leftY + this.paddleH / 2)
      this.ball.x = lx + this.paddleW + this.BALL_R + 2
    } else if (hitRight) {
      this.reboundFromPaddle(false, this.rightY + this.paddleH / 2)
      this.ball.x = rx - this.BALL_R - 2
    }

    const goL = ballR < 0
    const goR = ballL > this.w

    if (goL || goR) {
      if (goL) {
        this.scoreR++
      } else {
        this.scoreL++
      }
      this.updateScore()
      this.resetBall()
    }

    const accent =
      this.cssVars.get('--pong-accent', '') ||
      this.cssVars.get('--th-accent', '#cba6f7')

    const dim =
      this.cssVars.get('--pong-muted', '') ||
      this.cssVars.get('--th-text-muted', '#6c7086')

    const bg =
      this.cssVars.get('--pong-field', '') ||
      this.cssVars.get('--th-base', '#11111b')

    const ctx = this.ctx
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, this.w, this.h)

    const fade = ctx.createRadialGradient(this.w / 2, this.h / 2, 0, this.w / 2, this.h / 2, this.w * 0.62)
    fade.addColorStop(0, 'rgba(148,156,227,0.05)')
    fade.addColorStop(1, 'rgba(5,8,14,0.35)')
    ctx.fillStyle = fade
    ctx.fillRect(0, 0, this.w, this.h)

    ctx.strokeStyle = dim
    ctx.globalAlpha = 0.55
    ctx.setLineDash([8, 12])
    ctx.lineWidth = 1.35
    ctx.beginPath()
    ctx.moveTo(this.w / 2, topM + 10)
    ctx.lineTo(this.w / 2, botM - 10)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.globalAlpha = 1

    ctx.fillStyle = accent
    ctx.fillRect(lx, this.leftY, this.paddleW, this.paddleH)
    ctx.fillRect(rx, this.rightY, this.paddleW, this.paddleH)

    ctx.beginPath()
    ctx.arc(this.ball.x, this.ball.y, this.BALL_R - 1, 0, Math.PI * 2)
    ctx.fillStyle = accent
    ctx.fill()
    ctx.lineWidth = 1.75
    ctx.strokeStyle = 'rgba(245,247,255,0.32)'
    ctx.stroke()

    this.raf = requestAnimationFrame(this.loop)
  }

  private updateScore(): void {
    this.scoreYOU.textContent = String(this.scoreL)
    this.scoreCPU.textContent = String(this.scoreR)
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
    this.detachInput()
    this.keys.clear()
    this.ro.disconnect()
    this.cssVars.destroy()
    if (this.raf != null) cancelAnimationFrame(this.raf)
    this.raf = null
  }
}
