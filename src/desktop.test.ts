/**
 * Desktop WM integration tests (focus, keyboard chords, tile cap).
 * Uses a lightweight DOM shim — Vitest runs in Node, not jsdom.
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { windowSpecForCommand } from './desktop-window-spec'
import type { WindowSpec } from './appwindow'
import { playOsSound } from './os-sound'
import { mountDesktopEmptyCta } from './desktop-empty-cta'
import { mountDesktopTiles } from './desktop-tiles'

vi.mock('./os-sound', () => ({ playOsSound: vi.fn() }))
vi.mock('./welcome-guide', () => ({ mountWelcomeGuide: vi.fn() }))
vi.mock('./desktop-tiles', () => ({ mountDesktopTiles: vi.fn() }))
vi.mock('./desktop-personalize', () => ({ initDesktopPersonalize: vi.fn() }))
vi.mock('./splitter', () => ({ Splitter: vi.fn() }))
vi.mock('./os-registry', () => ({ setDesktopRef: vi.fn() }))
vi.mock('./desktop-empty-cta', () => ({
  mountDesktopEmptyCta: vi.fn(),
  syncDesktopEmptyCta: vi.fn(),
}))

// Mock the xterm-backed terminal with a fully-synchronous fake tile so the
// terminal-tile orchestration paths run without dynamic import / pending async.
const terminalFit = vi.fn<() => void>()
const terminalFocusShell = vi.fn<() => void>()
const terminalDispose = vi.fn<() => void>()
vi.mock('./terminal', () => {
  class FakeTerminalWindow {
    readonly command = 'terminal'
    readonly el: { classList: { toggle(c: string, on?: boolean): void; contains(c: string): boolean }; remove(): void }
    onFocus: () => void
    constructor(opts: { onFocus?: () => void }) {
      // Built via the stubbed document so it slots into the FakeEl tree like a real tile.
      const el = (document as unknown as { createElement(t: string): unknown }).createElement('div') as {
        className: string
        classList: { toggle(c: string, on?: boolean): void; contains(c: string): boolean }
        remove(): void
      }
      el.className = 'app-window content-window'
      this.el = el
      this.onFocus = opts.onFocus ?? ((): void => {})
    }
    mount(): Promise<void> { return Promise.resolve() }
    fit(): void { terminalFit() }
    focusShell(): void { terminalFocusShell() }
    setActive(active: boolean): void { this.el.classList.toggle('active', active) }
    setMinimized(min: boolean): void { this.el.classList.toggle('minimized', min) }
    isMaximized(): boolean { return this.el.classList.contains('maximized') }
    dispose(): void { terminalDispose() }
  }
  return { TerminalWindow: FakeTerminalWindow }
})

// ── Minimal DOM shim ─────────────────────────────────────────────────────────

class FakeClassList {
  private readonly owner: FakeEl
  constructor(owner: FakeEl) { this.owner = owner }
  toggle(cls: string, on?: boolean): void {
    const parts = new Set(this.owner.className.split(/\s+/).filter(Boolean))
    if (on === undefined) {
      if (parts.has(cls)) parts.delete(cls)
      else parts.add(cls)
    } else if (on) parts.add(cls)
    else parts.delete(cls)
    this.owner.className = [...parts].join(' ')
  }
  add(cls: string): void { this.toggle(cls, true) }
  remove(cls: string): void { this.toggle(cls, false) }
  contains(cls: string): boolean {
    return this.owner.className.split(/\s+/).filter(Boolean).includes(cls)
  }
}

type Rect = { left: number; top: number; width: number; height: number }

class FakeEl {
  tagName: string
  className = ''
  readonly classList: FakeClassList
  dataset: Record<string, string> = {}
  style: Record<string, string> = {}
  textContent = ''
  tabIndex = 0
  hidden = false
  id = ''
  type = ''
  value = ''
  title = ''
  spellcheck = true
  autocapitalize = ''
  autocomplete = ''
  wrap = ''
  alt = ''
  src = ''
  loading = ''
  decoding = ''
  disabled = false
  readonly children: FakeEl[] = []
  parent: FakeEl | null = null
  private listeners = new Map<string, Set<(e: unknown) => void>>()
  rect: Rect = { left: 0, top: 0, width: 400, height: 300 }

  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase()
    this.classList = new FakeClassList(this)
  }

  get clientWidth(): number { return 1200 }
  get clientHeight(): number { return 800 }
  get isConnected(): boolean { return this.parent !== null }

  appendChild(child: FakeEl): FakeEl {
    if (child.parent) child.parent._detach(child)
    child.parent = this
    this.children.push(child)
    return child
  }

  append(...nodes: FakeEl[]): void {
    for (const n of nodes) this.appendChild(n)
  }

  prepend(child: FakeEl): void {
    if (child.parent) child.parent._detach(child)
    child.parent = this
    this.children.unshift(child)
  }

  replaceChildren(...nodes: FakeEl[]): void {
    for (const c of [...this.children]) c.remove()
    for (const n of nodes) this.appendChild(n)
  }

  remove(): void {
    if (this.parent) this.parent._detach(this)
  }

  _detach(child: FakeEl): void {
    const i = this.children.indexOf(child)
    if (i !== -1) this.children.splice(i, 1)
    child.parent = null
  }

  addEventListener(type: string, fn: (e: unknown) => void): void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set())
    this.listeners.get(type)!.add(fn)
  }

  removeEventListener(type: string, fn: (e: unknown) => void): void {
    this.listeners.get(type)?.delete(fn)
  }

  dispatch(type: string, ev: unknown): void {
    for (const fn of this.listeners.get(type) ?? []) fn(ev)
  }

  set innerHTML(html: string) {
    this.children.length = 0
    if (!html.trim()) return
    const title = html.match(/class="win-title"[^>]*>([^<]*)/)
    const left = new FakeEl('div')
    left.className = 'win-title-left'
    const titleEl = new FakeEl('span')
    titleEl.className = 'win-title'
    titleEl.textContent = (title?.[1] ?? '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    left.appendChild(titleEl)
    const traffic = new FakeEl('div')
    traffic.className = 'win-traffic'
    for (const cls of ['dot-min', 'dot-max', 'dot-close']) {
      const dot = new FakeEl('span')
      dot.className = `dot ${cls}`
      traffic.appendChild(dot)
    }
    this.appendChild(left)
    this.appendChild(traffic)
  }

  querySelector(selector: string): FakeEl | null {
    const match = (el: FakeEl): FakeEl | null => {
      if (selector.startsWith('.') && el.className.split(/\s+/).includes(selector.slice(1))) return el
      if (selector === `#${el.id}` && el.id) return el
      for (const c of el.children) {
        const hit = match(c)
        if (hit) return hit
      }
      return null
    }
    for (const c of this.children) {
      const hit = match(c)
      if (hit) return hit
    }
    return match(this)
  }

  querySelectorAll(selector: string): FakeEl[] {
    const out: FakeEl[] = []
    const walk = (el: FakeEl): void => {
      if (selector.startsWith('.') && el.className.split(/\s+/).includes(selector.slice(1))) out.push(el)
      for (const c of el.children) walk(c)
    }
    walk(this)
    return out
  }

  closest(selector: string): FakeEl | null {
    let cur: FakeEl | null = this
    while (cur) {
      if (selector.startsWith('#') && cur.id === selector.slice(1)) return cur
      cur = cur.parent
    }
    return null
  }

  getBoundingClientRect(): DOMRect {
    const { left, top, width, height } = this.rect
    return {
      left, top, width, height,
      right: left + width,
      bottom: top + height,
      x: left, y: top,
      toJSON: () => ({}),
    } as DOMRect
  }

  setAttribute(k: string, v: string): void {
    if (k === 'aria-hidden') return
    if (k === 'aria-label') this.title = v
    if (k === 'aria-live') return
    if (k === 'aria-expanded') return
    if (k === 'role') return
    if (k === 'tabindex') this.tabIndex = Number(v)
  }

  getAttribute(k: string): string | null {
    if (k === 'aria-hidden') return 'false'
    return null
  }

  contains(node: FakeEl): boolean {
    let cur: FakeEl | null = node
    while (cur) {
      if (cur === this) return true
      cur = cur.parent
    }
    return false
  }

  focus(): void { /* noop */ }
  blur(): void { /* noop */ }
  scrollBy(): void { /* noop */ }
  click(): void { /* noop */ }

  getContext(type: string): CanvasRenderingContext2D | null {
    if (type !== '2d') return null
    return {
      fillRect: vi.fn(),
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      arc: vi.fn(),
      closePath: vi.fn(),
      getImageData: () => ({ data: new Uint8ClampedArray(16), width: 4, height: 4 }),
      putImageData: vi.fn(),
      scale: vi.fn(),
      setTransform: vi.fn(),
      drawImage: vi.fn(),
      fillStyle: '#000',
      strokeStyle: '#000',
      lineWidth: 1,
      globalCompositeOperation: 'source-over',
    } as unknown as CanvasRenderingContext2D
  }

  toBlob(cb: (b: Blob | null) => void): void { cb(new Blob()) }
}

