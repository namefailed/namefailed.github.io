/**
 * My xterm shell: boot lines, vim-style prompt editing, dispatch into `commands`.
 * Anything that opens a tiled window goes through `onOpenWindow` from `Desktop`.
 */
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import {
  getActiveTerminalTheme,
  getActivePack,
  getThemeId,
  listThemeSummaries,
  applyTheme,
  c,
} from './theme'
import { commands } from './commands/index'
import { BANNER } from './ascii'
import { VimInput } from './vim'
import type { VimMode } from './vim'
import type { WindowSpec } from './desktop'
import { getRetroFx, setRetroFx, toggleRetroFx } from './retro-fx'
import { getMatrixBgHandle } from './matrix-bg'
import { DEFAULT_BROWSER_URL, normalizeBrowserUrl } from './browser-window'
import { vfsNormalize, vfsPromptPath, vfsPwd } from './os-fs'
import {
  playOsSound,
  resumeAudioIfNeeded,
  setSoundEnabled,
  isSoundEnabled,
  toggleSound,
  getSoundVolume,
} from './os-sound'
import { syncSettingsSoundToggle } from './os-systray'
import { windowSpawnEcho } from './cli-window-echo'

// ── constants ─────────────────────────────────────────────────────────────────

const SPINNER_FRAMES = ['⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏']

// Commands that open a content window instead of printing to the terminal
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

const OPEN_EDITOR_WINDOWS = new Set(['edit', 'editor', 'vim'])

const BOOT_LINES: Array<{ text: string; delay: number }> = [
  { text: `${c.dim}[    0.000000] Booting mrgrey.dev kernel v1.0.0-portfolio ...${c.reset}`, delay: 55 },
  { text: `${c.dim}[    0.011204] Command line: BOOT_IMAGE=/portfolio root=/dev/reality net.ifnames=0${c.reset}`, delay: 75 },
  { text: `${c.dim}[    0.052891] x86/fake: Booting SMP kernel ...${c.reset}`, delay: 70 },
  { text: `${c.dim}[    0.089234] Initializing cgroup subsys cpu ...${c.green}OK${c.reset}`, delay: 85 },
  { text: `${c.dim}[    0.134521] Memory: 16384K/${c.pink}∞${c.dim} available (browser-backed)${c.reset}`, delay: 95 },
  { text: `${c.dim}[    0.198760] PCI: Probing imaginary USB hub ... ${c.green}found 0 devices${c.reset}`, delay: 90 },
  { text: `${c.dim}[    0.234891] Loading portfolio modules (tree-shaken) ... ${c.green}OK${c.reset}`, delay: 100 },
  { text: `${c.dim}[    0.356123] Mounting /home/mrgrey on tmp persistence ... ${c.green}OK${c.reset}`, delay: 95 },
  { text: `${c.dim}[    0.412045] rng-core: Pseudo RNG seeded from Date.now() ... ${c.green}OK${c.reset}`, delay: 85 },
  { text: `${c.dim}[    0.512045] systemd[1]: Starting Terminus session on pts/0 ... ${c.green}OK${c.reset}`, delay: 100 },
  { text: `${c.dim}[    0.612045] Starting terminal daemon (xterm.js+vim handlers) ... ${c.green}OK${c.reset}`, delay: 105 },
  { text: `${c.dim}[    0.734567] Spawning tiling WM + status bar ... ${c.green}OK${c.reset}`, delay: 115 },
  { text: `${c.dim}[    0.834567] Sound server: Web Audio API (opt-in bleeps) ... ${c.green}OK${c.reset}`, delay: 95 },
  { text: `${c.dim}[    0.923891] ${c.green}***${c.dim} Portfolio OS ready — welcome back.${c.reset}`, delay: 380 },
  { text: '', delay: 180 },
  { text: `${c.pink}  Welcome back.${c.reset}`, delay: 520 },
]

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

function rngLine(xs: readonly string[]): string {
  return xs[Math.floor(Math.random() * xs.length)]!
}

// ── TerminalApp ───────────────────────────────────────────────────────────────

export class TerminalApp {
  private xterm:     Terminal
  private fitAddon:  FitAddon
  private container: HTMLElement
  /** Footer mode line (doom/emacs-style); `#vim-mode-line` */
  private modeLine: HTMLElement | null
  private onOpenWindow: (spec: WindowSpec) => void

  private vim:          VimInput
  private vimEnabled  = true       // vim mode ON by default
  private history:      string[] = []
  private historyIndex = -1
  private isProcessing = false

