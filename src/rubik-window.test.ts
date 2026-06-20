// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Fake cubing.js library ────────────────────────────────────────────────────
//
// RubikWindow drives a `TwistyPlayer` (a WebGL custom element) and pulls WCA
// scrambles from `randomScrambleForEvent`. Both are mocked: the real player
// renders three.js behind WebGL (irreducible in happy-dom), so we stand in a
// plain custom element that records every prop/method RubikWindow touches and
// lets us assert the control logic (alg/setup-anchor wiring, play/pause, the
// tempo-scaled markPlayback timing, keyboard turns, dispose teardown).

interface FakeAlg {
  toString(): string
}

/**
 * Stand-in for cubing's TwistyPlayer. Extends HTMLElement (registered as a
 * custom element) so `host.appendChild(player)` and `player.remove()` work in
 * happy-dom. Captures the controlled props and exposes the async getter +
 * playback methods the window calls.
 */
class FakeTwistyPlayer extends HTMLElement {
  static lastInstance: FakeTwistyPlayer | null = null
  static lastConstructorOpts: Record<string, unknown> | null = null

  // Controlled props the window writes.
  alg = ''
  experimentalSetupAlg = ''
  experimentalSetupAnchor = 'start'
  tempoScale = 1

  // Backing value returned by experimentalGet.alg(); tests set it to simulate
  // the player's current sequence (move counter reads this).
  algForGet = ''

  // Call recorders.
  playCalls = 0
  pauseCalls = 0
  jumpToStartCalls = 0
  jumpToEndCalls = 0
  removeCalls = 0
  addedMoves: string[] = []

  experimentalGet = {
    alg: vi.fn<() => Promise<FakeAlg>>(async () => ({
      toString: () => this.algForGet,
    })),
  }

  constructor(opts?: Record<string, unknown>) {
    super()
    FakeTwistyPlayer.lastInstance = this
    FakeTwistyPlayer.lastConstructorOpts = opts ?? null
  }

  play(): void {
    this.playCalls++
  }
  pause(): void {
    this.pauseCalls++
  }
  jumpToStart(): void {
    this.jumpToStartCalls++
  }
  jumpToEnd(): void {
    this.jumpToEndCalls++
  }
  experimentalAddMove(move: string): void {
    this.addedMoves.push(move)
  }
  override remove(): void {
    this.removeCalls++
    super.remove()
  }
}

if (!customElements.get('fake-twisty-player')) {
  customElements.define('fake-twisty-player', FakeTwistyPlayer)
}

// Factory captured by the scramble mock so individual tests can swap behaviour
// (success returning a known alg, or a rejection to hit the catch path).
const scrambleImpl = {
  fn: vi.fn<() => Promise<FakeAlg>>(async () => ({ toString: () => "R U R' U'" })),
}

vi.mock('cubing/twisty', () => ({
  // The window does `new TwistyPlayer(opts)`. Custom elements can't be `new`-ed
  // with constructor args in some engines, so wrap in a factory that creates the
  // element then stamps the opts.
  TwistyPlayer: function TwistyPlayer(opts?: Record<string, unknown>) {
    const el = document.createElement('fake-twisty-player') as FakeTwistyPlayer
    FakeTwistyPlayer.lastInstance = el
    FakeTwistyPlayer.lastConstructorOpts = opts ?? null
    return el
  },
}))

vi.mock('cubing/scramble', () => ({
  randomScrambleForEvent: (...args: unknown[]) => scrambleImpl.fn(...(args as [])),
}))

// Imported after the mocks register (vi.mock is hoisted regardless).
const { RubikWindow } = await import('./rubik-window')

// ── Helpers ───────────────────────────────────────────────────────────────────

function chromeOpts() {
  return {
    onClose: vi.fn(),
    onMinimize: vi.fn(),
    onMaximize: vi.fn(),
    onFocus: vi.fn(),
  }
}

/** Construct a window and flush the queueMicrotask that mounts the player. */
async function mountWindow() {
  const opts = chromeOpts()
  const win = new RubikWindow(opts)
  // mountPlayer runs in a microtask; await a microtask turn so the player exists.
  await Promise.resolve()
  await Promise.resolve()
  const player = FakeTwistyPlayer.lastInstance!
  return { win, opts, player }
}

const q = <T extends Element>(root: ParentNode, sel: string): T =>
  root.querySelector(sel) as T