const docCaptureKeydown: Array<(ev: KeyboardEvent) => void> = []
const idMap = new Map<string, FakeEl>()

function mk(id: string, tag = 'div', extra?: Partial<FakeEl>): FakeEl {
  const el = new FakeEl(tag)
  el.id = id
  if (extra) Object.assign(el, extra)
  idMap.set(id, el)
  return el
}

const fakeBody = new FakeEl('body')
const fakeDocument = {
  body: fakeBody,
  createElement(tag: string): FakeEl {
    if (tag === 'canvas') return new FakeEl('canvas')
    if (tag === 'img') return new FakeEl('img')
    if (tag === 'button') return new FakeEl('button')
    if (tag === 'input') return new FakeEl('input')
    if (tag === 'textarea') return new FakeEl('textarea')
    if (tag === 'select') return new FakeEl('select')
    if (tag === 'option') return new FakeEl('option')
    if (tag === 'a') return new FakeEl('a')
    if (tag === 'iframe') return new FakeEl('iframe')
    if (tag === 'footer') return new FakeEl('footer')
    if (tag === 'nav') return new FakeEl('nav')
    if (tag === 'label') return new FakeEl('label')
    if (tag === 'span') return new FakeEl('span')
    return new FakeEl('div')
  },
  getElementById(id: string): FakeEl | null {
    return idMap.get(id) ?? null
  },
  addEventListener(type: string, fn: (ev: KeyboardEvent) => void, capture?: boolean | AddEventListenerOptions): void {
    const useCapture = capture === true || (typeof capture === 'object' && capture.capture === true)
    if (type === 'keydown' && useCapture) docCaptureKeydown.push(fn)
  },
  querySelectorAll(): FakeEl[] { return [] },
  activeElement: null as FakeEl | null,
}

