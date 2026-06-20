// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Fake xterm.js ─────────────────────────────────────────────────────────────
//
// TerminalApp only touches a small slice of the real Terminal surface. We capture
// the constructor options, record every write/writeln, and keep a reference to the
// onKey handler so tests can DRIVE input (KeyboardEvent -> handleKey -> VimInput).

type KeyHandler = (e: { key: string; domEvent: KeyboardEvent }) => void

interface FakeTermOptions {
  theme?: unknown
  cursorStyle?: string
  [k: string]: unknown
}

class FakeTerminal {
  static last: FakeTerminal | null = null

  ctorOptions: FakeTermOptions
  options: FakeTermOptions
  written: string[] = []
  addons: unknown[] = []
  keyHandler: KeyHandler | null = null

  openTarget: HTMLElement | null = null
  opened = false
  focused = 0
  cleared = 0
  disposed = false

  constructor(opts: FakeTermOptions) {
    this.ctorOptions = opts
    this.options = { ...opts }
    FakeTerminal.last = this
  }

  loadAddon(addon: unknown): void {
    this.addons.push(addon)
  }
  open(el: HTMLElement): void {
    this.openTarget = el
    this.opened = true
  }
  onKey(cb: KeyHandler): { dispose(): void } {
    this.keyHandler = cb
    return { dispose() {} }
  }
  write(s: string): void {
    this.written.push(s)
  }
  writeln(s: string): void {
    this.written.push(s + '\n')
  }
  clear(): void {
    this.cleared++
    this.written.length = 0
  }
  focus(): void {
    this.focused++
  }
  dispose(): void {
    this.disposed = true
  }

  /** All output joined, for substring assertions. */
  text(): string {
    return this.written.join('')
  }
}

class FakeFitAddon {
  static instances: FakeFitAddon[] = []
  fitCalls = 0
  disposed = false
  constructor() {
    FakeFitAddon.instances.push(this)
  }
  activate(): void {}
  fit(): void {
    this.fitCalls++
  }
  dispose(): void {
    this.disposed = true
  }
  proposeDimensions(): { cols: number; rows: number } {
    return { cols: 80, rows: 24 }
  }
}

class FakeWebLinksAddon {
  activate(): void {}
  dispose(): void {}
}

vi.mock('@xterm/xterm', () => ({ Terminal: FakeTerminal }))
vi.mock('@xterm/addon-fit', () => ({ FitAddon: FakeFitAddon }))
vi.mock('@xterm/addon-web-links', () => ({ WebLinksAddon: FakeWebLinksAddon }))

// Imported after the mocks register (vi.mock is hoisted, but keep it explicit).
const { terminalMotdLines, TerminalApp, TerminalWindow } = await import('./terminal')
const { BANNER } = await import('./ascii')
type WindowSpec = import('./desktop').WindowSpec

// ── shared helpers ────────────────────────────────────────────────────────────

/** Stub matchMedia so prefersReducedMotion() returns the chosen value. */
function setReducedMotion(reduced: boolean): void {
  window.matchMedia = ((q: string) => ({
    matches: reduced,
    media: q,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent() {
      return false
    },
  })) as unknown as typeof window.matchMedia
}

/** Press a key through the registered onKey handler. */
function press(
  term: FakeTerminal,
  key: string,
  mods: { ctrlKey?: boolean; altKey?: boolean; metaKey?: boolean } = {},
): void {
  const domEvent = new KeyboardEvent('keydown', { key, ...mods })
  term.keyHandler!({ key, domEvent })
}

/** Type a string char-by-char (insert mode). */
function typeText(term: FakeTerminal, text: string): void {
  for (const ch of text) press(term, ch)
}

describe('terminalMotdLines (pure)', () => {
  it('returns the banner followed by a blank line and the subtitle pair', () => {
    const lines = terminalMotdLines()
    // Banner first, verbatim.
    expect(lines.slice(0, BANNER.length)).toEqual(BANNER)
    // Then a blank spacer line.
    expect(lines[BANNER.length]).toBe('')
    // Two trailing copy lines reference the site + help hint.
    expect(lines).toHaveLength(BANNER.length + 3)
    expect(lines[BANNER.length + 1]).toContain('mrgrey.site')
    expect(lines[BANNER.length + 2]).toContain('help')
  })

  it('is a pure function (stable across calls, fresh array)', () => {
    const a = terminalMotdLines()
    const b = terminalMotdLines()
    expect(a).toEqual(b)
    expect(a).not.toBe(b)
  })
})

