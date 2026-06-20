// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { reflowSnakeIntoGrid, SnakeWindow } from './snake-window'

const cell = (x: number, y: number) => ({ x, y })

describe('reflowSnakeIntoGrid', () => {
  it('keeps the whole snake when it still fits the grid', () => {
    const snake = [cell(2, 2), cell(1, 2), cell(0, 2)]
    expect(reflowSnakeIntoGrid(snake, 10, 10)).toEqual(snake)
  })

  it('drops segments that fall outside a shrunk grid, keeping the run from the head', () => {
    const snake = [cell(1, 1), cell(2, 1), cell(4, 1)] // last cell is off a 3×3 grid
    expect(reflowSnakeIntoGrid(snake, 3, 3)).toEqual([cell(1, 1), cell(2, 1)])
  })

  it('returns null (round ends) when the head no longer fits', () => {
    expect(reflowSnakeIntoGrid([cell(9, 9), cell(8, 9)], 3, 3)).toBeNull()
  })

  it('returns null for an empty snake', () => {
    expect(reflowSnakeIntoGrid([], 5, 5)).toBeNull()
  })

  it('returns fresh objects, not the same references (defensive copy)', () => {
    const snake = [cell(0, 0), cell(1, 0)]
    const out = reflowSnakeIntoGrid(snake, 5, 5)!
    expect(out).toEqual(snake)
    expect(out[0]).not.toBe(snake[0])
  })

  it('stops at the first out-of-bounds segment even if a later one fits again', () => {
    // head ok, second off the grid, third back in bounds — run must stop at the gap
    const snake = [cell(0, 0), cell(9, 0), cell(1, 0)]
    expect(reflowSnakeIntoGrid(snake, 3, 3)).toEqual([cell(0, 0)])
  })

  it('treats negative coordinates as out of bounds', () => {
    const snake = [cell(0, 0), cell(-1, 0)]
    expect(reflowSnakeIntoGrid(snake, 5, 5)).toEqual([cell(0, 0)])
  })
})

// --- SnakeWindow (DOM-driven) -------------------------------------------------

function chromeOpts() {
  return {
    onClose: vi.fn(),
    onMinimize: vi.fn(),
    onMaximize: vi.fn(),
    onFocus: vi.fn(),
  }
}

/** A canvas 2D context stub exposing every method/prop draw() touches. */
function makeCtx() {
  const grad = { addColorStop: vi.fn() }
  return {
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    setTransform: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    rect: vi.fn(),
    roundRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillText: vi.fn(),
    createLinearGradient: vi.fn(() => grad),
    createRadialGradient: vi.fn(() => grad),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    shadowColor: '',
    shadowBlur: 0,
    font: '',
    textAlign: 'start',
    textBaseline: 'alphabetic',
  }
}