beforeAll(() => {
  const raf = (fn: () => void): number => { fn(); return 0 }
  vi.stubGlobal('HTMLElement', FakeEl)
  vi.stubGlobal('requestAnimationFrame', raf)
  vi.stubGlobal('document', fakeDocument)
  vi.stubGlobal('window', {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    setInterval: vi.fn(),
    setTimeout: (fn: () => void) => { fn(); return 0 },
    clearTimeout: vi.fn(),
    requestAnimationFrame: raf,
    dispatchEvent: vi.fn(),
    matchMedia: () => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
    devicePixelRatio: 1,
    localStorage: {
      getItem: () => null,
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: () => null,
    },
  })
  vi.stubGlobal('ResizeObserver', class {
    observe(): void { /* noop */ }
    disconnect(): void { /* noop */ }
  })
  vi.stubGlobal('CustomEvent', class {
    type: string
    constructor(type: string) { this.type = type }
  })
  vi.stubGlobal('Blob', class { constructor() { /* noop */ } })
  URL.createObjectURL = () => 'blob:mock'
  URL.revokeObjectURL = vi.fn()
  vi.stubGlobal('queueMicrotask', (fn: () => void) => fn())
  vi.stubGlobal('getComputedStyle', () => ({
    getPropertyValue: (name: string) => (name === '--paint-bg' ? '#1e1e2e' : ''),
  }))
})

// Import after globals are stubbed
const { Desktop } = await import('./desktop')

function mountDesktop(
  opts: { workspace?: boolean } = {},
): { desktop: InstanceType<typeof Desktop>; root: FakeEl; rightPane: FakeEl } {
  idMap.clear()
  docCaptureKeydown.length = 0
  fakeBody.children.length = 0

  const root = mk('desktop')
  const panes = mk('panes')
  const rightPane = mk('right-pane')

  const taskbar = mk('wm-taskbar')
  const taskbarDock = mk('wm-taskbar-dock')
  taskbar.appendChild(taskbarDock)
  mk('yasb-focused')
  mk('yasb-clock-text')
  mk('desktop-icons')
  mk('btn-applications')
  mk('launcher-backdrop')
  mk('launcher-search')
  mk('launcher-shell')
  if (opts.workspace !== false) mk('desktop-workspace')

  panes.appendChild(rightPane)
  root.appendChild(panes)

  const desktop = new Desktop(root as unknown as HTMLElement)
  return { desktop, root, rightPane }
}

const resumeSpec = () => windowSpecForCommand('resume')
const whoamiSpec = () => windowSpecForCommand('whoami')
const linksSpec = () => windowSpecForCommand('links')

const projectsSpec = () => windowSpecForCommand('projects')

function ctrlKey(key: string): void {
  const ev = {
    ctrlKey: true,
    altKey: false,
    metaKey: false,
    key,
    preventDefault: vi.fn(),
    stopImmediatePropagation: vi.fn(),
  } as unknown as KeyboardEvent
  for (const fn of docCaptureKeydown) fn(ev)
}

function focusedCmd(desktop: InstanceType<typeof Desktop>): string | undefined {
  return desktop.getPsSnapshot().find(r => r.stat === 'Sl+')?.cmd
}

/** A minimal generic-window spec: opens synchronously as a plain AppWindow (no lazy import). */
function genericSpec(command: string): WindowSpec {
  return { command, title: command, content: [] }
}

/** Find a dock task button by its `data-cmd` and fire its click handler. */
function clickDockBtn(cmd: string): boolean {
  const dock = fakeDocument.getElementById('wm-taskbar-dock')
  if (!dock) return false
  const btn = dock.querySelectorAll('.wm-task-btn').find(b => b.dataset.cmd === cmd)
  if (!btn) return false
  btn.dispatch('click', {})
  return true
}

function tiledWindows(desktop: InstanceType<typeof Desktop>): Array<{ command: string; el: FakeEl }> {
  return (desktop as unknown as { windows: Array<{ command: string; el: FakeEl }> }).windows
}

function isMaximized(desktop: InstanceType<typeof Desktop>): boolean {
  return (desktop as unknown as { maximizedId: string | null }).maximizedId !== null
}

/** Fire a window-chrome traffic-light dot (e.g. `.dot-max`) on a tile's element. */
function clickDot(el: FakeEl, dotClass: string): boolean {
  const dot = el.querySelector(`.${dotClass}`)
  if (!dot) return false
  dot.dispatch('click', { stopPropagation: vi.fn() })
  return true
}

/** Fire a click on a top-level shell element by id (Applications button, backdrop, …). */
function clickById(id: string): boolean {
  const el = fakeDocument.getElementById(id)
  if (!el) return false
  el.dispatch('click', { stopPropagation: vi.fn() })
  return true
}