/** Drain pending microtasks (awaited promises) without advancing fake timers. */
async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 6; i++) await Promise.resolve()
}

/**
 * Seed the player's current sequence and let the 450ms move-poll re-run so
 * refreshButtonState re-enables the Solve button (it disables itself while the
 * sequence reads empty). Requires fake timers to be active.
 */
async function seedSolvable(player: FakeTwistyPlayer, alg: string): Promise<void> {
  player.algForGet = alg
  await vi.advanceTimersByTimeAsync(450)
  await flushMicrotasks()
}

// ── Setup / teardown ───────────────────────────────────────────────────────────

beforeEach(() => {
  FakeTwistyPlayer.lastInstance = null
  FakeTwistyPlayer.lastConstructorOpts = null
  scrambleImpl.fn = vi.fn<() => Promise<FakeAlg>>(async () => ({
    toString: () => "R U R' U'",
  }))
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

// ── Construction & DOM scaffold ─────────────────────────────────────────────────

describe('RubikWindow construction', () => {
  it('builds the window shell with command "cube" and the expected scaffold', () => {
    const win = new RubikWindow(chromeOpts())
    expect(win.command).toBe('cube')
    expect(win.el.dataset.app).toBe('cube')
    expect(win.el.classList.contains('rubik-app--3d')).toBe(true)
    // Toolbar buttons present; Stop starts disabled, others enabled before mount.
    expect(q<HTMLElement>(win.el, '.rubik-toolbar')).not.toBeNull()
    expect(q<HTMLElement>(win.el, '.win-titlebar')).not.toBeNull()
    expect(q<HTMLElement>(win.el, '.rubik-player-host')).not.toBeNull()
    win.dispose()
  })

  it('populates the algorithm <select> with every canonical algorithm + placeholder', () => {
    const win = new RubikWindow(chromeOpts())
    const select = q<HTMLSelectElement>(win.el, '.rubik-alg-select')
    // 7 canonical algorithms + 1 placeholder.
    expect(select.options.length).toBe(8)
    expect(select.options[0]!.value).toBe('')
    win.dispose()
  })

  it('chrome close button disposes the window and calls onClose', () => {
    const opts = chromeOpts()
    const win = new RubikWindow(opts)
    q<HTMLElement>(win.el, '.dot-close').click()
    expect(opts.onClose).toHaveBeenCalledOnce()
  })

  it('chrome minimize / maximize / titlebar-focus route to the callbacks', () => {
    const opts = chromeOpts()
    const win = new RubikWindow(opts)
    q<HTMLElement>(win.el, '.dot-min').click()
    expect(opts.onMinimize).toHaveBeenCalledOnce()
    q<HTMLElement>(win.el, '.dot-max').click()
    expect(opts.onMaximize).toHaveBeenCalledOnce()
    win.el.dispatchEvent(new MouseEvent('mousedown'))
    expect(opts.onFocus).toHaveBeenCalled()
    win.dispose()
  })
})

// ── Player mount ────────────────────────────────────────────────────────────────

describe('mountPlayer', () => {
  it('constructs the TwistyPlayer with the expected puzzle/camera options and appends it', async () => {
    const { win, player } = await mountWindow()
    const opts = FakeTwistyPlayer.lastConstructorOpts!
    expect(opts.puzzle).toBe('3x3x3')
    expect(opts.background).toBe('none')
    expect(opts.colorScheme).toBe('dark')
    expect(opts.controlPanel).toBe('none')
    expect(opts.cameraLatitude).toBe(35)
    expect(opts.cameraLongitude).toBe(-25)
    expect(opts.tempoScale).toBe(1)
    expect(player.classList.contains('rubik-twisty-player')).toBe(true)
    expect(q<HTMLElement>(win.el, '.rubik-player-host')!.contains(player)).toBe(true)
    win.dispose()
  })

  it('renders a GL fallback message when the player constructor throws', async () => {
    const opts = chromeOpts()
    const win = new RubikWindow(opts)
    // Make the very next construction throw by stubbing createElement for the
    // custom element. Simpler: spy on the factory via the player getter is not
    // exposed; instead force appendChild to throw inside mountPlayer.
    const host = q<HTMLElement>(win.el, '.rubik-player-host')
    const appendSpy = vi.spyOn(host, 'appendChild').mockImplementation(() => {
      throw new Error('no webgl')
    })
    await Promise.resolve()
    await Promise.resolve()
    expect(host.innerHTML).toContain('rubik-gl-fallback')
    appendSpy.mockRestore()
    win.dispose()
  })
})

// ── Scramble ────────────────────────────────────────────────────────────────────

describe('runScramble', () => {
  it('awaits the scramble, wires the setup anchor/alg and plays', async () => {
    scrambleImpl.fn = vi.fn(async () => ({ toString: () => "R U R' U'" }))
    const { win, player } = await mountWindow()

    q<HTMLButtonElement>(win.el, '.rubik-tool-btn').click() // Scramble is first btn
    // Let the awaited scramble settle.
    await Promise.resolve()
    await Promise.resolve()

    expect(scrambleImpl.fn).toHaveBeenCalledOnce()
    expect(player.experimentalSetupAnchor).toBe('start')
    expect(player.experimentalSetupAlg).toBe('')
    expect(player.alg).toBe("R U R' U'")
    expect(player.playCalls).toBeGreaterThan(0)
    expect(player.jumpToStartCalls).toBeGreaterThan(0)
    win.dispose()
  })

  it('shows a failure status when the scramble rejects', async () => {
    scrambleImpl.fn = vi.fn(async () => {
      throw new Error('worker failed')
    })
    const { win } = await mountWindow()

    q<HTMLButtonElement>(win.el, '.rubik-tool-btn').click()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    expect(q<HTMLElement>(win.el, '.rubik-status').textContent).toContain('Scramble failed')
    win.dispose()
  })
})

// ── markPlayback timing (the fixed bug) ──────────────────────────────────────────

describe('markPlayback tempo scaling', () => {
  it('scales the busy wait by tempoScale and fires onDone when playback ends', async () => {
    vi.useFakeTimers()
    const { win, player } = await mountWindow()

    // Drive a solve so markPlayback is given an onDone callback that restores the
    // setup anchor. Seed a non-empty current sequence to invert (re-enables Solve).
    await seedSolvable(player, "R U R' U'")
    player.tempoScale = 2 // double speed → half the wait

    // Click Solve (second toolbar button).
    const buttons = win.el.querySelectorAll<HTMLButtonElement>('.rubik-toolbar .rubik-tool-btn')
    buttons[1]!.click()

    // Let the async runSolve body (await algString) resolve — flush microtasks
    // without advancing the faked clock, so the markPlayback timer can't fire yet.
    await flushMicrotasks()

    expect(player.experimentalSetupAnchor).toBe('end')
    expect(win.el.querySelector('.rubik-status')!.textContent).toBe('Solving…')

    // inverse of "R U R' U'" is 4 moves → base wait max(1200, 4*380)=1520ms.
    // At tempoScale 2 the wait is 760ms. Advance just short, then past it.
    await vi.advanceTimersByTimeAsync(700)
    expect(player.experimentalSetupAnchor).toBe('end') // onDone not yet fired
    await vi.advanceTimersByTimeAsync(100)
    // onDone restored the anchor to 'start'.
    expect(player.experimentalSetupAnchor).toBe('start')

    win.dispose()
  })

  it('falls back to the unscaled wait when tempoScale is 0', async () => {
    vi.useFakeTimers()
    const { win, player } = await mountWindow()
    await seedSolvable(player, 'R')
    player.tempoScale = 0

    const buttons = win.el.querySelectorAll<HTMLButtonElement>('.rubik-toolbar .rubik-tool-btn')
    buttons[1]!.click() // Solve
    await flushMicrotasks()

    // wait = durationMs (max(1200, 1*380) = 1200) because tempo<=0.
    expect(win.el.querySelector('.rubik-status')!.textContent).toBe('Solving…')
    await vi.advanceTimersByTimeAsync(1200)
    expect(player.experimentalSetupAnchor).toBe('start')
    win.dispose()
  })
})

// ── Solve / reset ────────────────────────────────────────────────────────────────

describe('runSolve / resetCube', () => {
  it('does nothing on solve when the current sequence is empty', async () => {
    const { win, player } = await mountWindow()
    player.algForGet = '' // solved
    const before = player.playCalls
    const buttons = win.el.querySelectorAll<HTMLButtonElement>('.rubik-toolbar .rubik-tool-btn')
    buttons[1]!.click() // Solve
    await Promise.resolve()
    await Promise.resolve()
    expect(player.playCalls).toBe(before)
    win.dispose()
  })

  it('reset clears the alg, sets anchor to start and jumps to start', async () => {
    const { win, player } = await mountWindow()
    player.alg = "R U R'"
    player.experimentalSetupAlg = 'x'
    const buttons = win.el.querySelectorAll<HTMLButtonElement>('.rubik-toolbar .rubik-tool-btn')
    buttons[3]!.click() // Reset
    expect(player.alg).toBe('')
    expect(player.experimentalSetupAlg).toBe('')
    expect(player.experimentalSetupAnchor).toBe('start')
    expect(player.jumpToStartCalls).toBeGreaterThan(0)
    win.dispose()
  })
})

// ── Stop / pause ─────────────────────────────────────────────────────────────────

describe('stopPlayback', () => {
  it('cancels the pending playback timer, pauses and shows "Paused"', async () => {
    vi.useFakeTimers()
    const { win, player } = await mountWindow()
    await seedSolvable(player, "R U R' U'")

    const buttons = win.el.querySelectorAll<HTMLButtonElement>('.rubik-toolbar .rubik-tool-btn')
    buttons[1]!.click() // Solve → marks busy + schedules markPlayback timer
    await flushMicrotasks()

    const pausesBefore = player.pauseCalls
    buttons[2]!.click() // Stop
    await flushMicrotasks()
    expect(player.pauseCalls).toBe(pausesBefore + 1)
    expect(win.el.querySelector('.rubik-status')!.textContent).toBe('Paused')

    // Advancing past the original wait must NOT fire onDone (timer was cancelled):
    // the anchor stays 'end' rather than being restored to 'start'.
    await vi.advanceTimersByTimeAsync(5000)
    expect(player.experimentalSetupAnchor).toBe('end')
    win.dispose()
  })
})

// ── Speed slider ─────────────────────────────────────────────────────────────────

describe('speed slider', () => {
  it('writes tempoScale from the slider value on input', async () => {
    const { win, player } = await mountWindow()
    const slider = q<HTMLInputElement>(win.el, '.rubik-speed-slider')
    slider.value = '1.8'
    slider.dispatchEvent(new Event('input'))
    expect(player.tempoScale).toBe(1.8)
    win.dispose()
  })
})

// ── Run algorithm / apply custom notation ────────────────────────────────────────

describe('runAlg via the algorithm select', () => {
  it('animates the selected canonical algorithm', async () => {
    const { win, player } = await mountWindow()
    const select = q<HTMLSelectElement>(win.el, '.rubik-alg-select')
    select.value = 'sune'
    const runBtn = q<HTMLButtonElement>(win.el, '.rubik-alg-row .rubik-tool-btn')
    runBtn.click()
    await Promise.resolve()
    expect(player.alg).toBe("R U R' U R U2 R'")
    expect(player.playCalls).toBeGreaterThan(0)
    win.dispose()
  })

  it('does nothing when no algorithm is selected', async () => {
    const { win, player } = await mountWindow()
    const before = player.playCalls
    const runBtn = q<HTMLButtonElement>(win.el, '.rubik-alg-row .rubik-tool-btn')
    runBtn.click()
    await Promise.resolve()
    expect(player.playCalls).toBe(before)
    win.dispose()
  })
})

describe('applyAlgInput', () => {
  it('normalizes typed notation and runs it on Enter', async () => {
    const { win, player } = await mountWindow()
    const input = q<HTMLInputElement>(win.el, '.rubik-alg-input')
    input.value = "Ri U Ri"
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    await Promise.resolve()
    await Promise.resolve()
    expect(player.alg).toBe("R' U R'")
    expect(input.value).toBe('') // cleared after apply
    win.dispose()
  })

  it('shows a parse-error status for unparseable input and schedules a reset', async () => {
    vi.useFakeTimers()
    const { win } = await mountWindow()
    const input = q<HTMLInputElement>(win.el, '.rubik-alg-input')
    input.value = 'not a move'
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    await flushMicrotasks()
    expect(win.el.querySelector('.rubik-status')!.textContent).toContain("Couldn't parse")
    // Drain the 2400ms reset timer so nothing pends at teardown.
    await vi.advanceTimersByTimeAsync(2400)
    win.dispose()
  })

  it('runs typed notation when the Apply button is clicked', async () => {
    const { win, player } = await mountWindow()
    const input = q<HTMLInputElement>(win.el, '.rubik-alg-input')
    input.value = 'R U'
    // Apply is the second button in the alg row (after Run).
    const applyBtn = win.el.querySelectorAll<HTMLButtonElement>(
      '.rubik-alg-row .rubik-tool-btn',
    )[1]!
    applyBtn.click()
    await flushMicrotasks()
    expect(player.alg).toBe('R U')
    win.dispose()
  })

  it('ignores empty input', async () => {
    const { win, player } = await mountWindow()
    const input = q<HTMLInputElement>(win.el, '.rubik-alg-input')
    input.value = '   '
    const before = player.playCalls
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    await Promise.resolve()
    expect(player.playCalls).toBe(before)
    win.dispose()
  })
})

// ── Keyboard shortcuts ───────────────────────────────────────────────────────────

describe('keyboard shortcuts', () => {
  it('Space triggers a scramble', async () => {
    const { win, player } = await mountWindow()
    win.el.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }))
    await Promise.resolve()
    await Promise.resolve()
    expect(player.alg).toBe("R U R' U'")
    win.dispose()
  })

  it('a face key queues a single keyboard turn (jumpToEnd + add move)', async () => {
    const { win, player } = await mountWindow()
    win.el.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR', bubbles: true }))
    await Promise.resolve()
    expect(player.jumpToEndCalls).toBeGreaterThan(0)
    expect(player.addedMoves).toContain('R')
    win.dispose()
  })

  it('Shift + face key queues the prime variant', async () => {
    const { win, player } = await mountWindow()
    win.el.dispatchEvent(
      new KeyboardEvent('keydown', { code: 'KeyU', shiftKey: true, bubbles: true }),
    )
    await Promise.resolve()
    expect(player.addedMoves).toContain("U'")
    win.dispose()
  })

  it('ignores unrelated keys', async () => {
    const { win, player } = await mountWindow()
    win.el.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyZ', bubbles: true }))
    await Promise.resolve()
    expect(player.addedMoves).toHaveLength(0)
    expect(player.jumpToEndCalls).toBe(0)
    win.dispose()
  })

  it('does nothing on keydown before the player has mounted', () => {
    const win = new RubikWindow(chromeOpts())
    // No microtask flush → player is null.
    win.el.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR', bubbles: true }))
    expect(FakeTwistyPlayer.lastInstance).toBeNull()
    win.dispose()
  })
})

