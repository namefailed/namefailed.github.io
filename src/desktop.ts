// ── desktop.ts ────────────────────────────────────────────────────────────────
// Tiling shell: terminal column on the left; portfolio / editor / browser / games on the right.
//
// Command types:
//   • Opens a tile — resume, links, skills, …, edit, explorer, browse, paint, cube, snake, pong;
//     repeats the same path/URL or toggles focus/close per command rules in `openWindow`.
//   • Terminal-only — help, vfs, … (see commands/index.ts).
//
// Keyboard (Ctrl chords, WM-style):
//   Ctrl+T ............ focus terminal (restore if minimized)
//   Ctrl+1..9 ......... dock slots (Terminal→Browse→Files→Editor→Links→Resume→Projects→Skills→Contact, then running extras)
//   Ctrl+H ............ focus left  (terminal, then previous content window)
//   Ctrl+L ............ focus right (next content window)
//   Ctrl+J / Ctrl+K ... scroll focused content window down / up
//   Ctrl+Q ............ close focused content window, or close terminal if focused
//   Ctrl+M ............ minimize focused window
//   Ctrl+F ............ maximize / restore focused window or terminal
//   Ctrl+D ............ toggle show-desktop (launcher overlay + wallpaper)
//   Applications .... opens/closes the launcher (same overlay; bar button)

import { AppWindow } from './appwindow'
import type { WindowSpec } from './appwindow'
import type { BrowserWindow } from './browser-window'
import type { EditorWindow } from './editor-window'
import type { FileExplorerWindow } from './file-explorer-window'
import type { PaintWindow } from './paint-window'
import type { PongWindow } from './pong-window'
import type { RubikWindow } from './rubik-window'
import type { SnakeWindow } from './snake-window'
import { DEFAULT_BROWSER_URL, normalizeBrowserUrl } from './browser-url'
import { FS_HOME, vfsNormalize } from './os-fs'
import { Splitter } from './splitter'
import { commands } from './commands/index'
import { setDesktopRef } from './os-registry'
import { playOsSound } from './os-sound'

export interface PsSnapshotRow {
  pid: number
  tty: string
  stat: string
  time: string
  cmd: string
}

export type { WindowSpec }

/** Commands that open a tiled window (same set as terminal.ts WINDOW_COMMANDS). */
const WINDOW_COMMANDS = new Set([
  'resume',
  'links',
  'skills',
  'projects',
  'contact',
  'edit',
  'editor',
  'vim',
  'explorer',
  'browse',
  'paint',
  'cube',
  'snake',
  'pong',
])

/** CLI/editor-launcher aliases — same WM tile as `edit` (see terminal `OPEN_EDITOR_WINDOWS`). */
const OPEN_EDITOR_LAUNCH_CMDS = new Set(['edit', 'editor', 'vim'])

/** Warm the same dynamic chunks `openWindow` uses — hover / Tab before click or Enter. */
function prefetchLazyTiledChunk(invokedCmd: string): void {
  const cmd = OPEN_EDITOR_LAUNCH_CMDS.has(invokedCmd) ? 'edit' : invokedCmd
  switch (cmd) {
    case 'browse':
      void import('./browser-window')
      return
    case 'explorer':
      void import('./file-explorer-window')
      return
    case 'edit':
      void import('./editor-window')
      return
    case 'paint':
      void import('./paint-window')
      return
    case 'cube':
      void import('./rubik-window')
      return
    case 'snake':
      void import('./snake-window')
      return
    case 'pong':
      void import('./pong-window')
      return
    default:
      return
  }
}

function attachLazyTilePrefetchHandlers(el: HTMLElement, invokedCmd: string): void {
  const run = (): void => prefetchLazyTiledChunk(invokedCmd)
  el.addEventListener('pointerenter', run, { passive: true })
  el.addEventListener('focusin', run)
}

type TiledWin =
  | AppWindow
  | EditorWindow
  | FileExplorerWindow
  | BrowserWindow
  | PaintWindow
  | RubikWindow
  | SnakeWindow
  | PongWindow

const TERMINAL_MAX_ID = '__terminal__'

interface MinimizedEntry {
  win: TiledWin
}

interface ContentRestore {
  parent: HTMLElement
  next: ChildNode | null
}

/** Applications menu grid — includes extras not pinned on the dock. */
const LAUNCHER_ICONS: ReadonlyArray<
  | { kind: 'terminal'; label: string; glyph: string }
  | { kind: 'app'; cmd: string; label: string; glyph: string }
> = [
  { kind: 'terminal', label: 'Terminal', glyph: '~' },
  { kind: 'app', cmd: 'browse',   label: 'Browse',   glyph: 'w' },
  { kind: 'app', cmd: 'explorer', label: 'Files',    glyph: '▣' },
  { kind: 'app', cmd: 'edit',     label: 'Editor',   glyph: 'E' },
  { kind: 'app', cmd: 'links',    label: 'Links',    glyph: '↗' },
  { kind: 'app', cmd: 'resume',   label: 'Resume',   glyph: 'R' },
  { kind: 'app', cmd: 'projects', label: 'Projects', glyph: '{}' },
  { kind: 'app', cmd: 'skills',   label: 'Skills',   glyph: '%' },
  { kind: 'app', cmd: 'contact',  label: 'Contact',  glyph: '@' },
  { kind: 'app', cmd: 'paint',    label: 'Paint',    glyph: '◐' },
  { kind: 'app', cmd: 'cube',     label: 'Cube',     glyph: '▦' },
  { kind: 'app', cmd: 'snake',    label: 'Snake',    glyph: '≈' },
  { kind: 'app', cmd: 'pong',     label: 'Pong',     glyph: '◎' },
]