  constructor(
    container:     HTMLElement,
    modeLine:      HTMLElement | null = null,
    onOpenWindow:  (spec: WindowSpec) => void = () => {},
  ) {
    this.container    = container
    this.modeLine     = modeLine
    this.onOpenWindow = onOpenWindow
    this.vim = new VimInput(mode => this.onModeChange(mode))

    this.xterm = new Terminal({
      theme: getActiveTerminalTheme(),
      fontFamily:       '"JetBrains Mono", monospace',
      fontSize:         15,
      lineHeight:       1.2,
      cursorBlink:      true,
      cursorStyle:      'bar',
      scrollback:       5000,
      allowProposedApi: true,
    })

    this.fitAddon = new FitAddon()
    this.xterm.loadAddon(this.fitAddon)
    this.xterm.loadAddon(new WebLinksAddon())
  }

  // ── public ──────────────────────────────────────────────────────────────────

  async mount(): Promise<void> {
    this.xterm.open(this.container)
    this.fitAddon.fit()
    window.addEventListener('resize', () => this.fitAddon.fit())
    this.xterm.onKey(({ domEvent }) => this.handleKey(domEvent))

    // Sync badge for initial vim-on state
    this.onModeChange('insert')

    await this.runBootSequence()
  }

  /** Called by Desktop when window tiles change size. */
  fit(): void {
    this.fitAddon.fit()
  }

  private refreshTerminalTheme(): void {
    this.xterm.options.theme = getActiveTerminalTheme()
  }

  private onModeChange(mode: VimMode): void {
    if (!this.vimEnabled) return
    if (this.modeLine) {
      const label = this.modeLine.querySelector('#vim-mode-text')
      if (label) label.textContent = mode.toUpperCase()
      this.modeLine.className = `vim-mode-line mode-${mode}`
    }
    this.xterm.options.cursorStyle = mode === 'insert' ? 'bar' : 'block'
  }

  // ── boot + banner ────────────────────────────────────────────────────────────

  private getPrompt(): string {
    const path = vfsPromptPath()
    return `${c.pink}mrgrey${c.reset}${c.dim}@${c.reset}${c.blue}dev${c.reset}${c.dim}:${path}$${c.reset} `
  }

  private async runBootSequence(): Promise<void> {
    this.isProcessing = true
    playOsSound('boot')

    for (const { text, delay } of BOOT_LINES) {
      this.xterm.writeln(text)
      await sleep(delay)
    }

    await sleep(700)
    this.xterm.clear()

    for (const line of BANNER) {
      await this.typewrite(line, 3)
      this.xterm.writeln('')
    }

    await sleep(200)
    this.xterm.writeln('')
    await this.typewrite(`  ${c.dim}type ${c.reset}${c.blue}help${c.reset}${c.dim} to get started.${c.reset}`, 22)
    this.xterm.writeln('')

    this.isProcessing = false
    this.prompt()
  }

  // ── rendering ────────────────────────────────────────────────────────────────