/** Click a launcher grid icon (#desktop-icons button) by its visible label. */
function clickLauncherIcon(label: string): boolean {
  const grid = fakeDocument.getElementById('desktop-icons')
  if (!grid) return false
  const btn = grid
    .querySelectorAll('.desktop-icon')
    .find(b => b.querySelector('.desktop-icon-label')?.textContent === label)
  if (!btn) return false
  btn.dispatch('click', {})
  return true
}

describe('Desktop WM', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getPsSnapshot lists bash plus open windows', async () => {
    const { desktop } = mountDesktop()
    await desktop.openWindow(whoamiSpec())
    const rows = desktop.getPsSnapshot()
    expect(rows[0]?.cmd).toBe('-bash')
    expect(rows.some(r => r.cmd === 'whoami')).toBe(true)
  })

  it('openWindow toggles portfolio tiles on repeat command', async () => {
    const { desktop } = mountDesktop()
    await desktop.openWindow(whoamiSpec())
    expect(desktop.getPsSnapshot().some(r => r.cmd === 'whoami')).toBe(true)
    await desktop.openWindow(whoamiSpec())
    expect(desktop.getPsSnapshot().some(r => r.cmd === 'whoami')).toBe(false)
  })

  it('focusWindow marks the active tile in ps output', async () => {
    const { desktop } = mountDesktop()
    await desktop.openWindow(linksSpec())
    await desktop.openWindow(whoamiSpec())
    expect(focusedCmd(desktop)).toBe('whoami')
    const whoamiRow = desktop.getPsSnapshot().find(r => r.cmd === 'whoami')
    const linksRow = desktop.getPsSnapshot().find(r => r.cmd === 'links')
    expect(whoamiRow?.stat).toBe('Sl+')
    expect(linksRow?.stat).toBe('Sl')
  })

  it('Ctrl+Q closes the focused content window', async () => {
    const { desktop } = mountDesktop()
    await desktop.openWindow(linksSpec())
    expect(desktop.getPsSnapshot().some(r => r.cmd === 'links')).toBe(true)
    ctrlKey('q')
    expect(desktop.getPsSnapshot().some(r => r.cmd === 'links')).toBe(false)
  })

  it('Ctrl+D toggles launcher-visible on the desktop root', async () => {
    const { root } = mountDesktop()
    expect(root.classList.contains('launchers-visible')).toBe(false)
    ctrlKey('d')
    expect(root.classList.contains('launchers-visible')).toBe(true)
    ctrlKey('d')
    expect(root.classList.contains('launchers-visible')).toBe(false)
  })

  it('Ctrl+1–9 focuses windows by dock slot order', async () => {
    const { desktop } = mountDesktop()
    await desktop.openWindow(linksSpec())
    await desktop.openWindow(whoamiSpec())
    expect(focusedCmd(desktop)).toBe('whoami')
    ctrlKey('1')
    expect(focusedCmd(desktop)).toBe('links')
    ctrlKey('2')
    expect(focusedCmd(desktop)).toBe('whoami')
  })

  it('spatial Ctrl+H moves focus to a window on the left', async () => {
    const { desktop } = mountDesktop()
    await desktop.openWindow(linksSpec())
    await desktop.openWindow(whoamiSpec())
    const wins = desktop.getPsSnapshot().filter(r => r.cmd === 'links' || r.cmd === 'whoami')
    expect(wins.length).toBe(2)

    const linksEl = (desktop as unknown as { windows: Array<{ command: string; el: FakeEl }> }).windows
      .find(w => w.command === 'links')!.el
    const whoamiEl = (desktop as unknown as { windows: Array<{ command: string; el: FakeEl }> }).windows
      .find(w => w.command === 'whoami')!.el
    whoamiEl.rect = { left: 520, top: 40, width: 360, height: 280 }
    linksEl.rect = { left: 80, top: 40, width: 360, height: 280 }

    expect(focusedCmd(desktop)).toBe('whoami')
    ctrlKey('h')
    expect(focusedCmd(desktop)).toBe('links')
  })

  it('enforceTileLimit minimizes the oldest window at cap (6)', async () => {
    const { desktop } = mountDesktop()
    await desktop.openWindow(whoamiSpec())
    await desktop.openWindow(linksSpec())
    await desktop.openWindow(projectsSpec())
    await desktop.openWindow(resumeSpec())
    await desktop.openWindow({
      command: 'explorer',
      title: 'explorer',
      content: [],
      explorerPath: '/home/namefailed',
    })
    await desktop.openWindow({ command: 'paint', title: 'paint', content: [] })
    expect(desktop.getPsSnapshot().filter(r => r.stat === 'Sl' || r.stat === 'Sl+').length).toBe(6)

    await desktop.openWindow({
      command: 'edit',
      title: 'edit',
      content: [],
      editorPath: 'notes.txt',
    })
    const visible = desktop.getPsSnapshot().filter(r => r.stat === 'Sl' || r.stat === 'Sl+')
    const minimized = desktop.getPsSnapshot().filter(r => r.stat === 'T')
    expect(visible.length).toBe(6)
    expect(minimized.length).toBe(1)
    expect(minimized.some(r => r.cmd === 'whoami (minimized)')).toBe(true)
    expect(visible.some(r => r.cmd === 'edit')).toBe(true)
  })
})

