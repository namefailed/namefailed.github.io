/**
 * Desktop WM integration tests (focus, keyboard chords, tile cap).
 * Uses a lightweight DOM shim — Vitest runs in Node, not jsdom.
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { windowSpecForCommand } from './desktop-window-spec'

vi.mock('./os-sound', () => ({ playOsSound: vi.fn() }))
vi.mock('./welcome-guide', () => ({ mountWelcomeGuide: vi.fn() }))
vi.mock('./desktop-tiles', () => ({ mountDesktopTiles: vi.fn() }))
vi.mock('./desktop-personalize', () => ({ initDesktopPersonalize: vi.fn() }))
vi.mock('./splitter', () => ({ Splitter: vi.fn() }))
vi.mock('./os-registry', () => ({ setDesktopRef: vi.fn() }))

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

function mountDesktop(): { desktop: InstanceType<typeof Desktop>; root: FakeEl; rightPane: FakeEl } {
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