/** Shown on the taskbar only — open via Applications / terminal otherwise. */
const DOCK_EXCLUDED_CMDS = new Set(['paint', 'cube', 'snake', 'pong'])

function pinnedDockAppCommands(): Set<string> {
  const s = new Set<string>()
  for (const item of LAUNCHER_ICONS) {
    if (item.kind === 'app' && !DOCK_EXCLUDED_CMDS.has(item.cmd)) s.add(item.cmd)
  }
  return s
}

export class Desktop {
  private desktop:    HTMLElement
  private panes:      HTMLElement
  private rightPane:  HTMLElement
  private termWin:    HTMLElement
  private taskbarDock: HTMLElement
  private hSplitter:  HTMLElement
  private fitTerminal: () => void

  private windows: TiledWin[] = [] // open (visible) windows, in tile order
  private minimized:  MinimizedEntry[] = []
  private focusedId:  string | null    = null   // null = terminal focused
  private showingDesktop = false
  /** Opens launcher via status-bar Applications (distinct from Ctrl+D). */
  private launcherOpen = false

  /** `null` | terminal sentinel | content window command id */
  private maximizedId: string | null = null
  private contentRestore = new WeakMap<TiledWin, ContentRestore>()

  constructor(
    desktop:     HTMLElement,
    termWin:     HTMLElement,
    fitTerminal: () => void,
  ) {
    this.desktop     = desktop
    this.termWin     = termWin
    this.fitTerminal = fitTerminal
    this.panes       = document.getElementById('panes')!
    this.rightPane   = document.getElementById('right-pane')!
    this.taskbarDock = document.getElementById('wm-taskbar-dock')!
    this.hSplitter   = document.getElementById('h-splitter')!

    // Terminal window clicks → focus terminal
    termWin.addEventListener('mousedown', () => this.focusTerminal())

    // Terminal title-bar buttons
    const tbar = termWin.querySelector('.win-titlebar')
    tbar?.querySelector('.dot-min')?.addEventListener('click', e => {
      e.stopPropagation()
      this.minimizeTerminal()
    })
    tbar?.querySelector('.dot-max')?.addEventListener('click', e => {
      e.stopPropagation()
      this.toggleMaximizeTerminal()
    })
    tbar?.querySelector('.dot-close')?.addEventListener('click', e => {
      e.stopPropagation()
      this.closeTerminal()
    })

    // Horizontal splitter between terminal and right pane
    new Splitter({
      el:          this.hSplitter,
      orientation: 'h',
      target:      this.termWin,
      container:   this.panes,
      min:         280,
      max:         () => Math.max(280, this.panes.clientWidth - 320),
      onResize:    () => this.fitTerminal(),
    })

    // Global keyboard shortcuts
    document.addEventListener('keydown', ev => this.handleGlobal(ev), true)

    // Window resize → refit terminal
    window.addEventListener('resize', () => this.fitTerminal())

    this.initDesktopIcons()
    this.initLauncherSearch()
    this.initTopBarClock()
    this.initYasbChrome()
    setDesktopRef(this)
    this.sync()
  }

  // ── public API ─────────────────────────────────────────────────────────────

  /** Simulated `ps` output: shell plus tiled / minimized windows */
  getPsSnapshot(): PsSnapshotRow[] {
    const rows: PsSnapshotRow[] = []
    let pid = 400
    rows.push({ pid: pid++, tty: 'pts/0', stat: 'Ss+', time: '0:00', cmd: '-bash' })
    for (const w of this.windows) {
      rows.push({
        pid: pid++,
        tty: 'wm-pty',
        stat: this.focusedId === w.command ? 'Sl+' : 'Sl',
        time: '0:00',
        cmd: w.command,
      })
    }
    for (const { win } of this.minimized) {
      rows.push({
        pid: pid++,
        tty: 'wm-pty',
        stat: 'T',
        time: '0:00',
        cmd: `${win.command} (minimized)`,
      })
    }
    return rows
  }