describe('Desktop WM — lifecycle wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('Ctrl+M minimizes the focused tile and plays the click sound', async () => {
    const { desktop } = mountDesktop()
    await desktop.openWindow(whoamiSpec())
    expect(focusedCmd(desktop)).toBe('whoami')

    ctrlKey('m')

    // The tile leaves the open set and shows as minimized in ps output.
    expect(desktop.getPsSnapshot().some(r => r.cmd === 'whoami')).toBe(false)
    expect(desktop.getPsSnapshot().some(r => r.cmd === 'whoami (minimized)')).toBe(true)
    expect(vi.mocked(playOsSound)).toHaveBeenCalledWith('click')
  })

  it('Ctrl+F maximizes the focused tile, Ctrl+F again restores it', async () => {
    const { desktop, root } = mountDesktop()
    await desktop.openWindow(linksSpec())
    const linksEl = tiledWindows(desktop).find(w => w.command === 'links')!.el

    ctrlKey('f')
    expect(linksEl.classList.contains('maximized')).toBe(true)
    expect(isMaximized(desktop)).toBe(true)
    expect(root.dataset.maximized).toBe('1')

    ctrlKey('f')
    expect(linksEl.classList.contains('maximized')).toBe(false)
    expect(isMaximized(desktop)).toBe(false)
  })

  it('closing a maximized tile unmaximizes it first (Desktop.unmaximizeContent)', async () => {
    const { desktop } = mountDesktop()
    await desktop.openWindow(projectsSpec())
    const el = tiledWindows(desktop).find(w => w.command === 'projects')!.el
    ctrlKey('f')
    expect(isMaximized(desktop)).toBe(true)
    expect(el.classList.contains('maximized')).toBe(true)

    // closeTiledWindow un-maximizes a maximized tile before removing it.
    ctrlKey('q')

    expect(desktop.getPsSnapshot().some(r => r.cmd === 'projects')).toBe(false)
    // maximizedId reset to null, so the shell is no longer in maximized mode.
    expect(isMaximized(desktop)).toBe(false)
  })

  it('maximizing a second tile unmaximizes the first (maximize switch)', async () => {
    const { desktop } = mountDesktop()
    await desktop.openWindow(linksSpec())
    await desktop.openWindow(whoamiSpec())
    const linksEl = tiledWindows(desktop).find(w => w.command === 'links')!.el
    const whoamiEl = tiledWindows(desktop).find(w => w.command === 'whoami')!.el

    // Focus + maximize links first.
    ctrlKey('1')
    ctrlKey('f')
    expect(linksEl.classList.contains('maximized')).toBe(true)

    // Focus + maximize whoami → the previously maximized links is restored.
    ctrlKey('2')
    ctrlKey('f')
    expect(whoamiEl.classList.contains('maximized')).toBe(true)
    expect(linksEl.classList.contains('maximized')).toBe(false)
  })

  it('Ctrl+F with no focused tile is a no-op', async () => {
    const { desktop } = mountDesktop()
    // Nothing focused yet (focusedId stays null).
    ctrlKey('f')
    expect(isMaximized(desktop)).toBe(false)
  })

  it('focus plays the focus sound only when the focused command changes', async () => {
    const { desktop } = mountDesktop()
    await desktop.openWindow(linksSpec())
    vi.mocked(playOsSound).mockClear()

    // Refocusing the already-focused tile via its dock slot does not replay the sound.
    ctrlKey('1')
    expect(vi.mocked(playOsSound)).not.toHaveBeenCalledWith('focus')

    await desktop.openWindow(whoamiSpec())
    expect(vi.mocked(playOsSound)).toHaveBeenCalledWith('focus')
  })

  it('the maximize traffic dot toggles maximize through the Desktop method + WM facade', async () => {
    const { desktop, root } = mountDesktop()
    await desktop.openWindow(projectsSpec())
    const el = tiledWindows(desktop).find(w => w.command === 'projects')!.el

    // onMaximize chrome callback → openWindowHost.toggleMaximizeContent → Desktop.toggleMaximizeContent
    expect(clickDot(el, 'dot-max')).toBe(true)
    expect(el.classList.contains('maximized')).toBe(true)
    expect(isMaximized(desktop)).toBe(true)
    expect(root.dataset.maximized).toBe('1')

    // Clicking again unmaximizes (Desktop.toggleMaximizeContent → unmaximizeContent).
    clickDot(el, 'dot-max')
    expect(el.classList.contains('maximized')).toBe(false)
    expect(isMaximized(desktop)).toBe(false)
  })

  it('the minimize traffic dot routes through Desktop.minimizeWindow', async () => {
    const { desktop } = mountDesktop()
    await desktop.openWindow(linksSpec())
    const el = tiledWindows(desktop).find(w => w.command === 'links')!.el

    expect(clickDot(el, 'dot-min')).toBe(true)
    expect(desktop.getPsSnapshot().some(r => r.cmd === 'links (minimized)')).toBe(true)
    expect(vi.mocked(playOsSound)).toHaveBeenCalledWith('click')
  })

  it('the close traffic dot routes through Desktop.closeWindow', async () => {
    const { desktop } = mountDesktop()
    await desktop.openWindow(linksSpec())
    const el = tiledWindows(desktop).find(w => w.command === 'links')!.el

    expect(clickDot(el, 'dot-close')).toBe(true)
    expect(desktop.getPsSnapshot().some(r => r.cmd === 'links')).toBe(false)
  })

  it('closing the focused tile hands focus to the remaining tile (focusTerminalIfAlreadyVisible → focusWindow)', async () => {
    const { desktop } = mountDesktop()
    await desktop.openWindow(linksSpec())
    await desktop.openWindow(whoamiSpec())
    expect(focusedCmd(desktop)).toBe('whoami')

    // Close the focused 'whoami' → fallback focus lands on the remaining tile.
    ctrlKey('q')

    expect(desktop.getPsSnapshot().some(r => r.cmd === 'whoami')).toBe(false)
    expect(focusedCmd(desktop)).toBe('links')
  })

  it('closing the last focused tile clears WM focus (focusTerminalIfAlreadyVisible → clearUnfocused)', async () => {
    const { desktop } = mountDesktop()
    await desktop.openWindow(linksSpec())
    expect(focusedCmd(desktop)).toBe('links')

    ctrlKey('q')

    expect(desktop.getPsSnapshot().some(r => r.cmd === 'links')).toBe(false)
    // clearUnfocused() reset internal WM focus to null.
    expect((desktop as unknown as { focusedId: string | null }).focusedId).toBeNull()
  })

  it('focusTerminal() delegates to openWindow with the terminal spec', () => {
    const { desktop } = mountDesktop()
    const openSpy = vi.spyOn(desktop, 'openWindow').mockResolvedValue(undefined)

    desktop.focusTerminal()

    expect(openSpy).toHaveBeenCalledTimes(1)
    expect(openSpy.mock.calls[0]?.[0]).toMatchObject({ command: 'terminal' })
    openSpy.mockRestore()
  })
})