  private async typewrite(text: string, charDelay = 25): Promise<void> {
    let pos = 0
    while (pos < text.length) {
      const m = text.slice(pos).match(/^\x1b\[[0-9;]*m/)
      if (m) { this.xterm.write(m[0]); pos += m[0].length }
      else   { this.xterm.write(text[pos]); pos++; await sleep(charDelay) }
    }
  }

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

    this.isProcessing = true
    const [name, ...args] = raw.split(/\s+/)
    const cmd = commands[name]

    if (!cmd) {
      const keys = Object.keys(commands).filter(k => !commands[k].hidden)
      const cand = keys.find(k => k.startsWith(name))
      const suggest = cand ? ` ${c.dim}· did you mean ${c.blue}${cand}${c.reset}${c.dim}?${c.reset}` : ''
      this.writeln(
        `  ${c.red}command not found:${c.reset} ${name}` +
        `  ${c.dim}(try ${c.reset}${c.blue}help${c.reset}${c.dim})${c.reset}${suggest}`,
      )
    } else {
      if (cmd.loadMs) await this.showSpinner(name, cmd.loadMs)

      if (name === 'clear') {
        const sub = args[0]?.toLowerCase()
        if (sub === '--help' || sub === '-h') {
          this.writeln('')
          this.writeln(
            `  ${c.blue}clear${c.reset} ${c.dim}— blank scrollback; prompt stays thematic.${c.reset}`,
          )
          this.writeln(
            `  ${c.blue}clear --cow${c.reset} ${c.dim}— clear, then microscopic cow haiku.${c.reset}`,
          )
          this.writeln('')
        } else {
          this.xterm.clear()
          if (sub === '--cow') {
            this.writeln('')
            this.writeln(`  ${c.dim}< moo.${c.reset}`)
            this.writeln(`   ${c.dim}\\${c.green}‾${c.reset}${c.dim}—— now you see nothing.${c.reset}`)
            this.writeln('')
          }
        }
      } else if (name === 'retro') {
        const sub = args[0]?.toLowerCase()
        if (sub === 'status') {
          const on = getRetroFx()
          this.writeln(
            `  ${c.green}crt profile:${c.reset} ${on ? 'warped phosphor nostalgia' : 'flat modern cowardice'}`,
          )
          this.writeln(`  ${c.dim}${rngLine([
            'vignette strength: bureaucracy × 3',
            'grain budget: confiscated Super 8 crumbs',
            'scanline pitch: ethically questionable',
          ])}${c.reset}`)
        } else if (sub === '--help' || sub === '-h') {
          this.writeln('')
          this.writeln(
            `  ${c.blue}retro${c.reset}${c.dim} · ${c.blue}on${c.dim} │ ${c.blue}off${c.dim} │ bare word toggles · ${c.blue}status${c.reset}`,
          )
          this.writeln('')
        } else if (sub === 'on') setRetroFx(true)
        else if (sub === 'off') setRetroFx(false)
        else toggleRetroFx()
        if (!sub || sub === 'on' || sub === 'off' || (sub !== 'status' && sub !== '--help' && sub !== '-h')) {
          const on = getRetroFx()
          if (sub !== 'status' && sub !== '--help' && sub !== '-h') {
            this.writeln(
              on
                ? `  ${c.green}retro on${c.reset}  ${c.dim}(grain · scanlines · guilty nostalgia)${c.reset}`
                : `  ${c.dim}retro off — pixels unpunished.${c.reset}`,
            )
          }
        }
      } else if (name === 'matrix') {
        const api = getMatrixBgHandle()
        if (!api) {
          this.writeln(`  ${c.dim}matrix backdrop not wired in this route${c.reset}`)
        } else {
          const sub = args[0]?.toLowerCase()
          if (sub === 'status') {
            const on = api.isEnabled()
            this.writeln(
              `  ${c.green}matrix:${c.reset} ${on ? 'Glyphs falling — recruiter emails decoded as poetry.' : 'Idle — Wallpaper drinks tea.'}`,
            )
            if (on) {
              this.writeln(
                `  ${c.dim}throughput illusion: ~${rngLine(['9021', '1337', '4096'])} green chars / conceptual second${c.reset}`,
              )
            }
          } else if (sub === '--help' || sub === '-h') {
            this.writeln('')
            this.writeln(
              `  ${c.blue}matrix${c.reset}${c.dim} · ${c.blue}on${c.dim} │ ${c.blue}off${c.dim} │ ${c.blue}status${c.reset}`,
            )
            this.writeln('')
          } else if (sub === 'on') {
            api.setEnabled(true)
            this.writeln(`  ${c.green}matrix rain armed${c.reset}`)
          } else if (sub === 'off') {
            api.setEnabled(false)
            this.writeln(
              `  ${c.dim}matrix drizzle cancelled${c.reset}  ${c.dim}— gradient wallpaper only.${c.reset}`,
            )
          } else if (!api.isEnabled()) {
            this.writeln(
              `  ${c.dim}matrix idle — wake with ${c.blue}matrix on${c.reset}${c.dim} · ${c.blue}matrix status${c.reset}${c.dim} gossips.${c.reset}`,
            )
          } else {
            this.writeln(
              `  ${c.dim}usage:${c.reset} ${c.blue}matrix on${c.reset}${c.dim} │ ${c.reset}${c.blue}off${c.reset}${c.dim} │ ${c.reset}${c.blue}status${c.reset}`,
            )
          }
        }
      } else if (name === 'theme') {
        const raw = args[0]?.toLowerCase()
        const sub = raw?.replace(/_/g, '-')
        if (!sub || sub === 'current') {
          const p = getActivePack()
          this.writeln(
            `  ${c.green}theme:${c.reset} ${p.label} ${c.dim}(${getThemeId()})${c.reset}`,
          )
        } else if (sub === 'list') {
          this.writeln('')
          for (const { id, label } of listThemeSummaries()) {
            const mark = id === getThemeId() ? ` ${c.dim}←${c.reset}` : ''
            this.writeln(
              `  ${c.blue}${id.padEnd(14)}${c.reset} ${c.dim}${label}${c.reset}${mark}`,
            )
          }
          this.writeln('')
          this.writeln(
            `  ${c.dim}usage:${c.reset} ${c.blue}theme${c.reset} ${c.dim}<id>${c.reset} · ${c.blue}theme random${c.reset}`,
          )
        } else if (sub === 'random' || sub === 'shuffle') {
          const pool = listThemeSummaries().filter(t => t.id !== getThemeId())
          const pick = pool.length
            ? pool[Math.floor(Math.random() * pool.length)]!
            : listThemeSummaries()[0]!
          if (applyTheme(pick.id)) {
            this.refreshTerminalTheme()
            const p = getActivePack()
            this.writeln(
              `  ${c.green}theme roulette →${c.reset} ${p.label} ${c.dim}(${getThemeId()})${c.reset}`,
            )
          }
        } else if (sub && applyTheme(sub)) {
          this.refreshTerminalTheme()
          const p = getActivePack()
          this.writeln(
            `  ${c.green}theme applied:${c.reset} ${p.label} ${c.dim}(${getThemeId()})${c.reset}`,
          )
        } else {
          this.writeln(
            `  ${c.red}unknown theme:${c.reset} ${raw ?? ''}  ${c.dim}(theme list · theme random)${c.reset}`,
          )
        }
      } else if (name === 'sound') {
        const sub = args[0]?.toLowerCase()
        if (sub === 'status' || sub === '?') {
          const pct = Math.round(getSoundVolume() * 100)
          this.writeln(
            `  ${c.green}sound:${c.reset} ${isSoundEnabled() ? 'on (blessed)' : 'off (silent film mode)'}  ${c.dim}· panel volume ≈ ${pct}%${c.reset}`,
          )
        } else if (sub === '--help' || sub === '-h') {
          this.writeln('')
          this.writeln(
            `  ${c.blue}sound${c.reset}${c.dim} · ${c.blue}on${c.dim} │ ${c.blue}off${c.dim} │ bare ⇒ toggle · ${c.blue}status${c.reset}`,
          )
          this.writeln('')
        } else {
          if (sub === 'off') setSoundEnabled(false)
          else if (sub === 'on') setSoundEnabled(true)
          else toggleSound()
          await resumeAudioIfNeeded()
          syncSettingsSoundToggle()
          this.writeln(
            isSoundEnabled()
              ? `  ${c.green}UI sounds:${c.reset} audible · master ${Math.round(getSoundVolume() * 100)}%.`
              : `  ${c.dim}UI sounds muted — clock slider still adjusts gain.${c.reset}`,
          )
        }
      } else if (name === 'reboot') {
        const sub = args[0]?.toLowerCase()
        if (sub === '--dry-run' || sub === '-n') {
          const preview = BOOT_LINES.slice(0, 6)
          this.writeln('')
          for (const { text } of preview) this.writeln(text)
          this.writeln(`  ${c.yellow}^ dry-run — warm reboot skipped.${c.reset}`)
          this.writeln('')
        } else {
          this.history.push(raw)
          this.historyIndex = -1
          await this.runBootSequence()
          this.isProcessing = false
          return
        }
      } else if (WINDOW_COMMANDS.has(name)) {
        const ack = (): void => this.writeLines(windowSpawnEcho(name, args))

        if (OPEN_EDITOR_WINDOWS.has(name)) {
          const path = args[0] ?? 'welcome.txt'
          const heading = name === 'vim' ? 'vim' : name === 'editor' ? 'editor' : 'edit'
          this.onOpenWindow({
            command: 'edit',
            title: `${heading} — ${path}`,
            content: [],
            editorPath: path,
          })
          ack()
        } else if (name === 'explorer') {
          const pathArg = args[0] ? vfsNormalize(args[0]) : vfsPwd()
          this.onOpenWindow({
            command: 'explorer',
            title: 'files',
            content: [],
            explorerPath: pathArg,
          })
          ack()
        } else if (name === 'browse') {
          const rawUrl = args.join(' ').trim()
          const browserUrl = rawUrl ? normalizeBrowserUrl(rawUrl) : DEFAULT_BROWSER_URL
          this.onOpenWindow({
            command: 'browse',
            title: 'browse',
            content: [],
            browserUrl,
          })
          ack()
        } else {
          const content = cmd.run(args)
          this.onOpenWindow({ command: name, title: name, content })
          ack()
        }
        playOsSound('click')
      } else {
        this.writeLines(cmd.run(args))
      }

      this.history.push(raw)
      this.historyIndex = -1
    }

    this.isProcessing = false
    this.prompt()
  }
}