  async openWindow(spec: WindowSpec): Promise<void> {
    this.closeLauncherOverlay()

    if (spec.command === 'edit') {
      const pathArg = spec.editorPath ?? 'welcome.txt'

      const existingOpen = this.windows.find(w => w.command === 'edit')
      if (existingOpen) {
        const ed = existingOpen as EditorWindow
        if (ed.pathMatches(pathArg)) {
          this.closeWindow(existingOpen)
          return
        }
        ed.loadFile(pathArg)
        this.focusWindow(existingOpen)
        return
      }

      const minEd = this.minimized.find(m => m.win.command === 'edit')
      if (minEd) {
        const ed = minEd.win as EditorWindow
        if (ed.pathMatches(pathArg)) {
          this.restoreMinimized(minEd)
          return
        }
        ed.loadFile(pathArg)
        this.restoreMinimized(minEd)
        return
      }

      const { EditorWindow: EditorWindowCtor } = await import('./editor-window')
      let ed!: EditorWindow
      ed = new EditorWindowCtor({
        initialPath: pathArg,
        onClose: () => this.closeWindow(ed),
        onMinimize: () => this.minimizeWindow(ed),
        onMaximize: () => this.toggleMaximizeContent(ed),
        onFocus: () => this.focusWindow(ed),
      })
      this.appendToRightPane(ed.el)
      this.windows.push(ed)
      this.attachVerticalSplitters()
      this.focusWindow(ed)
      return
    }

    if (spec.command === 'explorer') {
      const pathArg = vfsNormalize(spec.explorerPath ?? FS_HOME)

      const existingOpen = this.windows.find(w => w.command === 'explorer')
      if (existingOpen) {
        const ex = existingOpen as FileExplorerWindow
        if (ex.pathMatches(pathArg)) {
          this.closeWindow(existingOpen)
          return
        }
        ex.navigateTo(pathArg)
        this.focusWindow(existingOpen)
        return
      }

      const minEx = this.minimized.find(m => m.win.command === 'explorer')
      if (minEx) {
        const ex = minEx.win as FileExplorerWindow
        if (ex.pathMatches(pathArg)) {
          this.restoreMinimized(minEx)
          return
        }
        ex.navigateTo(pathArg)
        this.restoreMinimized(minEx)
        return
      }

      const { FileExplorerWindow: FileExplorerWindowCtor } = await import('./file-explorer-window')
      let ex!: FileExplorerWindow
      ex = new FileExplorerWindowCtor({
        initialPath: pathArg,
        onClose: () => this.closeWindow(ex),
        onMinimize: () => this.minimizeWindow(ex),
        onMaximize: () => this.toggleMaximizeContent(ex),
        onFocus: () => this.focusWindow(ex),
        onOpenInEditor: absFilePath =>
          void this.openWindow({
            command: 'edit',
            title: `edit — ${absFilePath}`,
            content: [],
            editorPath: absFilePath,
          }),
      })
      this.appendToRightPane(ex.el)
      this.windows.push(ex)
      this.attachVerticalSplitters()
      this.focusWindow(ex)
      return
    }

    if (spec.command === 'browse') {
      const urlArg = normalizeBrowserUrl(spec.browserUrl ?? DEFAULT_BROWSER_URL)

      const existingOpen = this.windows.find(w => w.command === 'browse')
      if (existingOpen) {
        const br = existingOpen as BrowserWindow
        if (br.pathMatches(urlArg)) {
          this.closeWindow(existingOpen)
          return
        }
        br.navigateTo(urlArg)
        this.focusWindow(existingOpen)
        return
      }

      const minBr = this.minimized.find(m => m.win.command === 'browse')
      if (minBr) {
        const br = minBr.win as BrowserWindow
        if (br.pathMatches(urlArg)) {
          this.restoreMinimized(minBr)
          return
        }
        br.navigateTo(urlArg)
        this.restoreMinimized(minBr)
        return
      }

      const { BrowserWindow: BrowserWindowCtor } = await import('./browser-window')
      let br!: BrowserWindow
      br = new BrowserWindowCtor({
        initialUrl: urlArg,
        onClose: () => this.closeWindow(br),
        onMinimize: () => this.minimizeWindow(br),
        onMaximize: () => this.toggleMaximizeContent(br),
        onFocus: () => this.focusWindow(br),
      })
      this.appendToRightPane(br.el)
      this.windows.push(br)
      this.attachVerticalSplitters()
      this.focusWindow(br)
      return
    }

    const miniGameOpen = (
      spec.command === 'paint' ||
      spec.command === 'cube' ||
      spec.command === 'snake' ||
      spec.command === 'pong'
    )
    if (miniGameOpen) {
      const cmd = spec.command
      const min = this.minimized.find(m => m.win.command === cmd)
      if (min) {
        this.restoreMinimized(min)
        return
      }
      const existing = this.windows.find(w => w.command === cmd)
      if (existing) {
        this.closeWindow(existing)
        return
      }

      if (cmd === 'paint') {
        const { PaintWindow: PaintWindowCtor } = await import('./paint-window')
        let pw!: PaintWindow
        pw = new PaintWindowCtor({
          onClose: () => this.closeWindow(pw),
          onMinimize: () => this.minimizeWindow(pw),
          onMaximize: () => this.toggleMaximizeContent(pw),
          onFocus: () => this.focusWindow(pw),
        })
        this.appendToRightPane(pw.el)
        this.windows.push(pw)
        this.attachVerticalSplitters()
        this.focusWindow(pw)
        return
      }
      if (cmd === 'cube') {
        const { RubikWindow: RubikWindowCtor } = await import('./rubik-window')
        let cw!: RubikWindow
        cw = new RubikWindowCtor({
          onClose: () => this.closeWindow(cw),
          onMinimize: () => this.minimizeWindow(cw),
          onMaximize: () => this.toggleMaximizeContent(cw),
          onFocus: () => this.focusWindow(cw),
        })
        this.appendToRightPane(cw.el)
        this.windows.push(cw)
        this.attachVerticalSplitters()
        this.focusWindow(cw)
        return
      }
      if (cmd === 'snake') {
        const { SnakeWindow: SnakeWindowCtor } = await import('./snake-window')
        let sw!: SnakeWindow
        sw = new SnakeWindowCtor({
          onClose: () => this.closeWindow(sw),
          onMinimize: () => this.minimizeWindow(sw),
          onMaximize: () => this.toggleMaximizeContent(sw),
          onFocus: () => this.focusWindow(sw),
        })
        this.appendToRightPane(sw.el)
        this.windows.push(sw)
        this.attachVerticalSplitters()
        this.focusWindow(sw)
        return
      }
      const { PongWindow: PongWindowCtor } = await import('./pong-window')
      let pong!: PongWindow
      pong = new PongWindowCtor({
        onClose: () => this.closeWindow(pong),
        onMinimize: () => this.minimizeWindow(pong),
        onMaximize: () => this.toggleMaximizeContent(pong),
        onFocus: () => this.focusWindow(pong),
      })
      this.appendToRightPane(pong.el)
      this.windows.push(pong)
      this.attachVerticalSplitters()
      this.focusWindow(pong)
      return
    }

    // If there's a minimized version, just restore it
    const min = this.minimized.find(m => m.win.command === spec.command)
    if (min) {
      this.restoreMinimized(min)
      return
    }

    // Toggle: re-running the command closes the open window
    const existing = this.windows.find(w => w.command === spec.command)
    if (existing) {
      this.closeWindow(existing)
      return
    }

    const win = new AppWindow({
      ...spec,
      onClose:    () => this.closeWindow(win),
      onMinimize: () => this.minimizeWindow(win),
      onMaximize: () => this.toggleMaximizeContent(win),
      onFocus:    () => this.focusWindow(win),
    })

    this.appendToRightPane(win.el)
    this.windows.push(win)
    this.attachVerticalSplitters()
    this.focusWindow(win)
  }