describe('Desktop WM — launcher overlay chrome', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('the Applications button opens the launcher overlay, a second click closes it', () => {
    const { root } = mountDesktop()
    expect(root.classList.contains('launchers-visible')).toBe(false)

    // First click → toggleLauncherFromButton opens (openLauncherFromButtonFlags true → sync()).
    expect(clickById('btn-applications')).toBe(true)
    expect(root.classList.contains('launchers-visible')).toBe(true)

    // Second click → overlay already visible → closeLauncherOverlay path.
    clickById('btn-applications')
    expect(root.classList.contains('launchers-visible')).toBe(false)
  })

  it('the launcher backdrop click closes an open overlay (closeLauncherOverlay)', () => {
    const { root } = mountDesktop()
    clickById('btn-applications')
    expect(root.classList.contains('launchers-visible')).toBe(true)

    expect(clickById('launcher-backdrop')).toBe(true)
    expect(root.classList.contains('launchers-visible')).toBe(false)
  })

  it('backdrop click when nothing is open is a no-op (closeLauncherOverlayFlags false)', () => {
    const { root } = mountDesktop()
    expect(root.classList.contains('launchers-visible')).toBe(false)

    clickById('launcher-backdrop')
    expect(root.classList.contains('launchers-visible')).toBe(false)
  })

  it('a launcher grid icon click opens its window through the wired openWindow callback', () => {
    const { desktop } = mountDesktop()
    expect(desktop.getPsSnapshot().some(r => r.cmd === 'whoami')).toBe(false)

    // "About me" is the whoami portfolio tile (opens synchronously, no lazy chunk).
    expect(clickLauncherIcon('About me')).toBe(true)

    expect(desktop.getPsSnapshot().some(r => r.cmd === 'whoami')).toBe(true)
    expect(focusedCmd(desktop)).toBe('whoami')
  })
})

describe('Desktop WM — desktop workspace wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('constructs and syncs cleanly when the desktop-workspace markup is absent', async () => {
    const { desktop } = mountDesktop({ workspace: false })

    // No #desktop-workspace → the empty-CTA wiring is skipped, but the shell still works.
    expect(vi.mocked(mountDesktopEmptyCta)).not.toHaveBeenCalled()
    await desktop.openWindow(whoamiSpec())
    expect(desktop.getPsSnapshot().some(r => r.cmd === 'whoami')).toBe(true)
  })

  it('the empty-CTA activate callback opens the chosen window', () => {
    const { desktop } = mountDesktop()
    const openSpy = vi.spyOn(desktop, 'openWindow').mockResolvedValue(undefined)

    // mountDesktopEmptyCta(workspace, onActivate) — invoke the wired onActivate.
    const ctaCall = vi.mocked(mountDesktopEmptyCta).mock.calls[0]
    expect(ctaCall).toBeDefined()
    ctaCall![1]('projects')

    expect(openSpy).toHaveBeenCalledTimes(1)
    expect(openSpy.mock.calls[0]?.[0]).toMatchObject({ command: 'projects' })
    openSpy.mockRestore()
  })

  it('the desktop-tiles activate callback opens the chosen window', () => {
    const { desktop } = mountDesktop()
    const openSpy = vi.spyOn(desktop, 'openWindow').mockResolvedValue(undefined)

    const tilesCall = vi.mocked(mountDesktopTiles).mock.calls[0]
    expect(tilesCall).toBeDefined()
    tilesCall![0].onActivate('resume')

    expect(openSpy).toHaveBeenCalledTimes(1)
    expect(openSpy.mock.calls[0]?.[0]).toMatchObject({ command: 'resume' })
    openSpy.mockRestore()
  })

  it('the mrgrey-guide-dismissed listener re-syncs the empty CTA', () => {
    mountDesktop()
    const winAddEventListener = vi.mocked(
      (globalThis as unknown as { window: { addEventListener: ReturnType<typeof vi.fn> } }).window
        .addEventListener,
    )
    const guideCall = winAddEventListener.mock.calls.find(
      c => c[0] === 'mrgrey-guide-dismissed',
    )
    expect(guideCall).toBeDefined()

    // Invoking the captured handler should not throw (it re-runs syncDesktopEmptyCta).
    expect(() => (guideCall![1] as () => void)()).not.toThrow()
  })

  it('the window resize listener fits the open terminal (no-op with no terminal tile)', () => {
    mountDesktop()
    const winAddEventListener = vi.mocked(
      (globalThis as unknown as { window: { addEventListener: ReturnType<typeof vi.fn> } }).window
        .addEventListener,
    )
    const resizeCall = winAddEventListener.mock.calls.find(c => c[0] === 'resize')
    expect(resizeCall).toBeDefined()

    // No terminal tile open → fitOpenTerminal finds nothing and returns cleanly.
    expect(() => (resizeCall![1] as () => void)()).not.toThrow()
  })
})

