/**
 * Boot splash: ASCII logo + dmesg-style line reveal on first visit.
 * Gated by localStorage["mrgrey-boot-seen"]. Replayed by `cookies clear`.
 */

export type BootLineKind = 'info' | 'ok' | 'warn' | 'err'

export interface BootLine {
  ts: string
  kind: BootLineKind
  text: string
  section?: string
}

export const BOOT_LINES: BootLine[] = [
  { ts: '0.001', kind: 'info', text: 'mrgrey.site portfolio kernel v1.0 (build 2026.05.16)' },

  { ts: '0.071', kind: 'ok',   text: 'web-fonts: JetBrains Mono loaded',              section: 'graphics' },
  { ts: '0.142', kind: 'ok',   text: 'theme: catppuccin-mocha applied',               section: 'graphics' },
  { ts: '0.198', kind: 'ok',   text: 'ansi parser ready (16 colors + bright + 256)',  section: 'graphics' },
  { ts: '0.221', kind: 'ok',   text: 'retro-fx: scanlines primed',                    section: 'graphics' },
  { ts: '0.267', kind: 'ok',   text: 'matrix-bg: animator armed',                     section: 'graphics' },

  { ts: '0.298', kind: 'ok',   text: 'vfs: 17 entries mounted from localStorage',    section: 'filesystem' },
  { ts: '0.341', kind: 'ok',   text: 'cookies: 4 namespaces registered',             section: 'filesystem' },

  { ts: '0.401', kind: 'ok',   text: 'desktop tiling engine: ready',                 section: 'window manager' },
  { ts: '0.452', kind: 'ok',   text: 'window-chrome factory loaded',                 section: 'window manager' },
  { ts: '0.487', kind: 'ok',   text: 'splitter: drag handles armed',                 section: 'window manager' },
  { ts: '0.523', kind: 'ok',   text: 'launcher catalog: 13 apps registered',         section: 'window manager' },
  { ts: '0.567', kind: 'ok',   text: 'dock: always-visible, taskbar mounted',        section: 'window manager' },

  { ts: '0.612', kind: 'ok',   text: 'keybinds: 22 chords wired',                    section: 'input' },
  { ts: '0.634', kind: 'ok',   text: 'vim line editor: insert/normal/visual',        section: 'input' },

  { ts: '0.679', kind: 'ok',   text: 'cube.ko: loaded, rubik solver ready',          section: 'apps' },
  { ts: '0.701', kind: 'ok',   text: 'p5.ko: loaded, canvas runtime ready',         section: 'apps' },
  { ts: '0.745', kind: 'ok',   text: 'xterm-emulator: suspended (app-mode)',         section: 'apps' },

  { ts: '0.812', kind: 'ok',   text: 'sound subsystem armed (web-audio)',            section: 'system services' },
  { ts: '0.867', kind: 'ok',   text: 'systray + toasts initialized',                 section: 'system services' },
  { ts: '0.912', kind: 'ok',   text: 'hint manager: 4 first-visit bubbles queued',   section: 'system services' },
  { ts: '0.978', kind: 'ok',   text: 'toast cascade: 4 messages scheduled',         section: 'system services' },

  { ts: '1.103', kind: 'info', text: 'all subsystems green' },
  { ts: '1.247', kind: 'info', text: 'handing off to desktop' },
]

export const ASCII_LOGO =
  `                                                 _ _\n` +
  ` _ __ ___  _ __ __ _ _ __ ___ _   _   ___(_) |_ ___\n` +
  `| '_ \` _ \\| '__/ _\` | '__/ _ \\ | | | / __| | __/ _ \\\n` +
  `| | | | | | | | (_| | | |  __/ |_| |_\\__ \\ | ||  __/\n` +
  `|_| |_| |_|_|  \\__, |_|  \\___|\\__, (_)___/_|\\__\\___|  \n` +
  `               |___/          |___/                  `

function labelFor(kind: BootLineKind): string {
  if (kind === 'ok')   return '  OK'
  if (kind === 'warn') return 'WARN'
  if (kind === 'err')  return 'FAIL'
  return 'init'
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Build DOM rows for each boot line plus section dividers. */
export function buildBootLines(): HTMLElement[] {
  const out: HTMLElement[] = []
  let lastSection: string | undefined
  for (const line of BOOT_LINES) {
    if (line.section && line.section !== lastSection) {
      const sec = document.createElement('div')
      sec.className = 'boot-section'
      sec.textContent = `— ${line.section}`
      out.push(sec)
      lastSection = line.section
    }
    const row = document.createElement('div')
    row.className = 'boot-line'
    row.innerHTML =
      `<span class="boot-ts">[${line.ts}]</span> ` +
      `<span class="boot-${line.kind}">${labelFor(line.kind)}</span> ` +
      escapeHtml(line.text)
    out.push(row)
  }
  return out
}

// ─── mount + animate ──────────────────────────────────────────────────────────

const STORAGE_KEY = 'mrgrey-boot-seen'

export interface BootSplashOptions {
  /** Reveal interval per line, ms. Default 180. */
  lineInterval?: number
  /** Hold-time after final line before fade, ms. Default 700. */
  holdMs?: number
  /** Fade duration, ms. Default 320. */
  fadeMs?: number
}

/** Render the splash, animate, resolve when fully dismissed. Skips on return visits. */
export async function runBootSplash(opts: BootSplashOptions = {}): Promise<void> {
  if (window.localStorage.getItem(STORAGE_KEY) === '1') return

  // Explicitly load the exact JetBrains Mono variant used by the logo so the
  // ASCII art aligns correctly before we build the DOM. document.fonts.load() is
  // more targeted than fonts.ready and resolves as soon as that specific face is
  // available. Both calls are optional-chained for test/SSR safety.
  if (document.fonts?.load) {
    try { await document.fonts.load('400 1em "JetBrains Mono"') } catch { /* use fallback */ }
  }

  const lineInterval = opts.lineInterval ?? 180
  const holdMs       = opts.holdMs       ?? 700
  const fadeMs       = opts.fadeMs       ?? 320

  const root = document.createElement('div')
  root.className = 'boot-splash'

  const body = document.createElement('div')
  body.className = 'boot-body'

  const logo = document.createElement('pre')
  logo.className = 'boot-logo'
  logo.textContent = ASCII_LOGO
  body.appendChild(logo)

  const sub = document.createElement('div')
  sub.className = 'boot-logo-sub'
  sub.textContent = '~ booting portfolio OS ~'
  body.appendChild(sub)

  const rows = buildBootLines()
  for (const r of rows) body.appendChild(r)

  const footer = document.createElement('div')
  footer.className = 'boot-footer'
  footer.innerHTML =
    `<span class="boot-footer-welcome">welcome.</span>` +
    `<span class="boot-footer-hint">run <b>cookies clear</b> in the terminal to replay this boot</span>`

  root.appendChild(body)
  root.appendChild(footer)
  document.body.appendChild(root)

  // Reveal lines sequentially
  for (let i = 0; i < rows.length; i++) {
    await wait(lineInterval)
    rows[i].classList.add('boot-line--in')
    body.scrollTop = body.scrollHeight
  }
  footer.classList.add('boot-footer--in')

  await wait(holdMs)
  root.classList.add('boot-splash--out')
  await wait(fadeMs)
  root.remove()

  window.localStorage.setItem(STORAGE_KEY, '1')
}

function wait(ms: number): Promise<void> {
  return new Promise(r => window.setTimeout(r, ms))
}
