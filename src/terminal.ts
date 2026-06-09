/**
 * xterm façade: scripted boot lines, Vim-style prompt (`vim.ts`), dispatches CLI commands.
 * Window-spawning commands call `onOpenWindow` wired from `Desktop`.
 */
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { commands } from './commands/index'
import { BANNER } from './ascii'
import { VimInput } from './vim'
import type { VimMode } from './vim'
import type { WindowSpec } from './desktop'
import { dispatchTerminalCommand } from './terminal-command-router'
import { getActiveTerminalTheme, c } from './theme'
import { vfsPromptPath } from './os-fs'
import { createWindowChrome } from './window-chrome'
import { prefersReducedMotion } from './prefers-reduced-motion'

/**
 * Lines shown as the terminal's welcome message (motd).
 * Returns plain strings (may contain ANSI codes) — no side effects.
 */
export function terminalMotdLines(): string[] {
  return [
    ...BANNER,
    '',
    `  ${c.pink}mrgrey.site${c.reset} — portfolio OS`,
    `  ${c.dim}Desktop: Portfolio · Apps · Games — type ${c.reset}help${c.dim} for commands.${c.reset}`,
  ]
}

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

export class TerminalApp {
  private xterm: Terminal
  private fitAddon: FitAddon
  private container: HTMLElement
  /** Inset surface so xterm + FitAddon measure the padded area, not the window edge. */
  private surface: HTMLElement
  /** Footer vim mode badge (`#vim-mode-line`). */
  private modeLine: HTMLElement | null
  private onOpenWindow: (spec: WindowSpec) => void

  private vim: VimInput
  /** When true, readline behaves like vim; when false, plain line editing. */
  private vimEnabled = true
  private history: string[] = []
  private historyIndex = -1
  private isProcessing = false
  /** Aborts the window-resize listener wired in mount() when the tile closes. */
  private resizeAbort = new AbortController()

  constructor(
    container: HTMLElement,
    modeLine: HTMLElement | null = null,
    onOpenWindow: (spec: WindowSpec) => void = () => {},
  ) {
    this.container = container
    this.surface = document.createElement('div')
    this.surface.className = 'terminal-surface'
    this.container.appendChild(this.surface)
    this.modeLine = modeLine
    this.onOpenWindow = onOpenWindow
    this.vim = new VimInput(mode => this.onModeChange(mode))

    this.xterm = new Terminal({
      theme: getActiveTerminalTheme(),
      fontFamily:       `JetBrains Mono, ui-monospace, SFMono-Regular, monospace`,
      fontSize:         15,
      fontWeight:       400,
      fontWeightBold:   600,
      lineHeight:       1.2,
      cursorBlink:      true,
      cursorStyle:      'bar',
      scrollback:       5000,
      smoothScrollDuration: 140,
      allowProposedApi: true,
    })

    this.fitAddon = new FitAddon()
    this.xterm.loadAddon(this.fitAddon)
    this.xterm.loadAddon(new WebLinksAddon())
  }

  // ── public ──────────────────────────────────────────────────────────────────

  async mount(): Promise<void> {
    this.xterm.open(this.surface)
    this.fitAddon.fit()
    window.addEventListener('resize', () => this.fitAddon.fit(), {
      signal: this.resizeAbort.signal,
    })
    this.xterm.onKey(({ domEvent }) => this.handleKey(domEvent))
    this.onModeChange('insert')
    await this.showMotd()
  }

  /** Called by Desktop when window tiles change size. */
  fit(): void {
    this.fitAddon.fit()
  }

  /** Move keyboard focus into the shell (skip link / chrome hand-off). */
  focusShell(): void {
    this.xterm.focus()
  }

  /** Release xterm resources + the window-resize listener when the tile closes. */
  dispose(): void {
    this.resizeAbort.abort()
    this.xterm.dispose()
  }

  /** Keep xterm palette in sync when theme changes from the system menu (or elsewhere). */
  syncXtermTheme(): void {
    this.refreshTerminalTheme()
    this.fitAddon.fit()
  }

  private refreshTerminalTheme(): void {
    this.xterm.options.theme = getActiveTerminalTheme()
  }

  private onModeChange(mode: VimMode): void {
    if (!this.vimEnabled) return
    if (this.modeLine) {
      const label = this.modeLine.querySelector('.vim-mode-text')
      if (label) label.textContent = mode.toUpperCase()
      this.modeLine.className = `vim-mode-line mode-${mode}`
    }
    this.xterm.options.cursorStyle = mode === 'insert' ? 'bar' : 'block'
  }

  // ── banner + prompt ──────────────────────────────────────────────────────────

  private getPrompt(): string {
    const path = vfsPromptPath()
    return `${c.pink}namefailed${c.reset}${c.dim}@${c.reset}${c.blue}dev${c.reset}${c.dim}:${path}$${c.reset} `
  }