describe('Desktop WM — WM facade delegation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('Ctrl+T routes through the WM facade openWindow to open the terminal', () => {
    const { desktop } = mountDesktop()
    // Spy so the facade openWindow delegation does not fire a real lazy import().
    const openSpy = vi.spyOn(desktop, 'openWindow').mockResolvedValue(undefined)

    ctrlKey('t')

    expect(openSpy).toHaveBeenCalledTimes(1)
    expect(openSpy.mock.calls[0]?.[0]).toMatchObject({ command: 'terminal' })
    openSpy.mockRestore()
  })

  it('tile cap bumping the focused oldest tile clears WM focus (facade setFocusedId)', async () => {
    const { desktop } = mountDesktop()
    await desktop.openWindow(whoamiSpec())
    await desktop.openWindow(linksSpec())
    await desktop.openWindow(projectsSpec())
    await desktop.openWindow(resumeSpec())
    await desktop.openWindow(genericSpec('a'))
    await desktop.openWindow(genericSpec('b'))
    expect(desktop.getPsSnapshot().filter(r => r.stat === 'Sl' || r.stat === 'Sl+').length).toBe(6)

    // Focus the OLDEST tile (dock slot 1 = whoami) so it is the one bumped at the cap.
    ctrlKey('1')
    expect(focusedCmd(desktop)).toBe('whoami')

    // Opening a 7th tile enforces the cap: the focused oldest (whoami) is bumped,
    // which calls setFocusedId(null) through the WM facade.
    await desktop.openWindow(genericSpec('c'))

    expect(desktop.getPsSnapshot().some(r => r.cmd === 'whoami (minimized)')).toBe(true)
    // The newly opened 'c' is what ends up focused.
    expect(focusedCmd(desktop)).toBe('c')
  })

  it('opening the terminal tile mounts it, fits it, and focuses its shell', async () => {
    const { desktop } = mountDesktop()

    await desktop.openWindow({ command: 'terminal', title: 'terminal', content: [] })

    expect(desktop.getPsSnapshot().some(r => r.cmd === 'terminal')).toBe(true)
    expect(focusedCmd(desktop)).toBe('terminal')
    expect(terminalFit).toHaveBeenCalled()
    expect(terminalFocusShell).toHaveBeenCalled()
  })

  it('sync re-fits the open terminal through fitOpenTerminal', async () => {
    const { desktop } = mountDesktop()
    await desktop.openWindow({ command: 'terminal', title: 'terminal', content: [] })
    terminalFit.mockClear()

    // Toggling show-desktop calls sync(), whose rAF runs fitOpenTerminal synchronously here.
    ctrlKey('d')

    expect(terminalFit).toHaveBeenCalledTimes(1)
  })

  it('clicking the terminal pinned button while the terminal is focused minimizes it', async () => {
    const { desktop } = mountDesktop()
    await desktop.openWindow({ command: 'terminal', title: 'terminal', content: [] })
    expect(focusedCmd(desktop)).toBe('terminal')

    // taskbarPinnedAction('terminal', hasTerminalTile=true, terminalFocused=true) → minimize-terminal-tile
    expect(clickDockBtn('terminal')).toBe(true)

    expect(desktop.getPsSnapshot().some(r => r.cmd === 'terminal')).toBe(false)
    expect(desktop.getPsSnapshot().some(r => r.cmd === 'terminal (minimized)')).toBe(true)
  })

  it('re-opening a minimized window via openWindow restores it through the WM facade', async () => {
    const { desktop } = mountDesktop()
    await desktop.openWindow(genericSpec('help'))
    ctrlKey('m')
    expect(desktop.getPsSnapshot().some(r => r.cmd === 'help (minimized)')).toBe(true)

    // dispatchOpenWindow reads host.minimized (facade get minimized) then host.restoreMinimized.
    await desktop.openWindow(genericSpec('help'))

    expect(desktop.getPsSnapshot().some(r => r.cmd === 'help (minimized)')).toBe(false)
    expect(desktop.getPsSnapshot().some(r => r.cmd === 'help')).toBe(true)
    expect(focusedCmd(desktop)).toBe('help')
  })
})