  focusTerminal(): void {
    if (this.focusedId !== null) playOsSound('focus')
    this.closeLauncherOverlay()
    this.termWin.classList.remove('terminal-closed')
    if (this.termWin.classList.contains('minimized')) {
      this.termWin.classList.remove('minimized')
    }
    this.focusedId = null
    this.termWin.classList.add('active')
    this.windows.forEach(w => w.setActive(false))
    this.sync()
    requestAnimationFrame(() => this.fitTerminal())
  }

  /**
   * Focus the terminal tile only if it is already visible. Does not restore a
   * minimized or closed terminal (used after closing/minimizing another window).
   */
  private focusTerminalIfAlreadyVisible(): void {
    this.closeLauncherOverlay()
    if (
      this.termWin.classList.contains('minimized') ||
      this.termWin.classList.contains('terminal-closed')
    ) {
      this.focusedId = null
      this.termWin.classList.remove('active')
      this.windows.forEach(w => w.setActive(false))
      this.sync()
      return
    }
    this.focusedId = null
    this.termWin.classList.add('active')
    this.windows.forEach(w => w.setActive(false))
    this.sync()
    requestAnimationFrame(() => this.fitTerminal())
  }

  // ── private: window lifecycle ─────────────────────────────────────────────

  /** Mount a tile on the right stack with a one-shot entrance animation. */
  private appendToRightPane(el: HTMLElement): void {
    this.rightPane.appendChild(el)
    el.classList.add('wm-animate-mount')
    const done = (): void => {
      el.classList.remove('wm-animate-mount')
      el.removeEventListener('animationend', onEnd)
    }
    const onEnd = (e: AnimationEvent): void => {
      if (e.target === el) done()
    }
    el.addEventListener('animationend', onEnd)
    window.setTimeout(done, 700)
  }

  private closeWindow(win: TiledWin): void {
    const idx = this.windows.indexOf(win)
    if (idx === -1) return
    ;(win as { dispose?: () => void }).dispose?.()
    if (win.isMaximized()) this.unmaximizeContent(win)
    win.el.remove()
    this.windows.splice(idx, 1)
    if (this.focusedId === win.command) this.focusTerminalIfAlreadyVisible()
    this.attachVerticalSplitters()
    this.sync()
  }

  private focusWindow(win: TiledWin): void {
    if (this.focusedId !== win.command) playOsSound('focus')
    this.closeLauncherOverlay()
    this.focusedId = win.command
    this.termWin.classList.remove('active')
    this.windows.forEach(w => w.setActive(w === win))
    this.sync()
    switch (win.command) {
      case 'edit':
        ;(win as EditorWindow).focusEditor()
        break
      case 'explorer':
        ;(win as FileExplorerWindow).focusPanel()
        break
      case 'browse':
        ;(win as BrowserWindow).focusAddressBar()
        break
      case 'paint':
      case 'snake':
      case 'pong':
      case 'cube':
        ;(win as PaintWindow | SnakeWindow | PongWindow | RubikWindow).focusCanvas()
        break
      default:
        break
    }
  }