  /** Animate the MOTD banner line-by-line, then drop to the prompt. */
  private async showMotd(): Promise<void> {
    const reduced = prefersReducedMotion()
    for (const line of BANNER) {
      this.xterm.writeln(line)
      if (!reduced) await sleep(55)
    }
    // Subtitle + help hint appear instantly after the banner completes
    this.xterm.writeln('')
    this.xterm.writeln(`  ${c.pink}mrgrey.site${c.reset} — portfolio OS`)
    this.xterm.writeln(
      `  ${c.dim}Desktop: ${c.reset}Portfolio${c.dim} · ${c.reset}Apps${c.dim} · ${c.reset}Games` +
        `${c.dim} folders — or type ${c.reset}help${c.dim} for commands.${c.reset}`,
    )
    this.xterm.writeln('')
    this.prompt()
  }

  // ── rendering ────────────────────────────────────────────────────────────────

  private async showSpinner(label: string, ms: number): Promise<void> {
    const interval = 80
    const ticks    = Math.ceil(ms / interval)
    for (let i = 0, f = 0; i < ticks; i++, f++) {
      this.xterm.write(`\r  ${c.pink}${SPINNER_FRAMES[f % SPINNER_FRAMES.length]}${c.reset}  ${c.dim}${label}${c.reset}`)
      await sleep(interval)
    }
    this.xterm.write('\r\x1b[2K')
  }

  private writeln(line: string)      { this.xterm.writeln(line) }
  private writeLines(ls: string[])   { for (const l of ls) this.writeln(l) }

  private renderInputLine(): void {
    const rendered = this.vim.render()
    const back     = this.vim.cursorBack()
    let   out      = '\r' + this.getPrompt() + rendered + '\x1b[K'
    if (back > 0) out += `\x1b[${back}D`
    this.xterm.write(out)
  }

  private prompt(): void {
    this.vim.clear()
    this.xterm.write('\r\n' + this.getPrompt())
    if (this.vimEnabled) this.onModeChange('insert')
  }

  // ── input handling ───────────────────────────────────────────────────────────

  private handleKey(ev: KeyboardEvent): void {
    if (this.isProcessing) return
    if (!this.vimEnabled && ev.key === 'Escape') return

    const action = this.vim.handleKey(ev)

    switch (action.type) {
      case 'none': break

      case 'rendered':
        this.renderInputLine()
        break

      case 'submit':
        this.xterm.writeln('')
        void this.execute(action.value.trim())
        break

      case 'history': {
        const { dir } = action
        if (dir === 'up') {
          if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++
            this.vim.setBuffer(this.history[this.history.length - 1 - this.historyIndex])
            this.renderInputLine()
          }
        } else {
          if (this.historyIndex > 0) {
            this.historyIndex--
            this.vim.setBuffer(this.history[this.history.length - 1 - this.historyIndex])
          } else {
            this.historyIndex = -1
            this.vim.setBuffer('')
          }
          this.renderInputLine()
        }
        break
      }

      case 'complete':  this.autocomplete(); break
      case 'interrupt': this.xterm.writeln('^C'); this.prompt(); break
      case 'clear':     this.xterm.clear(); this.prompt(); break
    }
  }

  private autocomplete(): void {
    const partial = this.vim.getValue().trim()
    if (!partial) return

    const matches = Object.keys(commands)
      .filter(cmd => !commands[cmd].hidden)
      .filter(cmd => cmd.startsWith(partial))

    if (matches.length === 1) {
      this.vim.setBufferInsert(matches[0])
      this.renderInputLine()
    } else if (matches.length > 1) {
      this.xterm.writeln('')
      this.xterm.writeln('  ' + matches.map(m => `${c.blue}${m}${c.reset}`).join('  '))
      this.xterm.write(this.getPrompt() + this.vim.getValue())
    }
  }

  // ── command execution ────────────────────────────────────────────────────────

  private async execute(raw: string): Promise<void> {
    if (!raw) { this.prompt(); return }

    window.dispatchEvent(new CustomEvent('mrgrey-terminal-cmd'))

    this.isProcessing = true
    const [rawName, ...args] = raw.split(/\s+/)
    const name = rawName
    const cmd = commands[name]

    if (!cmd) {
      const keys = Object.keys(commands).filter(k => !commands[k].hidden)
      const cand = keys.find(k => k.startsWith(rawName))
      const suggest = cand ? ` ${c.dim}· did you mean ${c.blue}${cand}${c.reset}${c.dim}?${c.reset}` : ''
      this.writeln(
        `  ${c.red}command not found:${c.reset} ${rawName}` +
        `  ${c.dim}(try ${c.reset}${c.blue}help${c.reset}${c.dim})${c.reset}${suggest}`,
      )
    } else {
      if (cmd.loadMs) await this.showSpinner(name, cmd.loadMs)

      const host = {
        writeln: (line: string) => this.writeln(line),
        writeLines: (lines: string[]) => this.writeLines(lines),
        clearTerminal: () => this.xterm.clear(),
        onOpenWindow: (spec: WindowSpec) => this.onOpenWindow(spec),
        showSpinner: (label: string, ms: number) => this.showSpinner(label, ms),
        refreshTerminalTheme: () => this.refreshTerminalTheme(),
        showMotd: () => this.showMotd(),
        recordHistory: (entry: string) => {
          this.history.push(entry)
          this.historyIndex = -1
        },
      }

      const outcome = await dispatchTerminalCommand(host, name, args, raw, cmd)
      if (outcome === 'exit') {
        this.isProcessing = false
        return
      }

      this.history.push(raw)
      this.historyIndex = -1
    }

    this.isProcessing = false
    this.prompt()
  }
}

