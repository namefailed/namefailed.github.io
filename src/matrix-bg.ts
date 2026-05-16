/** Full-viewport canvas rain behind `#desktop`; glyph colors follow the active theme pack. */

import { getMatrixRainPalette } from './theme-control'
import { storageGet, storageSet } from './storage'

const STORAGE_KEY = 'mrgrey-matrix-bg'

function readStoredMatrix(): boolean | null {
  const v = storageGet(STORAGE_KEY)
  if (v === 'on') return true
  if (v === 'off') return false
  return null
}

function writeStoredMatrix(on: boolean): void {
  storageSet(STORAGE_KEY, on ? 'on' : 'off')
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Weighted toward decimal digits so the rain reads as numbers falling. */
const DECIMAL = '0123456789'
const GLYPH =
  'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉアイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲンχψωστλµπ'

/** Base px/frame; randomized per column — kept a bit slow */
const SPEED_MIN = 1.5
const SPEED_SPREAD = 3.2

function charAtSeed(seed: number): string {
  const x = (Math.imul(seed ^ (seed >>> 16), 0x45d9f3b)) >>> 0
  // Bias toward digits; remainder is mixed glyph texture
  if (x % 100 < 62) return DECIMAL[x % 10]!
  return GLYPH[x % GLYPH.length]!
}

function parseHex(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function rgba(hex: string, a: number): string {
  const { r, g, b } = parseHex(hex)
  return `rgba(${r},${g},${b},${a})`
}

function readCssVar(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

/** Same asset as `#desktop` in CSS — redrawn each frame under the rain */
const WALLPAPER_SRC = '/wallpaper.jpg'

function drawBackdrop(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  bgImg: HTMLImageElement,
): void {
  if (bgImg.complete && bgImg.naturalWidth > 0 && bgImg.naturalHeight > 0) {
    const iw = bgImg.naturalWidth
    const ih = bgImg.naturalHeight
    const scale = Math.max(width / iw, height / ih)
    const dw = iw * scale
    const dh = ih * scale
    ctx.drawImage(bgImg, (width - dw) * 0.5, (height - dh) * 0.5, dw, dh)
    return
  }
  if (bgImg.complete) {
    ctx.drawImage(bgImg, 0, 0, width, height)
    return
  }
  const g = ctx.createLinearGradient(0, 0, width, height * 1.05)
  g.addColorStop(0, readCssVar('--th-matrix-g1', '#313244'))
  g.addColorStop(0.42, readCssVar('--th-matrix-g2', '#1e1e2e'))
  g.addColorStop(1, readCssVar('--th-matrix-g3', '#11111b'))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, width, height)
}

export interface MatrixBgHandle {
  /** false = hide canvas; CSS wallpaper only */
  setEnabled: (enabled: boolean) => void
  isEnabled: () => boolean
  destroy: () => void
}

let registeredHandle: MatrixBgHandle | null = null

export function getMatrixBgHandle(): MatrixBgHandle | null {
  return registeredHandle
}

export function initMatrixBg(canvas: HTMLCanvasElement, root: HTMLElement): MatrixBgHandle {
  const ctxMaybe = canvas.getContext('2d', { alpha: true })
  if (!ctxMaybe) {
    const noop: MatrixBgHandle = {
      setEnabled: () => {},
      isEnabled: () => false,
      destroy: () => {},
    }
    return noop
  }
  const ctx: CanvasRenderingContext2D = ctxMaybe

  const stored = readStoredMatrix()
  // Default OFF — wallpaper provides the backdrop; user opts in via settings
  let enabled = stored !== null ? stored : false

  const bgImg = new Image()
  bgImg.src = WALLPAPER_SRC
  bgImg.decoding = 'async'

  let width = 0
  let height = 0
  let dpr = 1
  let columns = 0
  const fontSize = 12
  const colStep = 8
  const trailRows = 34
  const drops: number[] = []
  const speeds: number[] = []
  let frame = 0
  let raf = 0
  /** Track whether the document is visible to pause animation when tab is backgrounded. */
  let docVisible = !document.hidden
  /** Track whether the canvas is actually displayed to skip rendering when hidden. */
  let canvasVisible = enabled

  function shouldRun(): boolean {
    return enabled && docVisible && canvasVisible
  }

  function layout(): void {
    const rect = root.getBoundingClientRect()
    dpr = Math.min(window.devicePixelRatio || 1, 2)
    width = rect.width
    height = rect.height
    if (width < 2 || height < 2) return

    canvas.width = Math.floor(width * dpr)
    canvas.height = Math.floor(height * dpr)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    columns = Math.ceil(width / colStep)
    drops.length = columns
    speeds.length = columns
    for (let i = 0; i < columns; i++) {
      drops[i] = Math.random() * -height * 1.2
      speeds[i] = SPEED_MIN + Math.random() * SPEED_SPREAD
    }
  }

  function stopLoop(): void {
    cancelAnimationFrame(raf)
    raf = 0
  }

  function loop(): void {
    if (!shouldRun()) {
      raf = 0
      return
    }

    if (width < 2 || height < 2) {
      raf = requestAnimationFrame(loop)
      return
    }

    frame++

    drawBackdrop(ctx, width, height, bgImg)
    ctx.fillStyle = readCssVar('--th-matrix-fade', 'rgba(17, 17, 27, 0.11)')
    ctx.fillRect(0, 0, width, height)

    ctx.textBaseline = 'top'
    ctx.font = `${fontSize}px "JetBrains Mono", ui-monospace, monospace`

    const rain = getMatrixRainPalette()
    for (let i = 0; i < columns; i++) {
      const x = i * colStep
      let head = drops[i]!
      const base = rain[i % rain.length]!

      for (let j = 0; j < trailRows; j++) {
        const y = head - j * fontSize
        if (y < -fontSize || y > height + fontSize) continue

        let alpha: number
        if (j === 0) alpha = 1
        else if (j < 5) alpha = 0.88 - j * 0.1
        else alpha = Math.max(0.07, (1 - j / trailRows) * 0.52)

        const seed = i * 9973 + j * 499 + frame + Math.floor(head / fontSize)
        const ch = charAtSeed(seed)

        ctx.fillStyle = rgba(base, alpha)
        ctx.fillText(ch, x, y)
      }

      head += speeds[i]!
      drops[i] = head
      if (drops[i]! > height + trailRows * fontSize) {
        drops[i] = Math.random() * -height * 0.8 - trailRows * fontSize
        speeds[i] = SPEED_MIN + Math.random() * SPEED_SPREAD
      }
    }

    raf = requestAnimationFrame(loop)
  }

  function startLoop(): void {
    stopLoop()
    if (!shouldRun()) return
    raf = requestAnimationFrame(loop)
  }

  function onVisibilityChange(): void {
    const wasVisible = docVisible
    docVisible = !document.hidden
    if (docVisible && !wasVisible) {
      // Resumed visibility - restart loop
      startLoop()
    }
    // When hidden, the loop will exit on next frame (shouldRun() check in loop)
  }

  function syncDom(): void {
    canvas.style.display = enabled ? '' : 'none'
    root.dataset.matrixBg = enabled ? 'on' : 'off'
  }

  const ro = new ResizeObserver(() => {
    layout()
  })
  ro.observe(root)

  const onWinResize = (): void => layout()
  window.addEventListener('resize', onWinResize)

  const onThemeChange = (): void => {
    layout()
  }
  window.addEventListener('mrgrey-theme-change', onThemeChange)

  document.addEventListener('visibilitychange', onVisibilityChange)

  layout()
  syncDom()
  startLoop()

  const handle: MatrixBgHandle = {
    setEnabled: (on: boolean) => {
      enabled = on
      canvasVisible = on
      writeStoredMatrix(on)
      syncDom()
      if (enabled) {
        layout()
        startLoop()
      } else {
        stopLoop()
      }
    },
    isEnabled: () => enabled,
    destroy: () => {
      stopLoop()
      ro.disconnect()
      window.removeEventListener('resize', onWinResize)
      window.removeEventListener('mrgrey-theme-change', onThemeChange)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      if (registeredHandle === handle) registeredHandle = null
    },
  }

  registeredHandle = handle
  return handle
}