  // ── private: maximize / restore ─────────────────────────────────────────────

  private toggleMaximizeTerminal(): void {
    if (this.maximizedId === TERMINAL_MAX_ID) {
      this.unmaximizeTerminal()
      return
    }
    // Clear content maximize first
    if (this.maximizedId && this.maximizedId !== TERMINAL_MAX_ID) {
      const w = this.windows.find(x => x.command === this.maximizedId)
      if (w) this.unmaximizeContent(w)
    }
    this.termWin.classList.add('maximized')
    this.panes.classList.add('max-terminal')
    this.maximizedId = TERMINAL_MAX_ID
    requestAnimationFrame(() => this.fitTerminal())
  }

  private unmaximizeTerminal(): void {
    this.termWin.classList.remove('maximized')
    this.panes.classList.remove('max-terminal')
    if (this.maximizedId === TERMINAL_MAX_ID) this.maximizedId = null
    requestAnimationFrame(() => this.fitTerminal())
  }

  private toggleMaximizeContent(win: TiledWin): void {
    if (win.isMaximized()) {
      this.unmaximizeContent(win)
      return
    }
    if (this.maximizedId === TERMINAL_MAX_ID) this.unmaximizeTerminal()
    if (this.maximizedId && this.maximizedId !== TERMINAL_MAX_ID) {
      const other = this.windows.find(w => w.command === this.maximizedId)
      if (other) this.unmaximizeContent(other)
    }

    this.contentRestore.set(win, {
      parent: win.el.parentElement!,
      next:   win.el.nextSibling,
    })
    this.panes.appendChild(win.el)
    win.el.classList.add('maximized')
    this.panes.classList.add('max-content')
    this.maximizedId = win.command
    requestAnimationFrame(() => this.fitTerminal())
  }

  private unmaximizeContent(win: TiledWin): void {
    if (!win.isMaximized()) return
    const slot = this.contentRestore.get(win)
    win.el.classList.remove('maximized')
    this.panes.classList.remove('max-content')
    if (slot) {
      slot.parent.insertBefore(win.el, slot.next)
      this.contentRestore.delete(win)
    }
    if (this.maximizedId === win.command) this.maximizedId = null
    this.attachVerticalSplitters()
    this.sync()
  }

  private toggleMaximizeFocused(): void {
    if (this.focusedId === null) {
      this.toggleMaximizeTerminal()
      return
    }
    const w = this.windows.find(x => x.command === this.focusedId)
    if (w) this.toggleMaximizeContent(w)
  }

  // ── private: minimize / restore ────────────────────────────────────────────

  private minimizeWindow(win: TiledWin): void {
    playOsSound('click')
    const idx = this.windows.indexOf(win)
    if (idx === -1) return
    if (win.isMaximized()) this.unmaximizeContent(win)

    win.setMinimized(true)
    win.el.remove()
    this.windows.splice(idx, 1)

    this.minimized.push({ win })

    if (this.focusedId === win.command) this.focusTerminalIfAlreadyVisible()
    this.attachVerticalSplitters()
    this.sync()
  }

  private restoreMinimized(entry: MinimizedEntry): void {
    const i = this.minimized.indexOf(entry)
    if (i === -1) return
    this.minimized.splice(i, 1)

    this.showingDesktop = false
    this.launcherOpen = false

    entry.win.setMinimized(false)
    this.appendToRightPane(entry.win.el)
    this.windows.push(entry.win)
    this.attachVerticalSplitters()
    this.focusWindow(entry.win)
  }

  private minimizeTerminal(): void {
    playOsSound('click')
    if (this.termWin.classList.contains('terminal-closed')) return
    if (this.maximizedId === TERMINAL_MAX_ID) this.unmaximizeTerminal()
    this.termWin.classList.add('minimized')
    this.termWin.classList.remove('active')
    if (this.windows.length > 0) {
      this.focusWindow(this.windows[0])
    } else {
      this.focusedId = null
      this.sync()
    }
  }

  /** Dismiss terminal (hidden tile). Unlike minimize, does not auto-open app launchers. */
  private closeTerminal(): void {
    if (this.maximizedId === TERMINAL_MAX_ID) this.unmaximizeTerminal()
    this.termWin.classList.remove('minimized')
    this.termWin.classList.add('terminal-closed')
    this.showingDesktop = false
    this.launcherOpen = false
    this.termWin.classList.remove('active')

    if (this.windows.length > 0) {
      this.focusWindow(this.windows[0])
    } else {
      this.focusedId = null
    }
    this.sync()
  }

  // ── private: show desktop ───────────────────────────────────────────────────

  private toggleShowDesktop(): void {
    this.showingDesktop = !this.showingDesktop
    if (!this.showingDesktop) this.launcherOpen = false
    this.sync()
  }