describe('Desktop WM — taskbar dock clicks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('clicking a pinned dock button opens that command (onPinnedClick → open-command)', async () => {
    const { desktop } = mountDesktop()
    expect(desktop.getPsSnapshot().some(r => r.cmd === 'resume')).toBe(false)

    expect(clickDockBtn('resume')).toBe(true)
    await Promise.resolve()

    expect(desktop.getPsSnapshot().some(r => r.cmd === 'resume')).toBe(true)
    expect(focusedCmd(desktop)).toBe('resume')
  })

  it('clicking a pinned button for an open tile toggles it closed', async () => {
    const { desktop } = mountDesktop()
    await desktop.openWindow(whoamiSpec())
    expect(desktop.getPsSnapshot().some(r => r.cmd === 'whoami')).toBe(true)

    expect(clickDockBtn('whoami')).toBe(true)
    await Promise.resolve()

    // open-command on an already-open tile routes to closeWindow (toggle off).
    expect(desktop.getPsSnapshot().some(r => r.cmd === 'whoami')).toBe(false)
  })

  it('clicking the terminal pinned button (no terminal tile) opens a terminal (onPinnedClick → open-terminal-tile)', () => {
    const { desktop } = mountDesktop()
    // Spy so the open-terminal-tile branch does not fire a real lazy import().
    const openSpy = vi.spyOn(desktop, 'openWindow').mockResolvedValue(undefined)

    expect(clickDockBtn('terminal')).toBe(true)

    expect(openSpy).toHaveBeenCalledTimes(1)
    expect(openSpy.mock.calls[0]?.[0]).toMatchObject({ command: 'terminal' })
    openSpy.mockRestore()
  })

  it('clicking an extra (non-pinned) dock button focuses that running tile (onExtraClick)', async () => {
    const { desktop } = mountDesktop()
    // "help" is not in PINNED_DOCK_CMDS, so it renders past the dock separator as an extra.
    await desktop.openWindow(genericSpec('help'))
    await desktop.openWindow(whoamiSpec())
    expect(focusedCmd(desktop)).toBe('whoami')

    expect(clickDockBtn('help')).toBe(true)
    await Promise.resolve()

    expect(focusedCmd(desktop)).toBe('help')
  })

  it('clicking an extra dock button for a minimized tile restores it (onExtraClick → restore)', async () => {
    const { desktop } = mountDesktop()
    await desktop.openWindow(genericSpec('help'))
    // Minimize it: focused tile → Ctrl+M.
    expect(focusedCmd(desktop)).toBe('help')
    ctrlKey('m')
    expect(desktop.getPsSnapshot().some(r => r.cmd === 'help (minimized)')).toBe(true)

    // Still rendered as an extra dock entry; clicking restores + focuses it.
    expect(clickDockBtn('help')).toBe(true)
    await Promise.resolve()

    expect(desktop.getPsSnapshot().some(r => r.cmd === 'help (minimized)')).toBe(false)
    expect(focusedCmd(desktop)).toBe('help')
  })
})

describe('Desktop WM — taskbar index + spatial focus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('Ctrl+<n> on a minimized dock slot restores rather than focuses (focusTaskbarIndex)', async () => {
    const { desktop } = mountDesktop()
    await desktop.openWindow(whoamiSpec())
    ctrlKey('m')
    expect(desktop.getPsSnapshot().some(r => r.cmd === 'whoami (minimized)')).toBe(true)

    // dockWindows() = [whoami] (minimized), so slot 1 → restore path.
    ctrlKey('1')

    expect(desktop.getPsSnapshot().some(r => r.cmd === 'whoami (minimized)')).toBe(false)
    expect(focusedCmd(desktop)).toBe('whoami')
  })

  it('Ctrl+<n> past the last dock slot is a no-op', async () => {
    const { desktop } = mountDesktop()
    await desktop.openWindow(whoamiSpec())
    const before = focusedCmd(desktop)

    ctrlKey('9') // index 8 — out of range

    expect(focusedCmd(desktop)).toBe(before)
  })

  it('spatial Ctrl+H with no focus opens the terminal (focusSpatial → openTerminal)', () => {
    const { desktop } = mountDesktop()
    // Spy so the "open terminal" branch does not fire a real lazy import().
    const openSpy = vi
      .spyOn(desktop, 'openWindow')
      .mockResolvedValue(undefined)

    // No focused tile + dir 'h' → spatial action resolves to "open terminal".
    ctrlKey('h')

    expect(openSpy).toHaveBeenCalledTimes(1)
    expect(openSpy.mock.calls[0]?.[0]).toMatchObject({ command: 'terminal' })
    openSpy.mockRestore()
  })

  it('spatial Ctrl+L with no focus focuses the first tile (focusSpatial → focus)', async () => {
    const { desktop } = mountDesktop()
    await desktop.openWindow(linksSpec())
    await desktop.openWindow(whoamiSpec())
    // Clear focus so pickSpatialFocusAction takes the "no focused window" branch.
    ;(desktop as unknown as { focusedId: string | null }).focusedId = null

    ctrlKey('l')

    // windows[0] is the first-opened tile (links).
    expect(focusedCmd(desktop)).toBe('links')
  })
})