// ── TerminalWindow ─────────────────────────────────────────────────────────────

export interface TerminalWindowOptions {
  onClose:       () => void
  onMinimize:    () => void
  onMaximize:    () => void
  onFocus:       () => void
  onOpenWindow:  (spec: WindowSpec) => void
}

/**
 * Lazy-loaded terminal tile — mirrors the paint-window / snake-window pattern.
 * Created on demand by Desktop.openWindow({ command: 'terminal' }).
 */
export class TerminalWindow {
  readonly el:      HTMLElement
  readonly command  = 'terminal' as const
  readonly onFocus: () => void
  private inner:    HTMLElement
  private app:      TerminalApp
  private themeAbort = new AbortController()

  constructor(opts: TerminalWindowOptions) {
    this.onFocus = opts.onFocus

    // ── Outer shell ──────────────────────────────────────────────────────────
    const winChrome = createWindowChrome({
      title: 'terminal',
      onClose: opts.onClose,
      onMinimize: opts.onMinimize,
      onMaximize: opts.onMaximize,
      onFocus: opts.onFocus,
    })
    this.el = winChrome.el
    this.el.classList.add('terminal-app')

    // ── Terminal stack (mirrors static #terminal-window layout) ──────────────
    const stack = document.createElement('div')
    stack.className = 'terminal-stack'

    // xterm host — must have flex layout or FitAddon sees 0 height
    this.inner = document.createElement('div')
    this.inner.className = 'terminal-host'
    stack.appendChild(this.inner)

    // Status bar with vim mode indicator — mirrors .terminal-status-bar in HTML
    const statusBar = document.createElement('div')
    statusBar.className = 'terminal-status-bar'
    statusBar.setAttribute('aria-label', 'Shell status')

    const modeLine = document.createElement('footer')
    modeLine.id = 'vim-mode-line-tw'
    modeLine.className = 'vim-mode-line mode-insert'
    modeLine.setAttribute('aria-label', 'Vim input mode')
    modeLine.innerHTML =
      `<span class="vim-mode-glyph" aria-hidden="true">◆</span>` +
      `<span class="vim-mode-core">` +
        `<span class="vim-mode-dash">&#x2014;</span>` +
        `<span class="vim-mode-text">INSERT</span>` +
        `<span class="vim-mode-dash">&#x2014;</span>` +
      `</span>`
    statusBar.appendChild(modeLine)
    stack.appendChild(statusBar)

    this.el.appendChild(stack)

    this.app = new TerminalApp(this.inner, modeLine, opts.onOpenWindow)

    // Keep palette in sync when theme changes, until this window is closed.
    window.addEventListener(
      'mrgrey-theme-change',
      () => this.app.syncXtermTheme(),
      { signal: this.themeAbort.signal },
    )
  }

  /** Tear down xterm + theme listener when the tile closes. */
  dispose(): void {
    this.themeAbort.abort()
    this.app.dispose()
  }

  async mount(): Promise<void> {
    await this.app.mount()
  }

  /** Pass through to TerminalApp for window resize events. */
  fit(): void { this.app.fit() }

  focusShell(): void { this.app.focusShell() }

  /** Required by TiledWin interface — delegates to TerminalApp. */
  syncXtermTheme(): void { this.app.syncXtermTheme() }

  /** Required by TiledWin — mirrors AppWindow.setActive. */
  setActive(active: boolean): void {
    this.el.classList.toggle('active', active)
  }

  /** Required by TiledWin — mirrors AppWindow.setMinimized. */
  setMinimized(min: boolean): void {
    this.el.classList.toggle('minimized', min)
  }

  /** Required by TiledWin — mirrors AppWindow.isMaximized. */
  isMaximized(): boolean {
    return this.el.classList.contains('maximized')
  }
}