  /**
   * Launcher overlay: Ctrl+D (show-desktop), Applications button, or both.
   * Minimizing all windows does not auto-open the launcher.
   */
  private syncLauncherVisibility(): void {
    const show = this.showingDesktop || this.launcherOpen
    this.desktop.classList.toggle('launchers-visible', show)

    const shell = document.getElementById('launcher-shell')
    if (shell) shell.setAttribute('aria-hidden', show ? 'false' : 'true')

    document.getElementById('btn-applications')?.setAttribute(
      'aria-expanded',
      show ? 'true' : 'false',
    )

    if (!show) {
      const input = document.getElementById('launcher-search') as HTMLInputElement | null
      if (input?.value) {
        input.value = ''
        document.querySelectorAll('#desktop-icons .desktop-icon').forEach(btn => {
          (btn as HTMLElement).style.display = ''
        })
      }
    }
  }

  /** Close launcher overlay from any source (bar, Ctrl+D, Escape, backdrop). */
  private closeLauncherOverlay(): void {
    if (!this.showingDesktop && !this.launcherOpen) return
    this.showingDesktop = false
    this.launcherOpen = false
    this.sync()
  }

  private toggleLauncherFromButton(): void {
    const visible = this.showingDesktop || this.launcherOpen
    if (visible) {
      this.closeLauncherOverlay()
      return
    }
    this.launcherOpen = true
    this.sync()
    requestAnimationFrame(() => document.getElementById('launcher-search')?.focus())
  }

  private initYasbChrome(): void {
    document.getElementById('btn-applications')?.addEventListener('click', e => {
      e.stopPropagation()
      this.toggleLauncherFromButton()
    })
    document.getElementById('launcher-backdrop')?.addEventListener('click', () => {
      this.closeLauncherOverlay()
    })
    document.addEventListener(
      'keydown',
      ev => {
        if (ev.key !== 'Escape') return
        if (!this.showingDesktop && !this.launcherOpen) return
        if (ev.ctrlKey || ev.altKey || ev.metaKey) return
        ev.preventDefault()
        this.closeLauncherOverlay()
      },
      true,
    )
  }