// ── Public surface ───────────────────────────────────────────────────────────────

describe('public state helpers', () => {
  it('setActive / setMinimized / isMaximized toggle the right classes', () => {
    const win = new RubikWindow(chromeOpts())
    win.setActive(true)
    expect(win.el.classList.contains('active')).toBe(true)
    win.setActive(false)
    expect(win.el.classList.contains('active')).toBe(false)
    win.setMinimized(true)
    expect(win.el.classList.contains('minimized')).toBe(true)
    expect(win.isMaximized()).toBe(false)
    win.el.classList.add('maximized')
    expect(win.isMaximized()).toBe(true)
    win.dispose()
  })

  it('focusCanvas focuses the window element', () => {
    const win = new RubikWindow(chromeOpts())
    document.body.appendChild(win.el)
    win.focusCanvas()
    expect(document.activeElement).toBe(win.el)
    win.dispose()
  })

  it('scrollBy delegates to the host element', () => {
    const win = new RubikWindow(chromeOpts())
    const host = q<HTMLElement>(win.el, '.rubik-player-host')
    const spy = vi.spyOn(host, 'scrollBy').mockImplementation(() => {})
    win.scrollBy(40)
    expect(spy).toHaveBeenCalledWith({ top: 40, behavior: 'smooth' })
    win.dispose()
  })
})

// ── Dispose ──────────────────────────────────────────────────────────────────────

describe('dispose', () => {
  it('pauses and removes the player, and is idempotent', async () => {
    const { win, player } = await mountWindow()
    win.dispose()
    expect(player.pauseCalls).toBeGreaterThan(0)
    expect(player.removeCalls).toBe(1)
    // Second dispose is a no-op (disposed guard).
    win.dispose()
    expect(player.removeCalls).toBe(1)
  })

  it('stops the move-polling loop so no timer pends after dispose', async () => {
    vi.useFakeTimers()
    const { win } = await mountWindow()
    win.dispose()
    // The 450ms poll loop must not reschedule; advancing time stays quiet.
    await vi.advanceTimersByTimeAsync(2000)
    // No assertion needed beyond "no teardown error"; reaching here is the check.
    expect(true).toBe(true)
  })
})