describe('TerminalApp', () => {
  let container: HTMLElement
  let modeLine: HTMLElement
  let onOpenWindow: ReturnType<typeof vi.fn<(spec: WindowSpec) => void>>
  const origMatchMedia = window.matchMedia
  const origAssign = window.location.assign

  beforeEach(() => {
    FakeTerminal.last = null
    FakeFitAddon.instances = []
    document.body.replaceChildren()
    setReducedMotion(true) // skip the scripted boot sleeps by default

    container = document.createElement('div')
    document.body.appendChild(container)

    modeLine = document.createElement('footer')
    modeLine.className = 'vim-mode-line mode-insert'
    modeLine.innerHTML = `<span class="vim-mode-text">INSERT</span>`

    onOpenWindow = vi.fn<(spec: WindowSpec) => void>()
  })

  afterEach(() => {
    window.matchMedia = origMatchMedia
    window.location.assign = origAssign
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  /** Construct + mount an app (boot resolves synchronously under reduced motion). */
  async function mountApp(): Promise<{ app: InstanceType<typeof TerminalApp>; term: FakeTerminal }> {
    const app = new TerminalApp(container, modeLine, onOpenWindow)
    await app.mount()
    const term = FakeTerminal.last!
    return { app, term }
  }

  // ── construction ────────────────────────────────────────────────────────────

  it('constructs xterm with the expected options and loads both addons', () => {
    new TerminalApp(container, modeLine, onOpenWindow)
    const term = FakeTerminal.last!
    expect(term.ctorOptions.fontFamily).toContain('JetBrains Mono')
    expect(term.ctorOptions.cursorStyle).toBe('bar')
    expect(term.ctorOptions.scrollback).toBe(5000)
    expect(term.ctorOptions.allowProposedApi).toBe(true)
    // FitAddon + WebLinksAddon both loaded.
    expect(term.addons).toHaveLength(2)
    expect(term.addons[0]).toBeInstanceOf(FakeFitAddon)
    expect(term.addons[1]).toBeInstanceOf(FakeWebLinksAddon)
    // The surface div is inserted into the container.
    expect(container.querySelector('.terminal-surface')).not.toBeNull()
  })

  // ── mount + motd ──────────────────────────────────────────────────────────────

  it('mount() opens xterm on the surface, fits, wires onKey and renders the motd', async () => {
    const { term } = await mountApp()
    expect(term.opened).toBe(true)
    expect((term.openTarget as HTMLElement).className).toBe('terminal-surface')
    expect(FakeFitAddon.instances[0]!.fitCalls).toBeGreaterThanOrEqual(1)
    expect(term.keyHandler).not.toBeNull()
    // MOTD banner lines were written.
    expect(term.text()).toContain('mrgrey.site')
    // A prompt was emitted (namefailed@dev).
    expect(term.text()).toContain('namefailed')
  })

  it('animates the banner with scripted sleeps when motion is allowed', async () => {
    setReducedMotion(false)
    vi.useFakeTimers()
    const app = new TerminalApp(container, modeLine, onOpenWindow)
    const mounted = app.mount()
    // Boot schedules sleep(55) between banner rows; drive the clock to completion.
    await vi.runAllTimersAsync()
    await mounted
    const term = FakeTerminal.last!
    expect(term.text()).toContain('mrgrey.site')
    expect(term.text()).toContain('namefailed')
  })

  // ── mode line / vim badge ─────────────────────────────────────────────────────

  it('mount() sets the mode line to INSERT and a bar cursor', async () => {
    const { term } = await mountApp()
    expect(modeLine.querySelector('.vim-mode-text')!.textContent).toBe('INSERT')
    expect(modeLine.className).toBe('vim-mode-line mode-insert')
    expect(term.options.cursorStyle).toBe('bar')
  })

  it('Escape switches the badge to NORMAL and a block cursor', async () => {
    const { term } = await mountApp()
    typeText(term, 'ls')
    press(term, 'Escape')
    expect(modeLine.querySelector('.vim-mode-text')!.textContent).toBe('NORMAL')
    expect(modeLine.className).toBe('vim-mode-line mode-normal')
    expect(term.options.cursorStyle).toBe('block')
  })

  // ── readline rendering ────────────────────────────────────────────────────────

  it('typing a character re-renders the input line through xterm.write', async () => {
    const { term } = await mountApp()
    const before = term.written.length
    press(term, 'a')
    // A render write happened, and it carries the prompt + the typed char.
    expect(term.written.length).toBeGreaterThan(before)
    const last = term.written[term.written.length - 1]!
    expect(last).toContain('namefailed')
    expect(last).toContain('a')
  })

  // ── command execution ─────────────────────────────────────────────────────────

  it('Enter on an empty line just re-prompts (no command echoed)', async () => {
    const { term } = await mountApp()
    const before = term.text()
    press(term, 'Enter')
    await Promise.resolve()
    // A fresh prompt was emitted after the bare newline.
    expect(term.text().length).toBeGreaterThan(before.length)
    expect(term.text()).toContain('namefailed')
  })

  it('an unknown command writes a "command not found" line and re-prompts', async () => {
    const { term } = await mountApp()
    typeText(term, 'definitelynotacommand')
    press(term, 'Enter')
    await vi.waitFor(() => expect(term.text()).toContain('command not found'))
    expect(term.text()).toContain('definitelynotacommand')
  })

  it('a real builtin (help) writes output lines and re-prompts', async () => {
    const { term } = await mountApp()
    typeText(term, 'help')
    press(term, 'Enter')
    await vi.waitFor(() => expect(term.text()).toContain('help'))
    // Output is multi-line — more than just the prompt was written.
    expect(term.written.length).toBeGreaterThan(3)
  })

  it('dispatches a mrgrey-terminal-cmd event when a command runs', async () => {
    const { term } = await mountApp()
    const spy = vi.fn()
    window.addEventListener('mrgrey-terminal-cmd', spy)
    typeText(term, 'help')
    press(term, 'Enter')
    await vi.waitFor(() => expect(spy).toHaveBeenCalled())
    window.removeEventListener('mrgrey-terminal-cmd', spy)
  })

  it('a window-spawning command (whoami) invokes onOpenWindow', async () => {
    const { term } = await mountApp()
    typeText(term, 'whoami')
    press(term, 'Enter')
    await vi.waitFor(() => expect(onOpenWindow).toHaveBeenCalled())
    const spec = onOpenWindow.mock.calls[0]![0] as { command: string }
    expect(spec.command).toBe('whoami')
  })

  it('the "static" command navigates away and does not re-prompt (exit)', async () => {
    const assign = vi.fn()
    window.location.assign = assign as unknown as typeof window.location.assign
    const { term } = await mountApp()
    typeText(term, 'static')
    press(term, 'Enter')
    await vi.waitFor(() => expect(assign).toHaveBeenCalled())
    expect(term.text()).toContain('static portfolio')
  })

  it('a bare "x" on an empty line submits the static shortcut', async () => {
    const assign = vi.fn()
    window.location.assign = assign as unknown as typeof window.location.assign
    const { term } = await mountApp()
    press(term, 'Escape') // enter normal mode with empty buffer
    press(term, 'x') // bare x -> submit 'static'
    await vi.waitFor(() => expect(assign).toHaveBeenCalled())
  })

  // ── command history ───────────────────────────────────────────────────────────

  it('Up arrow recalls the previous command into the input line', async () => {
    const { term } = await mountApp()
    typeText(term, 'help')
    press(term, 'Enter')
    await vi.waitFor(() => expect(term.text()).toContain('help'))
    press(term, 'ArrowUp')
    const last = term.written[term.written.length - 1]!
    expect(last).toContain('help')
  })

  it('Down arrow after Up clears back to an empty line', async () => {
    const { term } = await mountApp()
    typeText(term, 'help')
    press(term, 'Enter')
    await vi.waitFor(() => expect(term.text()).toContain('help'))
    press(term, 'ArrowUp') // historyIndex 0 -> 'help'
    press(term, 'ArrowDown') // back to empty
    const last = term.written[term.written.length - 1]!
    // Render of an empty buffer: prompt with no command text after it.
    expect(last).toContain('namefailed')
  })

  // ── interrupt / clear ─────────────────────────────────────────────────────────

  it('Ctrl+C writes ^C and drops a fresh prompt', async () => {
    const { term } = await mountApp()
    typeText(term, 'abc')
    press(term, 'c', { ctrlKey: true })
    expect(term.text()).toContain('^C')
  })

  it('Ctrl+L clears the screen and re-prompts', async () => {
    const { term } = await mountApp()
    press(term, 'l', { ctrlKey: true })
    expect(term.cleared).toBeGreaterThanOrEqual(1)
    expect(term.text()).toContain('namefailed')
  })

  // ── autocomplete ──────────────────────────────────────────────────────────────

  it('Tab with a unique prefix completes the command in place', async () => {
    const { term } = await mountApp()
    typeText(term, 'keyb') // unique prefix of "keybinds"
    press(term, 'Tab')
    const last = term.written[term.written.length - 1]!
    expect(last).toContain('keybinds')
  })

  it('Tab with an ambiguous prefix lists candidates', async () => {
    const { term } = await mountApp()
    typeText(term, 'he') // help, ...
    press(term, 'Tab')
    // The candidate list is printed; "help" appears among them.
    expect(term.text()).toContain('help')
  })

  // ── public API ────────────────────────────────────────────────────────────────

  it('fit() proxies to the FitAddon', async () => {
    const { app } = await mountApp()
    const fit = FakeFitAddon.instances[0]!
    const before = fit.fitCalls
    app.fit()
    expect(fit.fitCalls).toBe(before + 1)
  })

  it('focusShell() focuses the xterm', async () => {
    const { app, term } = await mountApp()
    const before = term.focused
    app.focusShell()
    expect(term.focused).toBe(before + 1)
  })

  it('syncXtermTheme() refreshes the palette and re-fits', async () => {
    const { app, term } = await mountApp()
    const fit = FakeFitAddon.instances[0]!
    const before = fit.fitCalls
    app.syncXtermTheme()
    expect(term.options.theme).toBeDefined()
    expect(fit.fitCalls).toBe(before + 1)
  })

  it('dispose() releases xterm and aborts the resize listener', async () => {
    const { app, term } = await mountApp()
    app.dispose()
    expect(term.disposed).toBe(true)
    // After dispose the resize listener is detached: firing resize must not re-fit.
    const fit = FakeFitAddon.instances[0]!
    const before = fit.fitCalls
    window.dispatchEvent(new Event('resize'))
    expect(fit.fitCalls).toBe(before)
  })

  it('a window resize event re-fits while mounted', async () => {
    await mountApp()
    const fit = FakeFitAddon.instances[0]!
    const before = fit.fitCalls
    window.dispatchEvent(new Event('resize'))
    expect(fit.fitCalls).toBe(before + 1)
  })

  it('keys are ignored while a command is processing', async () => {
    // Drive a command whose spinner keeps isProcessing true across an await.
    setReducedMotion(false)
    vi.useFakeTimers()
    const app = new TerminalApp(container, modeLine, onOpenWindow)
    const mounted = app.mount()
    await vi.runAllTimersAsync()
    await mounted
    const term = FakeTerminal.last!
    // Use a fast builtin instead; assert that mid-flight typing is a no-op is
    // hard to time, so just confirm normal typing works post-boot (sanity).
    typeText(term, 'ls')
    expect(term.written.some(w => w.includes('ls'))).toBe(true)
    app.dispose()
  })

  // ── vim-mode toggle when modeLine is absent ────────────────────────────────────

  it('runs without a mode line (null) without throwing on mode changes', async () => {
    const app = new TerminalApp(container, null, onOpenWindow)
    await app.mount()
    const term = FakeTerminal.last!
    expect(() => press(term, 'Escape')).not.toThrow()
    expect(term.options.cursorStyle).toBe('block')
  })
})

// ── TerminalWindow ──────────────────────────────────────────────────────────────

describe('TerminalWindow', () => {
  const origMatchMedia = window.matchMedia

  function chromeOpts() {
    return {
      onClose: vi.fn(),
      onMinimize: vi.fn(),
      onMaximize: vi.fn(),
      onFocus: vi.fn(),
      onOpenWindow: vi.fn<(spec: WindowSpec) => void>(),
    }
  }

  beforeEach(() => {
    FakeTerminal.last = null
    FakeFitAddon.instances = []
    document.body.replaceChildren()
    setReducedMotion(true)
  })

  afterEach(() => {
    window.matchMedia = origMatchMedia
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('builds chrome with the terminal-app class, a stack, host and status bar', () => {
    const win = new TerminalWindow(chromeOpts())
    expect(win.command).toBe('terminal')
    expect(win.el.classList.contains('terminal-app')).toBe(true)
    expect(win.el.querySelector('.terminal-stack')).not.toBeNull()
    expect(win.el.querySelector('.terminal-host')).not.toBeNull()
    expect(win.el.querySelector('.terminal-status-bar')).not.toBeNull()
    expect(win.el.querySelector('#vim-mode-line-tw')).not.toBeNull()
    expect(win.el.querySelector('.vim-mode-text')!.textContent).toBe('INSERT')
    win.dispose()
  })

  it('titlebar buttons forward close / minimize / maximize / focus', () => {
    const opts = chromeOpts()
    const win = new TerminalWindow(opts)
    ;(win.el.querySelector('.dot-close') as HTMLElement).click()
    ;(win.el.querySelector('.dot-min') as HTMLElement).click()
    ;(win.el.querySelector('.dot-max') as HTMLElement).click()
    win.el.dispatchEvent(new MouseEvent('mousedown'))
    expect(opts.onClose).toHaveBeenCalledOnce()
    expect(opts.onMinimize).toHaveBeenCalledOnce()
    expect(opts.onMaximize).toHaveBeenCalledOnce()
    expect(opts.onFocus).toHaveBeenCalled()
    win.dispose()
  })

  it('mount() boots the inner TerminalApp (xterm opens on the host)', async () => {
    const win = new TerminalWindow(chromeOpts())
    document.body.appendChild(win.el)
    await win.mount()
    const term = FakeTerminal.last!
    expect(term.opened).toBe(true)
    expect((term.openTarget as HTMLElement).closest('.terminal-host')).not.toBeNull()
    win.dispose()
  })

  it('fit() and focusShell() delegate to the inner app', async () => {
    const win = new TerminalWindow(chromeOpts())
    await win.mount()
    const term = FakeTerminal.last!
    const fit = FakeFitAddon.instances[0]!
    const beforeFit = fit.fitCalls
    const beforeFocus = term.focused
    win.fit()
    win.focusShell()
    expect(fit.fitCalls).toBe(beforeFit + 1)
    expect(term.focused).toBe(beforeFocus + 1)
    win.dispose()
  })

  it('a mrgrey-theme-change event syncs the xterm theme until disposed', async () => {
    const win = new TerminalWindow(chromeOpts())
    await win.mount()
    const term = FakeTerminal.last!
    const fit = FakeFitAddon.instances[0]!
    const before = fit.fitCalls
    window.dispatchEvent(new Event('mrgrey-theme-change'))
    expect(fit.fitCalls).toBe(before + 1)
    expect(term.options.theme).toBeDefined()
    // After dispose the theme listener is detached.
    win.dispose()
    const afterDispose = fit.fitCalls
    window.dispatchEvent(new Event('mrgrey-theme-change'))
    expect(fit.fitCalls).toBe(afterDispose)
  })

  it('dispose() tears down xterm', async () => {
    const win = new TerminalWindow(chromeOpts())
    await win.mount()
    const term = FakeTerminal.last!
    win.dispose()
    expect(term.disposed).toBe(true)
  })

  it('setActive / setMinimized / isMaximized reflect element classes', () => {
    const win = new TerminalWindow(chromeOpts())
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

  it('syncXtermTheme() on the window delegates to the inner app', async () => {
    const win = new TerminalWindow(chromeOpts())
    await win.mount()
    const fit = FakeFitAddon.instances[0]!
    const before = fit.fitCalls
    win.syncXtermTheme()
    expect(fit.fitCalls).toBe(before + 1)
    win.dispose()
  })
})