  private initLauncherSearch(): void {
    const input = document.getElementById('launcher-search') as HTMLInputElement | null
    if (!input) return
    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase()
      document.querySelectorAll('#desktop-icons .desktop-icon').forEach(btn => {
        const label =
          btn.querySelector('.desktop-icon-label')?.textContent?.toLowerCase() ?? ''
        ;(btn as HTMLElement).style.display =
          !q || label.includes(q) ? '' : 'none'
      })
    })
  }

  private initTopBarClock(): void {
    const el = document.getElementById('yasb-clock-text')
    if (!el) return
    const tick = (): void => {
      el.textContent = new Date().toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      })
    }
    tick()
    window.setInterval(tick, 30000)
  }

  // ── desktop icons (wallpaper layer launchers) ───────────────────────────────

  private initDesktopIcons(): void {
    const root = document.getElementById('desktop-icons')
    if (!root) return

    for (const item of LAUNCHER_ICONS) {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'desktop-icon'
      if (item.kind === 'terminal') {
        btn.innerHTML = `<span class="desktop-icon-glyph">${item.glyph}</span><span class="desktop-icon-label">${item.label}</span>`
        btn.addEventListener('click', () => {
          this.focusTerminal()
        })
      } else {
        const cmd = commands[item.cmd]
        if (!cmd || !WINDOW_COMMANDS.has(item.cmd)) continue
        btn.innerHTML = `<span class="desktop-icon-glyph">${item.glyph}</span><span class="desktop-icon-label">${item.label}</span>`
        attachLazyTilePrefetchHandlers(btn, item.cmd)
        btn.addEventListener('click', () => {
          void this.openWindow({
            command: item.cmd,
            title: item.cmd,
            content: cmd.run([]),
            editorPath: item.cmd === 'edit' ? 'welcome.txt' : undefined,
            explorerPath: item.cmd === 'explorer' ? FS_HOME : undefined,
            browserUrl:
              item.cmd === 'browse' ? DEFAULT_BROWSER_URL : undefined,
          })
        })
      }
      root.appendChild(btn)
    }
  }

  // ── private: vertical splitters between stacked content windows ───────────

  private attachVerticalSplitters(): void {
    // Remove any existing v-splitters and rebuild — keep windows in order
    this.rightPane.querySelectorAll('.splitter-v').forEach(el => el.remove())

    // While maximized, the active window lives under #panes — only tile splits in #right-pane
    const tiled = this.windows.filter(w => w.el.parentElement === this.rightPane)

    for (let i = 0; i < tiled.length - 1; i++) {
      const splitter = document.createElement('div')
      splitter.className = 'splitter splitter-v'
      this.rightPane.insertBefore(splitter, tiled[i + 1].el)

      new Splitter({
        el:          splitter,
        orientation: 'v',
        target:      tiled[i].el,
        container:   this.rightPane,
        min:         100,
      })
    }
  }

  // ── private: layout sync ───────────────────────────────────────────────────

  private sync(): void {
    const count = this.windows.length
    this.desktop.dataset.contentCount = String(count)
    this.desktop.dataset.terminalClosed = this.termWin.classList.contains('terminal-closed')
      ? '1'
      : '0'
    this.syncLauncherVisibility()
    this.syncTaskbar()
    this.syncFocusedTitle()
    requestAnimationFrame(() => this.fitTerminal())
  }

  /** Pinned dock — subset of {@link LAUNCHER_ICONS} (excludes `DOCK_EXCLUDED_CMDS`). */
  private pinnedDockSlots(): Array<{ kind: 'terminal' } | { kind: 'app'; cmd: string }> {
    const slots: Array<{ kind: 'terminal' } | { kind: 'app'; cmd: string }> = []
    for (const item of LAUNCHER_ICONS) {
      if (item.kind === 'app' && DOCK_EXCLUDED_CMDS.has(item.cmd)) continue
      if (item.kind === 'terminal') slots.push({ kind: 'terminal' })
      else slots.push({ kind: 'app', cmd: item.cmd })
    }
    return slots
  }

  /** Open / minimized apps not in the pinned strip — shown after a divider like macOS. */
  private runningDockExtraSlots(): Array<{ kind: 'app'; cmd: string }> {
    const pinned = pinnedDockAppCommands()
    const out: Array<{ kind: 'app'; cmd: string }> = []
    const seen = new Set<string>()

    const add = (cmd: string): void => {
      if (pinned.has(cmd) || seen.has(cmd)) return
      seen.add(cmd)
      out.push({ kind: 'app', cmd })
    }

    for (const w of this.windows) add(w.command)
    for (const { win } of this.minimized) add(win.command)
    return out
  }

  /** Pinned row + running unpinned windows (each command once). */
  private allDockSlots(): Array<{ kind: 'terminal' } | { kind: 'app'; cmd: string }> {
    return [...this.pinnedDockSlots(), ...this.runningDockExtraSlots()]
  }

  /** Dock / Ctrl+n: launch · restore · focus — or minimize when already focused. */
  private dockActivateTerminal(): void {
    const terminalFocused =
      this.focusedId === null &&
      !this.termWin.classList.contains('terminal-closed') &&
      !this.termWin.classList.contains('minimized')
    if (terminalFocused) {
      this.minimizeTerminal()
      return
    }
    this.focusTerminal()
  }

  private dockActivateApp(cmd: string): void {
    const wmCmd = OPEN_EDITOR_LAUNCH_CMDS.has(cmd) ? 'edit' : cmd
    const open = this.windows.find(w => w.command === wmCmd)
    if (open) {
      if (this.focusedId === wmCmd) {
        this.minimizeWindow(open)
        return
      }
      this.focusWindow(open)
      return
    }
    const entry = this.minimized.find(m => m.win.command === wmCmd)
    if (entry) {
      this.restoreMinimized(entry)
      return
    }
    const def = commands[cmd]
    if (!def || !WINDOW_COMMANDS.has(cmd)) return
    if (OPEN_EDITOR_LAUNCH_CMDS.has(cmd)) {
      const heading = cmd === 'vim' ? 'vim' : cmd === 'editor' ? 'editor' : 'edit'
      void this.openWindow({
        command: 'edit',
        title: `${heading} — welcome.txt`,
        content: [],
        editorPath: 'welcome.txt',
      })
      return
    }
    if (cmd === 'explorer') {
      void this.openWindow({
        command: 'explorer',
        title: 'files',
        content: def.run([]),
        explorerPath: FS_HOME,
      })
      return
    }
    if (cmd === 'browse') {
      void this.openWindow({
        command: 'browse',
        title: 'browse',
        content: def.run([]),
        browserUrl: DEFAULT_BROWSER_URL,
      })
      return
    }
    if (cmd === 'paint' || cmd === 'cube' || cmd === 'snake' || cmd === 'pong') {
      void this.openWindow({ command: cmd, title: cmd, content: [] })
      return
    }
    void this.openWindow({ command: cmd, title: cmd, content: def.run([]) })
  }

  private focusTaskbarIndex(index: number): void {
    const slots = this.allDockSlots()
    const slot = slots[index]
    if (!slot) return
    if (slot.kind === 'terminal') {
      this.dockActivateTerminal()
      return
    }
    this.dockActivateApp(slot.cmd)
  }

  private syncFocusedTitle(): void {
    const el = document.getElementById('yasb-focused')
    if (!el) return

    if (this.focusedId !== null) {
      const icon = LAUNCHER_ICONS.find(
        (i): i is { kind: 'app'; cmd: string; label: string; glyph: string } =>
          i.kind === 'app' && i.cmd === this.focusedId,
      )
      el.textContent = icon?.label ?? this.focusedId
      return
    }

    if (this.termWin.classList.contains('terminal-closed')) {
      el.textContent = this.windows.length === 0 ? 'mrgrey.dev' : '\u2014'
      return
    }
    if (this.termWin.classList.contains('minimized')) {
      el.textContent = 'Terminal (minimized)'
      return
    }
    el.textContent = 'mrgrey@dev — ~/terminal'
  }

  private syncTaskbar(): void {
    this.taskbarDock.replaceChildren()
    const pinned = this.pinnedDockSlots()
    const extras = this.runningDockExtraSlots()
    const slots = this.allDockSlots()
    const pinLen = pinned.length

    slots.forEach((slot, idx) => {
      if (idx === pinLen && extras.length > 0) {
        const sep = document.createElement('span')
        sep.className = 'wm-dock-sep'
        sep.setAttribute('role', 'separator')
        sep.setAttribute('aria-hidden', 'true')
        sep.title = 'Running apps'
        this.taskbarDock.appendChild(sep)
      }

      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'wm-task-btn'
      if (idx >= pinLen && extras.length > 0) btn.classList.add('wm-task-btn--running')

      const meta =
        slot.kind === 'terminal'
          ? LAUNCHER_ICONS.find(i => i.kind === 'terminal')!
          : LAUNCHER_ICONS.find(
              (i): i is { kind: 'app'; cmd: string; label: string; glyph: string } =>
                i.kind === 'app' && i.cmd === slot.cmd,
            ) ?? {
              kind: 'app' as const,
              cmd: slot.cmd,
              label: slot.cmd,
              glyph: '◇',
            }

      let isMinimized = false
      let isActive = false
      let isIdle = false

      if (slot.kind === 'terminal') {
        isMinimized = this.termWin.classList.contains('minimized')
        isActive =
          this.focusedId === null &&
          !this.termWin.classList.contains('terminal-closed') &&
          !this.termWin.classList.contains('minimized')
        if (this.termWin.classList.contains('terminal-closed')) {
          btn.classList.add('wm-task-btn--closed')
        }
      } else {
        const open = this.windows.find(w => w.command === slot.cmd)
        isMinimized =
          !open && this.minimized.some(m => m.win.command === slot.cmd)
        isActive = this.focusedId === slot.cmd
        isIdle = !open && !isMinimized
      }

      if (isMinimized) btn.classList.add('wm-task-btn--minimized')
      if (isActive) btn.classList.add('wm-task-btn--active')
      if (isIdle) btn.classList.add('wm-task-btn--idle')

      btn.title = meta.label

      const gl = document.createElement('span')
      gl.className = 'wm-task-glyph'
      gl.setAttribute('aria-hidden', 'true')
      gl.textContent = meta.glyph
      btn.appendChild(gl)

      const lab = document.createElement('span')
      lab.className = 'wm-task-label'
      lab.textContent = meta.label
      btn.appendChild(lab)

      if (slot.kind !== 'terminal') attachLazyTilePrefetchHandlers(btn, slot.cmd)

      btn.addEventListener('click', () => this.focusTaskbarIndex(idx))
      this.taskbarDock.appendChild(btn)
    })
  }

  // ── private: keyboard ──────────────────────────────────────────────────────

  private handleGlobal(ev: KeyboardEvent): void {
    if (!ev.ctrlKey || ev.altKey || ev.metaKey) return

    const key = ev.key.toLowerCase()

    // Reserved keys for the WM — intercept before xterm/vim see them
    const wmKeys = new Set([
      't', '1', '2', '3', '4', '5', '6', '7', '8', '9',
      'h','l','j','k','q','m','d','f',
    ])
    if (!wmKeys.has(key)) return

    ev.preventDefault()
    ev.stopImmediatePropagation()

    // Ctrl+T → terminal (restore if minimized)
    if (key === 't') { this.focusTerminal(); return }

    // Ctrl+1..9 → taskbar slot (launcher order, left → right)
    const n = parseInt(key, 10)
    if (n >= 1 && n <= 9) {
      this.focusTaskbarIndex(n - 1)
      return
    }

    // Ctrl+H / Ctrl+L → directional focus
    if (key === 'h') { this.focusLeft();  return }
    if (key === 'l') { this.focusRight(); return }

    // Ctrl+Q → close focused content window, or terminal when it holds focus
    if (key === 'q') {
      if (this.focusedId) {
        const w = this.windows.find(x => x.command === this.focusedId)
        if (w) this.closeWindow(w)
      } else if (!this.termWin.classList.contains('terminal-closed')) {
        this.closeTerminal()
      }
      return
    }

    // Ctrl+M → minimize focused window (terminal if nothing else focused)
    if (key === 'm') {
      if (this.focusedId) {
        const w = this.windows.find(x => x.command === this.focusedId)
        if (w) this.minimizeWindow(w)
      } else {
        this.minimizeTerminal()
      }
      return
    }

    // Ctrl+F → maximize / restore
    if (key === 'f') { this.toggleMaximizeFocused(); return }

    // Ctrl+D → toggle show-desktop
    if (key === 'd') { this.toggleShowDesktop(); return }

    // Ctrl+J / Ctrl+K → scroll focused content window
    if (this.focusedId && (key === 'j' || key === 'k')) {
      const w = this.windows.find(x => x.command === this.focusedId)
      w?.scrollBy(key === 'j' ? 80 : -80)
    }
  }

  private focusLeft(): void {
    if (this.focusedId === null) return                      // already at terminal
    const idx = this.windows.findIndex(w => w.command === this.focusedId)
    if (idx <= 0) { this.focusTerminal(); return }
    this.focusWindow(this.windows[idx - 1])
  }

  private focusRight(): void {
    if (this.focusedId === null) {                           // terminal → first window
      if (this.windows[0]) this.focusWindow(this.windows[0])
      return
    }
    const idx = this.windows.findIndex(w => w.command === this.focusedId)
    if (idx >= 0 && idx < this.windows.length - 1) {
      this.focusWindow(this.windows[idx + 1])
    }
  }
}