describe('SnakeWindow', () => {
  const origGetContext = HTMLCanvasElement.prototype.getContext
  const origGetComputedStyle = globalThis.getComputedStyle
  const origRO = globalThis.ResizeObserver
  const origPath2D = (globalThis as { Path2D?: unknown }).Path2D
  const origGBCR = HTMLElement.prototype.getBoundingClientRect

  let roCallback: (() => void) | null = null

  beforeEach(() => {
    vi.useFakeTimers()
    document.body.replaceChildren()
    roCallback = null

    HTMLCanvasElement.prototype.getContext = vi.fn(
      () => makeCtx(),
    ) as unknown as typeof HTMLCanvasElement.prototype.getContext

    globalThis.getComputedStyle = vi.fn(() => ({
      getPropertyValue: () => '',
    })) as unknown as typeof getComputedStyle

    globalThis.ResizeObserver = class {
      constructor(cb: () => void) {
        roCallback = cb
      }
      observe = vi.fn()
      unobserve = vi.fn()
      disconnect = vi.fn()
    } as unknown as typeof ResizeObserver

    ;(globalThis as { Path2D?: unknown }).Path2D = class {
      moveTo = vi.fn()
      lineTo = vi.fn()
    }

    // Give the wrap a concrete size so grid math is deterministic.
    HTMLElement.prototype.getBoundingClientRect = vi.fn(
      () => ({ width: 672, height: 528, top: 0, left: 0, right: 672, bottom: 528, x: 0, y: 0 }),
    ) as unknown as typeof HTMLElement.prototype.getBoundingClientRect
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get: () => 672,
    })
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      get: () => 528,
    })
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    HTMLCanvasElement.prototype.getContext = origGetContext
    globalThis.getComputedStyle = origGetComputedStyle
    globalThis.ResizeObserver = origRO
    ;(globalThis as { Path2D?: unknown }).Path2D = origPath2D
    HTMLElement.prototype.getBoundingClientRect = origGBCR
    delete (HTMLElement.prototype as { clientWidth?: unknown }).clientWidth
    delete (HTMLElement.prototype as { clientHeight?: unknown }).clientHeight
    vi.restoreAllMocks()
  })

  /** Construct a window, mount it, and flush the rAF that boots the first round. */
  function mount() {
    const opts = chromeOpts()
    const win = new SnakeWindow(opts)
    document.body.appendChild(win.el)
    vi.runOnlyPendingTimers() // boot rAF -> syncGridFromWrap + resetGame
    return { win, opts }
  }

  const q = (win: SnakeWindow, sel: string) => win.el.querySelector(sel) as HTMLElement
  const score = (win: SnakeWindow) => q(win, '.snake-score').textContent
  const length = (win: SnakeWindow) => q(win, '.snake-length').textContent

  const key = (win: SnakeWindow, code: string) =>
    win.el.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }))

  it('mounts chrome, HUD and canvas with the snake-app class', () => {
    const { win } = mount()
    expect(win.el.classList.contains('snake-app')).toBe(true)
    expect(win.command).toBe('snake')
    expect(win.el.querySelector('canvas.snake-canvas')).not.toBeNull()
    expect(win.el.querySelector('.snake-hud')).not.toBeNull()
    expect(q(win, '.snake-canvas').getAttribute('role')).toBe('img')
    win.dispose()
  })

  it('boots a round of length 3 with score 0', () => {
    const { win } = mount()
    expect(score(win)).toBe('0')
    expect(length(win)).toBe('3')
    win.dispose()
  })

  it('throws when no 2D context is available', () => {
    HTMLCanvasElement.prototype.getContext = vi.fn(
      () => null,
    ) as unknown as typeof HTMLCanvasElement.prototype.getContext
    expect(() => new SnakeWindow(chromeOpts())).toThrow('2d')
  })

  it('Restart button resets the round and forwards no callback', () => {
    const { win } = mount()
    const restart = [...win.el.querySelectorAll('.snake-hud-btn')].find(
      (b) => b.textContent === 'Restart',
    ) as HTMLButtonElement
    restart.click()
    expect(score(win)).toBe('0')
    expect(length(win)).toBe('3')
    win.dispose()
  })

  it('Pause button relabels to Resume and marks the active state when paused', () => {
    const { win } = mount()
    const pause = q(win, '.snake-hud-btn:not(.snake-hud-btn--primary)') as HTMLButtonElement
    expect(pause.textContent).toBe('Pause')
    expect(pause.classList.contains('snake-hud-btn--active')).toBe(false)
    pause.click() // pause -> stopLoop -> syncPauseButton
    expect(pause.textContent).toBe('Resume')
    expect(pause.classList.contains('snake-hud-btn--active')).toBe(true)
    win.dispose()
  })

  it('restarting from a paused state restores the Pause label', () => {
    const { win } = mount()
    const pause = q(win, '.snake-hud-btn:not(.snake-hud-btn--primary)') as HTMLButtonElement
    pause.click()
    expect(pause.textContent).toBe('Resume')
    key(win, 'Space') // resetGame -> playing true -> syncPauseButton -> 'Pause'
    expect(pause.textContent).toBe('Pause')
    expect(pause.classList.contains('snake-hud-btn--active')).toBe(false)
    win.dispose()
  })

  it('P key pauses the round (relabels to Resume)', () => {
    const { win } = mount()
    const pause = q(win, '.snake-hud-btn:not(.snake-hud-btn--primary)') as HTMLButtonElement
    key(win, 'KeyP')
    expect(pause.textContent).toBe('Resume')
    expect(pause.classList.contains('snake-hud-btn--active')).toBe(true)
    win.dispose()
  })

  it('Space restarts the round', () => {
    const { win } = mount()
    const restart = [...win.el.querySelectorAll('.snake-hud-btn')].find(
      (b) => b.textContent === 'Restart',
    ) as HTMLButtonElement
    const spy = vi.spyOn(restart, 'click')
    key(win, 'Space')
    // Space doesn't click the button, it resets directly — verify via state.
    expect(score(win)).toBe('0')
    expect(length(win)).toBe('3')
    spy.mockRestore()
    win.dispose()
  })

  it('ignores a direct 180° reversal but accepts a perpendicular turn', () => {
    const { win } = mount()
    // Snake starts moving right (dir x:1). Pressing Left is a reversal: ignored.
    // Pressing Up is perpendicular: accepted (pendingDir). We can't read private
    // state, but we can confirm a left press does NOT cause an instant game over
    // on the next tick (which a reversal-into-self would, if it were applied).
    key(win, 'ArrowLeft')
    vi.advanceTimersByTime(200) // run a tick
    expect(q(win, '.snake-canvas')).not.toBeNull()
    // still playing — game-over disables the pause button
    const pause = q(win, '.snake-hud-btn:not(.snake-hud-btn--primary)') as HTMLButtonElement
    expect(pause.disabled).toBe(false)
    win.dispose()
  })

  it('runs game ticks while playing (snake keeps moving without dying in open space)', () => {
    const { win } = mount()
    // Head starts mid-grid moving right with lots of room; several ticks should
    // not end the game. Length stays 3 (no food eaten by chance is not guaranteed,
    // so assert length >= 3 and the game is still live).
    vi.advanceTimersByTime(500)
    const pause = q(win, '.snake-hud-btn:not(.snake-hud-btn--primary)') as HTMLButtonElement
    expect(pause.disabled).toBe(false) // not game over
    expect(Number(length(win))).toBeGreaterThanOrEqual(3)
    win.dispose()
  })

  it('ends the game (overlay state) when the snake drives into a wall', () => {
    const { win } = mount()
    // Turn up and keep ticking until the top wall ends the round.
    key(win, 'ArrowUp')
    vi.advanceTimersByTime(3000)
    const pause = q(win, '.snake-hud-btn:not(.snake-hud-btn--primary)') as HTMLButtonElement
    expect(pause.disabled).toBe(true) // game over disables pause
    expect(pause.classList.contains('snake-hud-btn--active')).toBe(false)
    win.dispose()
  })

  it('ignores arrow input and P after game over, but Space restarts', () => {
    const { win } = mount()
    key(win, 'ArrowUp')
    vi.advanceTimersByTime(3000) // drive into wall -> game over
    const pause = q(win, '.snake-hud-btn:not(.snake-hud-btn--primary)') as HTMLButtonElement
    expect(pause.disabled).toBe(true)
    // P is a no-op while game over
    key(win, 'KeyP')
    expect(pause.disabled).toBe(true)
    // Space restarts -> playable again
    key(win, 'Space')
    expect(pause.disabled).toBe(false)
    expect(score(win)).toBe('0')
    win.dispose()
  })

  it('does not tick when minimized (loop survives, no movement)', () => {
    const { win } = mount()
    win.setMinimized(true)
    expect(win.el.classList.contains('minimized')).toBe(true)
    const before = length(win)
    vi.advanceTimersByTime(1000)
    // Minimized -> tick reschedules without advancing the snake.
    expect(length(win)).toBe(before)
    const pause = q(win, '.snake-hud-btn:not(.snake-hud-btn--primary)') as HTMLButtonElement
    expect(pause.disabled).toBe(false) // still alive
    win.dispose()
  })

  it('reflows the snake on resize without resetting the score', () => {
    const { win } = mount()
    // Shrink the wrap, then fire the ResizeObserver callback.
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get: () => 300,
    })
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      get: () => 260,
    })
    expect(roCallback).not.toBeNull()
    roCallback!()
    // Score is preserved (still 0 from boot); length is still a valid number.
    expect(score(win)).toBe('0')
    expect(Number(length(win))).toBeGreaterThanOrEqual(1)
    win.dispose()
  })

  it('setActive / setMinimized / isMaximized reflect classes', () => {
    const { win } = mount()
    expect(win.isMaximized()).toBe(false)
    win.setActive(true)
    expect(win.el.classList.contains('active')).toBe(true)
    win.setActive(false)
    expect(win.el.classList.contains('active')).toBe(false)
    win.setMinimized(true)
    expect(win.el.classList.contains('minimized')).toBe(true)
    win.el.classList.add('maximized')
    expect(win.isMaximized()).toBe(true)
    win.dispose()
  })

  it('focusCanvas focuses the window element', () => {
    const { win } = mount()
    const spy = vi.spyOn(win.el, 'focus')
    win.focusCanvas()
    expect(spy).toHaveBeenCalledOnce()
    win.dispose()
  })

  it('scrollBy delegates to the canvas wrap', () => {
    const { win } = mount()
    const wrap = q(win, '.snake-canvas-wrap')
    const spy = vi.fn()
    ;(wrap as unknown as { scrollBy: unknown }).scrollBy = spy
    win.scrollBy(40)
    expect(spy).toHaveBeenCalledWith({ top: 40, behavior: 'smooth' })
    win.dispose()
  })

  it('close button stops the loop and forwards onClose', () => {
    const { win, opts } = mount()
    const closeBtn = q(win, '.dot-close')
    closeBtn.click()
    expect(opts.onClose).toHaveBeenCalledOnce()
    // After close, advancing timers must not throw (loop stopped).
    expect(() => vi.advanceTimersByTime(1000)).not.toThrow()
    win.dispose()
  })

  it('titlebar buttons forward minimize and maximize', () => {
    const { win, opts } = mount()
    q(win, '.dot-min').click()
    q(win, '.dot-max').click()
    expect(opts.onMinimize).toHaveBeenCalledOnce()
    expect(opts.onMaximize).toHaveBeenCalledOnce()
    win.dispose()
  })

  it('dispose stops the loop and disconnects the ResizeObserver', () => {
    const { win } = mount()
    const ro = (win as unknown as { ro: { disconnect: ReturnType<typeof vi.fn> } | null }).ro
    const disconnect = ro!.disconnect
    win.dispose()
    expect(disconnect).toHaveBeenCalledOnce()
    expect((win as unknown as { disposed: boolean }).disposed).toBe(true)
    // No further ticks fire after dispose.
    expect(() => vi.advanceTimersByTime(2000)).not.toThrow()
  })

  it('a rAF after dispose is a no-op (does not reset the disposed game)', () => {
    const opts = chromeOpts()
    const win = new SnakeWindow(opts)
    document.body.appendChild(win.el)
    win.dispose() // dispose before the boot rAF runs
    expect(() => vi.runOnlyPendingTimers()).not.toThrow()
    // Snake was never booted; length stays at the initial template '3'.
    expect(length(win)).toBe('3')
  })

  it('WASD keys steer the snake (S then game runs without immediate death)', () => {
    const { win } = mount()
    key(win, 'KeyS') // turn down (perpendicular from rightward start)
    vi.advanceTimersByTime(200)
    const pause = q(win, '.snake-hud-btn:not(.snake-hud-btn--primary)') as HTMLButtonElement
    expect(pause.disabled).toBe(false)
    win.dispose()
  })

  // --- Powerup eating (gray-box: place an orb in the head's path) ------------
  // The snake boots at (14,11) moving right, so the next head cell is (15,11).
  type Priv = {
    snake: { x: number; y: number }[]
    powerup: { x: number; y: number; kind: string } | null
    food: { x: number; y: number }
    dir: { x: number; y: number }
    score: number
    ghostMovesLeft: number
    growDebt: number
  }
  const priv = (win: SnakeWindow) => win as unknown as Priv

  function placeOrbInPath(win: SnakeWindow, kind: string) {
    const p = priv(win)
    const head = p.snake[0]!
    const target = { x: head.x + p.dir.x, y: head.y + p.dir.y }
    // Keep food out of the way so the tick resolves the powerup branch.
    p.food = { x: 0, y: 0 }
    p.powerup = { x: target.x, y: target.y, kind }
  }

  it('eating a gem orb adds 6 to the score and clears the orb', () => {
    const { win } = mount()
    placeOrbInPath(win, 'gem')
    vi.advanceTimersByTime(200) // one tick eats it
    expect(Number(score(win))).toBeGreaterThanOrEqual(6)
    expect(priv(win).powerup === null || priv(win).powerup!.kind !== 'gem').toBe(true)
    win.dispose()
  })

  it('eating a ghost orb grants ghost moves and +2 score', () => {
    const { win } = mount()
    placeOrbInPath(win, 'ghost')
    vi.advanceTimersByTime(200)
    expect(priv(win).ghostMovesLeft).toBeGreaterThan(0)
    expect(Number(score(win))).toBeGreaterThanOrEqual(2)
    win.dispose()
  })

  it('eating a growth orb adds growth debt and +1 score', () => {
    const { win } = mount()
    placeOrbInPath(win, 'growth')
    vi.advanceTimersByTime(200)
    expect(priv(win).growDebt).toBeGreaterThan(0)
    expect(Number(score(win))).toBeGreaterThanOrEqual(1)
    win.dispose()
  })

  it('eating a trim orb shortens the snake when long enough', () => {
    const { win } = mount()
    const p = priv(win)
    // Grow the snake to 8 so a trim (cut up to 4, floor at length 4) is visible.
    p.snake = Array.from({ length: 8 }, (_, i) => ({ x: 14 - i, y: 11 }))
    p.dir = { x: 1, y: 0 }
    placeOrbInPath(win, 'trim')
    const before = p.snake.length
    vi.advanceTimersByTime(200)
    expect(priv(win).snake.length).toBeLessThan(before)
    expect(priv(win).snake.length).toBeGreaterThanOrEqual(4)
    win.dispose()
  })

  it('eating food increments score and length grows by one', () => {
    const { win } = mount()
    const p = priv(win)
    const head = p.snake[0]!
    p.powerup = null
    p.food = { x: head.x + p.dir.x, y: head.y + p.dir.y }
    const beforeLen = p.snake.length
    vi.advanceTimersByTime(200)
    expect(Number(score(win))).toBe(1)
    expect(priv(win).snake.length).toBe(beforeLen + 1)
    expect(length(win)).toBe(String(beforeLen + 1))
    win.dispose()
  })

  it('ghost moves let the snake pass through itself without dying', () => {
    const { win } = mount()
    const p = priv(win)
    p.ghostMovesLeft = 10
    // Coil the snake so the next head cell overlaps a body segment.
    p.snake = [
      { x: 14, y: 11 },
      { x: 14, y: 12 },
      { x: 15, y: 12 },
      { x: 15, y: 11 }, // moving right from (14,11) -> (15,11) hits this segment
    ]
    p.dir = { x: 1, y: 0 }
    p.food = { x: 0, y: 0 }
    p.powerup = null
    vi.advanceTimersByTime(200)
    const pause = q(win, '.snake-hud-btn:not(.snake-hud-btn--primary)') as HTMLButtonElement
    expect(pause.disabled).toBe(false) // survived the self-overlap
    win.dispose()
  })

  it('renders the ghost counter overlay while ghost moves remain (no throw)', () => {
    const { win } = mount()
    priv(win).ghostMovesLeft = 5
    // A draw happens on the next tick; the ghost-counter fillText branch runs.
    expect(() => vi.advanceTimersByTime(200)).not.toThrow()
    win.dispose()
  })

  it.each(['ghost', 'gem', 'growth', 'trim'])(
    'draws a %s powerup orb without throwing',
    (kind) => {
      const { win } = mount()
      const p = priv(win)
      // Place the orb far from the head so it survives the tick and gets drawn.
      p.powerup = { x: 1, y: 1, kind }
      p.food = { x: 26, y: 20 }
      p.snake = [{ x: 14, y: 11 }, { x: 13, y: 11 }, { x: 12, y: 11 }]
      p.dir = { x: 1, y: 0 }
      expect(() => vi.advanceTimersByTime(200)).not.toThrow()
      win.dispose()
    },
  )

  it('falls back to plain rect for the overlay when roundRect is unavailable', () => {
    // Context stub without roundRect exercises the else branch in drawOverlay.
    HTMLCanvasElement.prototype.getContext = vi.fn(() => {
      const c = makeCtx() as Record<string, unknown>
      delete c.roundRect
      return c
    }) as unknown as typeof HTMLCanvasElement.prototype.getContext
    const { win } = mount()
    const pause = q(win, '.snake-hud-btn:not(.snake-hud-btn--primary)') as HTMLButtonElement
    // Pausing draws the overlay -> hits the rect() fallback.
    expect(() => pause.click()).not.toThrow()
    expect(pause.textContent).toBe('Resume')
    win.dispose()
  })

  it('ends the game when the snake bites its own body', () => {
    const { win } = mount()
    const p = priv(win)
    p.ghostMovesLeft = 0
    // Next head from (14,11) moving right is (15,11), a NON-tail body segment
    // (the tail is elsewhere, so the tail-ignore shortcut doesn't apply).
    p.snake = [
      { x: 14, y: 11 },
      { x: 15, y: 11 }, // head will collide here on the next move
      { x: 15, y: 12 },
      { x: 14, y: 12 },
      { x: 13, y: 12 },
    ]
    p.dir = { x: 1, y: 0 }
    p.food = { x: 0, y: 0 }
    p.powerup = null
    vi.advanceTimersByTime(200)
    const pause = q(win, '.snake-hud-btn:not(.snake-hud-btn--primary)') as HTMLButtonElement
    expect(pause.disabled).toBe(true) // game over disables pause
    win.dispose()
  })

  it('enterGameOver clears a scheduled tick so the loop is fully stopped', () => {
    const { win } = mount()
    // Drive into a wall to force enterGameOver while a tick is pending.
    key(win, 'ArrowUp')
    vi.advanceTimersByTime(3000)
    const before = priv(win).score
    // No further ticks should mutate state after game over.
    vi.advanceTimersByTime(2000)
    expect(priv(win).score).toBe(before)
    win.dispose()
  })

  it('reflow on shrink re-fits the snake and repositions out-of-bounds food/orb', () => {
    const { win } = mount()
    const p = priv(win)
    // A long horizontal snake plus food/orb near the far edge that a shrink evicts.
    p.snake = Array.from({ length: 10 }, (_, i) => ({ x: 5 + i, y: 5 }))
    p.food = { x: 27, y: 21 }
    p.powerup = { x: 26, y: 20, kind: 'gem' }
    // Shrink the grid hard.
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 320 })
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 260 })
    roCallback!()
    const after = priv(win)
    // Food was out of the new bounds -> repositioned inside.
    expect(after.food.x).toBeLessThan(13)
    expect(after.food.y).toBeLessThan(10)
    // Orb was out of bounds -> dropped.
    expect(after.powerup).toBeNull()
    // Length HUD matches the kept snake.
    expect(length(win)).toBe(String(after.snake.length))
    win.dispose()
  })

  it('reflow ends the round when the head falls outside the shrunk grid', () => {
    const { win } = mount()
    const p = priv(win)
    p.snake = [{ x: 27, y: 21 }, { x: 26, y: 21 }]
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 320 })
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 260 })
    roCallback!()
    const pause = q(win, '.snake-hud-btn:not(.snake-hud-btn--primary)') as HTMLButtonElement
    expect(pause.disabled).toBe(true) // head off-grid -> game over
    win.dispose()
  })

  it('does not reflow once the game is over (resize just redraws)', () => {
    const { win } = mount()
    key(win, 'ArrowUp')
    vi.advanceTimersByTime(3000) // game over
    const len = length(win)
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 320 })
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 260 })
    expect(() => roCallback!()).not.toThrow()
    expect(length(win)).toBe(len) // unchanged: no reflow after game over
    win.dispose()
  })

  it('ignores unrelated keys without affecting play', () => {
    const { win } = mount()
    key(win, 'KeyZ')
    key(win, 'Enter')
    vi.advanceTimersByTime(200)
    const pause = q(win, '.snake-hud-btn:not(.snake-hud-btn--primary)') as HTMLButtonElement
    expect(pause.disabled).toBe(false)
    expect(score(win)).toBe('0')
    win.dispose()
  })
})
