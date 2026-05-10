/** My CLI table: `{ description, run(args) -> lines }`; I handle a few specials in `terminal.ts` instead. */
import { c, getThemeId } from '../theme'
import { WHOAMI_ART } from '../ascii'
import {
  contactLines,
  linksLines,
  projectsLines,
  resumeLines,
  skillsLines,
  whoamiFooterLines,
} from '../content/portfolio'
import {
  vfsPwd,
  vfsLs,
  vfsLsLong,
  vfsCd,
  vfsCat,
  vfsTouch,
  vfsMkdir,
  vfsRm,
  vfsReset,
  vfsReloadFromStorage,
  vfsNormalize,
  vfsPersistedFootprint,
  vfsFormatPath,
  vfsOldPwdFormatted,
  FS_HOME,
  type VfsLongEntry,
} from '../os-fs'
import { getDesktopRef } from '../os-registry'
import { runApt } from '../os-apt'
import { cowsayFormat } from '../os-packages'
import { pushToast } from '../os-systray'
import { playOsSound } from '../os-sound'

export interface Command {
  description: string
  hidden?: boolean
  loadMs?: number
  run: (args: string[]) => string[]
}

// ── helpers ───────────────────────────────────────────────────────────────────

function bar(pct: number, width = 18): string {
  const filled = Math.round((pct / 100) * width)
  const empty  = width - filled
  return (
    `${c.pink}${'█'.repeat(filled)}${c.reset}` +
    `${c.dim}${'░'.repeat(empty)}${c.reset}`
  )
}

function skill(label: string, pct: number, labelWidth: number): string {
  return (
    `  ${c.blue}${label.padEnd(labelWidth)}${c.reset}` +
    `${bar(pct)}  ` +
    `${c.dim}${String(pct).padStart(3)}%${c.reset}`
  )
}

function section(title: string): string {
  return `  ${c.pink}${title}${c.reset}  ${c.dim}${'─'.repeat(Math.max(0, 44 - title.length))}${c.reset}`
}

function pick<T>(xs: readonly T[]): T {
  return xs[Math.floor(Math.random() * xs.length)]!
}

/** One-liners for `echo --fortune` — hiring-adjacent, browser-OS flavored. */
const CLI_FORTUNES: readonly string[] = [
  'Your kernel is vibes; your scheduler is ADHD.',
  'Ship the demo. Complain about hydration in retrospective.',
  'localStorage persists more loyalty than half the recruiters in your inbox.',
  'Tabs are spaces that learned boundaries.',
  'This terminal is Turing-complete for procrastination.',
  'If it works on Chrome and vibes on Firefox, you have a product.',
  'The cloud is someone else\'s sticker-covered laptop lid.',
  'Ctrl+D closes nothing here — mastery is knowing when not to rage-quit.',
  'Good docs are UX for your future sleepy self.',
  'You do not chmod dream jobs; you open a DM and attach a concise diff.',
  'WASM wishes it had your CSS grid instincts.',
  'Every portfolio is fanfiction until someone pays for the paperback.',
  '`git blame` rarely points where you emotionally want it to.',
  'Hydrated React trees still need coffee—water is insufficient.',
  'Tab-completion is unconditional love.',
  '"Works on my machine" is a threat model admission.',
]

const HOSTNAME_FLAVOR: readonly string[] = [
  'resolves to courage, not an A record',
  'this host has never been racked — it scrolled into existence',
  'TLD rumor: `.dev` means "determined eccentric vibe-coder"',
  'uptime impeccable; spine status: consult HR',
]

function fmtHumanBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1048576) return `${(n / 1024).toFixed(n % 1024 === 0 ? 0 : 1)} KiB`
  return `${(n / 1048576).toFixed(1)} MiB`
}

function wcStats(s: string): { lines: number; words: number; chars: number } {
  const lines = s === '' ? 0 : s.split('\n').length
  const words = s.trim() ? s.trim().split(/\s+/).length : 0
  const chars = new TextEncoder().encode(s).length
  return { lines, words, chars }
}

function runUnixDate(): string[] {
  const d = new Date()
  return [
    '',
    `  ${d.toLocaleString(undefined, { weekday: 'long', dateStyle: 'full', timeStyle: 'medium' })}`,
    `  ${c.dim}epoch ms ${Date.now()} · UTC offset ${-d.getTimezoneOffset()} min${c.reset}`,
    '',
  ]
}

function runFakeUptime(): string[] {
  const t0 = typeof performance !== 'undefined' ? performance.timeOrigin : Date.now()
  const up = Math.max(0, Math.floor((Date.now() - t0) / 1000))
  const d = Math.floor(up / 86400)
  const h = Math.floor((up % 86400) / 3600)
  const m = Math.floor((up % 3600) / 60)
  return [
    '',
    `  ${c.green}up${c.reset} ${d}d ${h}h ${m}m ${c.dim}· SPA session lore (reload resets) — not Metal uptime${c.reset}`,
    '',
  ]
}

function runCalAscii(args: string[]): string[] {
  const now = new Date()
  let y = now.getFullYear()
  let mon = now.getMonth()
  if (args[0]) {
    const n = Number.parseInt(args[0], 10)
    if (!Number.isNaN(n) && n >= 1 && n <= 12) mon = n - 1
  }
  if (args[1]) {
    const n = Number.parseInt(args[1], 10)
    if (!Number.isNaN(n) && n >= 1970 && n <= 2100) y = n
  }
  const first = new Date(y, mon, 1)
  const label = first.toLocaleString('en-US', { month: 'long', year: 'numeric' })
  const pad = first.getDay()
  const lastDay = new Date(y, mon + 1, 0).getDate()
  const cells: string[] = []
  for (let i = 0; i < pad; i++) cells.push('  ')
  for (let day = 1; day <= lastDay; day++) {
    const mark = day === now.getDate() && mon === now.getMonth() && y === now.getFullYear()
    const s = String(day).padStart(2, ' ')
    cells.push(mark ? `${c.green}${s}${c.reset}` : s)
  }
  const lines: string[] = ['', `  ${c.pink}${label}${c.reset}`, '  Su Mo Tu We Th Fr Sa']
  for (let r = 0; r < cells.length; r += 7) {
    lines.push('  ' + cells.slice(r, r + 7).join(' '))
  }
  lines.push(`  ${c.dim}cal [month] [year] — fake wall calendar${c.reset}`, '')
  return lines
}

function parseHeadTail(
  mode: 'head' | 'tail',
  args: string[],
): { n: number; path: string | null; err: string | null } {
  let n = 10
  const rest: string[] = []
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if ((a === '-n' || a === '--lines') && args[i + 1]) {
      const v = Number.parseInt(args[i + 1], 10)
      if (!Number.isNaN(v) && v >= 0) n = v
      i++
      continue
    }
    rest.push(a)
  }
  if (!rest[0]) return { n, path: null, err: `usage: ${mode} [-n N] <path>` }
  return { n, path: rest[0], err: null }
}

/** Grouped keys for `help` — order is intentional; every visible command should appear once. */
const HELP_GROUPS: ReadonlyArray<{ title: string; keys: readonly string[] }> = [
  {
    title: 'Desktop & windows',
    keys: [
      'links',
      'skills',
      'projects',
      'resume',
      'contact',
      'explorer',
      'browse',
      'edit',
      'editor',
      'vim',
      'paint',
      'cube',
      'snake',
      'pong',
    ],
  },
  {
    title: 'Filesystem',
    keys: ['pwd', 'ls', 'cd', 'cat', 'touch', 'mkdir', 'rm', 'wc', 'head', 'tail'],
  },
  {
    title: 'Shell & session',
    keys: ['help', 'cookies', 'clear', 'echo', 'reboot', 'ps', 'date', 'uptime', 'cal'],
  },
  {
    title: 'Look, sound & effects',
    keys: ['theme', 'retro', 'matrix', 'sound'],
  },
  {
    title: 'Desktop helpers',
    keys: ['notify', 'apt', 'cowsay'],
  },
  {
    title: 'Session info',
    keys: ['whoami', 'uname', 'hostname'],
  },
]

function runHelp(): string[] {
  const visible = Object.entries(commands).filter(([, v]) => !v.hidden)
  const nameWidth = Math.max(...visible.map(([n]) => n.length), 10)
  const groupedKeys = new Set<string>()
  for (const g of HELP_GROUPS) {
    for (const k of g.keys) groupedKeys.add(k)
  }

  const lines: string[] = ['']

  lines.push(
    `  ${c.pink}Portfolio OS${c.reset}  ${c.dim}— tiling desktop in the browser: real terminal, draggable splits, launcher & status bar.${c.reset}`,
  )
  lines.push(
    `  ${c.dim}Window apps open as tiles on the right; shell commands print here. Arguments go after the command name.${c.reset}`,
  )
  lines.push('')
  lines.push(
    `  ${c.dim}Shortcuts:${c.reset}  ${c.blue}Ctrl+T${c.reset}${c.dim} · terminal${c.reset}   ${c.blue}Ctrl+1–9${c.reset}${c.dim} · dock${c.reset}   ${c.blue}Ctrl+D${c.reset}${c.dim} · desktop / launcher${c.reset}`,
  )
  lines.push(
    `             ${c.blue}Ctrl+H / L${c.reset}${c.dim} · focus panes${c.reset}   ${c.blue}Ctrl+Q / M / F${c.reset}${c.dim} · close · minimize · maximize${c.reset}`,
  )
  lines.push('')

  for (const { title, keys } of HELP_GROUPS) {
    lines.push(section(title))
    lines.push('')
    for (const key of keys) {
      const cmd = commands[key]
      if (!cmd || cmd.hidden) continue
      lines.push(
        `  ${c.blue}${key.padEnd(nameWidth)}${c.reset}   ${c.dim}${cmd.description}${c.reset}`,
      )
    }
    lines.push('')
  }

  const orphans = visible
    .filter(([name]) => !groupedKeys.has(name))
    .sort(([a], [b]) => a.localeCompare(b))
  if (orphans.length > 0) {
    lines.push(section('Other'))
    lines.push('')
    for (const [name, cmd] of orphans) {
      lines.push(
        `  ${c.blue}${name.padEnd(nameWidth)}${c.reset}   ${c.dim}${cmd.description}${c.reset}`,
      )
    }
    lines.push('')
  }

  lines.push(
    `  ${c.dim}Tip:${c.reset} ${c.blue}theme random${c.reset}${c.dim} · ${c.reset}${c.blue}reboot --dry-run${c.reset}${c.dim} · ${c.reset}${c.blue}cd -${c.reset}${c.dim} · ${c.reset}${c.blue}cal${c.reset}${c.dim} · ${c.reset}${c.blue}wc welcome.txt${c.reset}`,
  )
  lines.push('')

  return lines
}

// ── commands ──────────────────────────────────────────────────────────────────

export const commands: Record<string, Command> = {

  help: {
    description: 'Full command catalog — grouped by desktop, FS, shell, themes, packages',
    run: runHelp,
  },

  links: {
    description: 'Tiled window: site, GitHub, email — plus how to open Browse',
    loadMs: 400,
    run: () => linksLines(),
  },

  skills: {
    description: 'Languages and tools with level-style bars',
    loadMs: 800,
    run: () => skillsLines(section, skill),
  },

  resume: {
    description:
      'Résumé tile — optional /portrait.jpg beside text (drop file in site public root)',
    loadMs: 800,
    run: () => resumeLines(),
  },

  projects: {
    description:
      'Shipped work + placeholder cards for future repos and live demos (structured list)',
    loadMs: 800,
    run: () => projectsLines(),
  },

  contact: {
    description: 'Email, phone, GitHub — async-first; résumé PDF by request',
    run: () => contactLines(),
  },

  edit: {
    description:
      'Mini-vim buffer on the virtual FS — edit [path] (default welcome.txt); :wq · hjkl · wb',
    run: () => [],
  },

  editor: {
    description:
      'Editor tile — editor [path] opens the same mini-vim buffer as edit (default welcome.txt)',
    run: () => [],
  },

  explorer: {
    description:
      'File browser — explorer [path]; Rename, Cut/Copy/Paste, Delete; F2 / Ctrl+V',
    run: () => [],
  },

  browse: {
    description:
      'Iframe browser tile — browse [url]; many sites block embeds (use Open tab when blank)',
    run: () => [],
  },

  paint: {
    description: 'Paint — brush, eraser, line, fill; [ ] adjust brush size when canvas focused',
    run: () => [],
  },

  cube: {
    description:
      '3×3 cube — face keys UDLRFB + Shift prime, Space scramble, drag to orbit, on-screen moves',
    run: () => [],
  },

  snake: {
    description: 'Snake — WASD / arrows; rounded cells; Space restarts after game over',
    run: () => [],
  },

  pong: {
    description: 'Pong — W/S vs AI or two-player W/S vs ↑↓; goals reset the ball',
    run: () => [],
  },

  cookies: {
    description:
      'Fake home FS · cookies reload | clear | stats (themes/sound/apt use separate keys)',
    run: args => {
      const sub = args[0]?.toLowerCase()
      if (sub === 'clear') {
        vfsReset()
        return [
          `  ${c.green}Virtual home cleared.${c.reset}  ${c.dim}Factory default tree written to storage.${c.reset}`,
          `  ${c.dim}Theme, CRT, matrix, apt package markers, etc. unchanged.${c.reset}`,
        ]
      }
      if (sub === 'reload') {
        const note = vfsReloadFromStorage()
        return [
          `  ${c.green}Reloaded from browser storage.${c.reset}`,
          ...(note ? [`  ${c.dim}${note}${c.reset}`] : []),
        ]
      }
      if (sub === 'stats' || sub === 'df') {
        const { files, dirs, jsonBytes } = vfsPersistedFootprint()
        const cwdPretty = vfsFormatPath(vfsPwd())
        const kb = (jsonBytes / 1024).toFixed(jsonBytes >= 1024 ? 2 : 3)
        return [
          '',
          `  ${c.pink}virtual disk${c.reset}  ${c.dim}(serialized state blob)${c.reset}`,
          `  ${c.dim}cwd${c.reset}           ${cwdPretty}`,
          `  ${c.dim}files / dirs${c.reset}    ${files} / ${dirs}`,
          `  ${c.dim}~bytes on wire${c.reset} ~${jsonBytes} (${kb} KiB-ish, UTF-8 counted)`,
          '',
        ]
      }
      return [
        `  ${c.dim}The home directory is a fake VFS; files live in ${c.blue}localStorage${c.reset}${c.dim}.${c.reset}`,
        `  ${c.blue}cookies stats${c.reset}  ${c.dim}— file/dir counts + approx JSON footprint${c.reset}`,
        `  ${c.blue}cookies reload${c.reset} ${c.dim}— re-read disk from storage (drops unsaved drift)${c.reset}`,
        `  ${c.blue}cookies clear${c.reset}  ${c.dim}— wipe FS + restore welcome notes (themes untouched)${c.reset}`,
      ]
    },
  },

  whoami: {
    description: 'ASCII banner + byline · whoami -a adds theme / wm / fake neofetch rows',
    run: args => {
      const core = ['', ...WHOAMI_ART, '', ...whoamiFooterLines()]
      const ex = args[0]?.toLowerCase()
      if (ex !== '-a' && ex !== '--all') return core
      const ua =
        typeof navigator !== 'undefined' && navigator.userAgent
          ? navigator.userAgent.slice(0, 72) + (navigator.userAgent.length > 72 ? '…' : '')
          : '(headless-ish)'
      const lf = (k: string, v: string): string =>
        `  ${c.pink}${k.padEnd(9)}${c.reset}${c.dim}… ${c.reset}${v}`
      return [
        ...core,
        '',
        section('session'),
        lf('hostname', 'mrgrey.dev'),
        lf('theme', `${getThemeId()}`),
        lf('cwd', vfsFormatPath(vfsPwd())),
        lf('_wm', 'tiling Portfolio desktop'),
        lf('runtime', 'xterm shell in-browser'),
        lf('ua', `${c.dim}${ua}${c.reset}`),
        '',
      ]
    },
  },

  vim: {
    description:
      'Editor tile — vim [path] opens same mini-vim buffer as edit (default welcome.txt)',
    run: () => [],   // handled directly in terminal.ts
  },

  retro: {
    description:
      'CRT shader — retro · on | off | status | --help · bare word toggles scanlines',
    run: () => [],   // handled directly in terminal.ts
  },

  matrix: {
    description:
      'Matrix rain — matrix on | off | status | --help · clock menu also drives it',
    run: () => [],   // handled directly in terminal.ts
  },

  theme: {
    description:
      'Catppuccin packs — theme · list · random · current · <id> paints UI + terminal',
    run: () => [],   // handled directly in terminal.ts
  },

  sound: {
    description:
      'UI bleeps — sound on | off · status | ? · bare word toggles · volume in clock menu',
    run: () => [],   // terminal.ts
  },

  reboot: {
    description:
      'Kernel cosplay — full reboot replays boot art; reboot --dry-run prints log sampler',
    run: () => [],   // terminal.ts
  },

  pwd: {
    description:
      'Print cwd + OLDPWD when set · pwd -P/-L pedantry about symlinks that do not exist',
    run: args => {
      const cwd = vfsPwd()
      const hint =
        cwd === FS_HOME ? 'cwd resolves to fake home (~)' : 'cwd sits under ~/ …'
      const lines: string[] = [
        '',
        `  ${c.green}${cwd}${c.reset}`,
        `  ${c.dim}${hint}.${c.reset}`,
      ]
      const oldp = vfsOldPwdFormatted()
      if (oldp) lines.push(`  ${c.dim}OLDPWD ${c.reset}${c.yellow}${oldp}${c.reset}`)
      const o = args[0]
      if (o === '-P') {
        lines.push(
          `  ${c.dim}-P:${c.reset} physical path identical — ${c.yellow}no symlinks in this FS${c.reset}${c.dim}.${c.reset}`,
        )
      } else if (o === '-L') {
        lines.push(`  ${c.dim}-L:${c.reset} logical path (${c.bold}same string${c.reset}${c.dim} here — default).${c.reset}`)
      } else if (o && !o.startsWith('-')) {
        lines.push(`  ${c.dim}(ignoring stray ${JSON.stringify(o)} — try ${c.blue}-P${c.dim} · ${c.blue}-L${c.dim})${c.reset}`)
      }
      lines.push(`  ${c.dim}Paths persist via localStorage in this browser profile.${c.reset}`, '')
      return lines
    },
  },

  ls: {
    description:
      'List directory — ls -a . .. · ls -l long mode · -h human sizes (with -l)',
    run: args => {
      let showAll = false
      let long = false
      let human = false
      const pathChunks: string[] = []
      for (const a of args) {
        if (a === '-a' || a === '-A') showAll = true
        else if (a === '-l') long = true
        else if (a === '-h' || a === '--human-readable') human = true
        else if (!a.startsWith('-')) pathChunks.push(a)
      }
      const target = pathChunks.join(' ')
      if (long) {
        const rows = vfsLsLong(target || undefined, { all: showAll })
        if (rows.length >= 1 && typeof rows[0] === 'string' && rows[0].startsWith('ls:'))
          return [`  ${rows[0]}`]
        const data = rows as VfsLongEntry[]
        const szW = human
          ? Math.max(4, ...data.map(r => fmtHumanBytes(r.size).length))
          : Math.max(4, ...data.map(r => String(r.size).length))
        const out: string[] = ['']
        for (const r of data) {
          const szDisp = human
            ? fmtHumanBytes(r.size).padStart(szW)
            : String(r.size).padStart(szW)
          out.push(
            `  ${r.mode} ${r.nlink} ${c.dim}mrgrey mrgrey${c.reset} ${szDisp} ${r.mon} ${r.day} ${r.hhmm} ${r.name}`,
          )
        }
        out.push('')
        return out
      }

      const lines = vfsLs(target || undefined, { all: showAll })
      if (lines.length === 1 && lines[0].startsWith('ls:')) return [`  ${lines[0]}`]
      if (lines.length === 0)
        return ['', `  ${c.dim}(empty directory)${c.reset}`, '']
      return [
        '',
        ...lines.map(n =>
          `  ${n === '.' || n === '..' ? `${c.dim}${n}${c.reset}` : n}`,
        ),
        '',
      ]
    },
  },

  cd: {
    description: 'Change cwd — naked cd ~ home · cd - jumps OLDPWD POSIX cosplay',
    run: args => {
      const res = vfsCd(args[0] ?? '')
      if (!res.ok) return [`  ${res.msg}`]
      const lines: string[] = []
      if (res.jumpedFromDash) lines.push(`  ${c.dim}-${c.reset} ${c.green}${res.jumpedFromDash}${c.reset}`)
      lines.push(`  ${c.dim}-> ${vfsFormatPath(vfsPwd())}${c.reset}`)
      return lines
    },
  },

  cat: {
    description: 'Print file contents · cat -n prefixes line numbers · two-space gutter',
    run: args => {
      let numbering = false
      const paths: string[] = []
      for (const a of args) {
        if (a === '-n') numbering = true
        else paths.push(a)
      }
      if (!paths[0]) return [`  ${c.red}usage:${c.reset} cat [-n] <path>`]
      const out = vfsCat(paths[0])
      if (out == null || out.startsWith('cat:')) return [`  ${out ?? 'cat: I/O error'}`]
      const rows = out.split('\n')
      if (rows.length === 0) return [`  ${c.dim}(empty file)${c.reset}`]
      if (!numbering) return rows.map(line => `  ${line}`)
      const w = String(rows.length).length
      return rows.map((line, i) => `  ${c.dim}${String(i + 1).padStart(w)}${c.reset} │ ${line}`)
    },
  },

  touch: {
    description: 'Create empty file (relative to cwd unless path is absolute)',
    run: (args) => {
      if (!args[0]) return [`  ${c.red}usage:${c.reset} touch <path>`]
      const err = vfsTouch(args[0])
      if (err) return [`  ${err}`]
      playOsSound('click')
      return [`  ${c.green}ok${c.reset} ${c.dim}${vfsNormalize(args[0])}${c.reset}`, `  ${c.dim}(inode minted in localStorage lore)${c.reset}`]
    },
  },

  mkdir: {
    description: 'Create directory — parent folder must already exist',
    run: (args) => {
      if (!args[0]) return [`  ${c.red}usage:${c.reset} mkdir <path>`]
      const err = vfsMkdir(args[0])
      if (err) return [`  ${err}`]
      playOsSound('click')
      return [`  ${c.green}ok${c.reset} ${c.dim}${vfsNormalize(args[0])}${c.reset}`, `  ${c.dim}(tree node — not yet a startup)${c.reset}`]
    },
  },

  rm: {
    description: 'Remove file or empty directory tree node',
    run: (args) => {
      if (!args[0]) return [`  ${c.red}usage:${c.reset} rm <path>`]
      const err = vfsRm(args[0])
      if (err) return [`  ${err}`]
      playOsSound('click')
      return [`  ${c.dim}removed${c.reset} ${vfsNormalize(args[0])}`, `  ${c.dim}(trash-cli not installed — this is final)${c.reset}`]
    },
  },

  ps: {
    description:
      'Fake ps for WM tiles · plain ps compact · ps -f · ps aux widen columns + USER fakeout',
    run: args => {
      const rows = getDesktopRef()?.getPsSnapshot() ?? []
      const verbose =
        args.includes('-f') ||
        args.includes('aux') ||
        args.includes('-ef') ||
        args.includes('-l')

      const padStart = (s: string, w: number) =>
        s.length >= w ? s : ' '.repeat(w - s.length) + s
      const padEnd = (s: string, w: number) =>
        s.length >= w ? s : s + ' '.repeat(w - s.length)

      const pidW = 5
      const ttyW = 7
      const statW = 5
      const timeW = 5

      let header: string
      let body: string[]
      if (verbose) {
        const userW = 8
        const ppidW = 5
        header =
          `  ${padEnd('USER', userW)} ${padStart('PID', pidW)} ${padStart('PPID', ppidW)} ` +
          `${padEnd('TTY', ttyW)} ${padEnd('STAT', statW)} ${padEnd('TIME', timeW)} CMD`
        body = rows.map((r, idx) =>
          `${padEnd('mrgrey', userW)} ${padStart(String(r.pid), pidW)} ${padStart(String(1 + (idx % 3)), ppidW)} ` +
          `${padEnd(r.tty, ttyW)} ${padEnd(r.stat, statW)} ${padEnd(r.time, timeW)} ${r.cmd}`,
        ).map(row => `  ${row}`)
      } else {
        header =
          `  ${padStart('PID', pidW)} ${padEnd('TTY', ttyW)} ${padEnd('STAT', statW)} ${padEnd('TIME', timeW)} CMD`
        body = rows.map(
          r =>
            `  ${padStart(String(r.pid), pidW)} ${padEnd(r.tty, ttyW)} ${padEnd(r.stat, statW)} ${padEnd(r.time, timeW)} ${r.cmd}`,
        )
      }
      return ['', header, ...body, `  ${c.dim}(window-manager view · not kernel procfs)${c.reset}`, '']
    },
  },

  apt: {
    description:
      'Toy Debian cosplay · apt install cowsay persists · apt search hunts fake repos',
    run: (args) => runApt(args),
  },

  cowsay: {
    description: 'ASCII cow bubble — cowsay hello (no apt gate)',
    run: (args) => {
      const msg = args.join(' ')
      return ['', ...cowsayFormat(msg || ' ').map(line => `  ${line}`), '']
    },
  },

  notify: {
    description:
      'Systray toast · notify msg · notify -t_ms_ -w|--warn urgency banner before text',
    run: args => {
      let duration = 4200
      let extraClass: string | undefined
      let i = 0
      while (i < args.length) {
        const a = args[i]
        if ((a === '-t' || a === '--time') && args[i + 1]) {
          const n = Number.parseInt(args[i + 1], 10)
          if (!Number.isNaN(n)) duration = Math.min(22000, Math.max(900, n))
          i += 2
          continue
        }
        if (a === '-w' || a === '--warn') {
          extraClass = 'toast--warn'
          i += 1
          continue
        }
        break
      }
      const text = args.slice(i).join(' ') || 'Notification'
      pushToast(text, duration, extraClass)
      const flags = `${duration !== 4200 ? `${c.blue}-t ${duration}${c.reset} ` : ''}${extraClass ? `${c.yellow}[warn styling]${c.reset} ` : ''}`
      return [
        `  ${c.green}toast:${c.reset} ${text}`,
        ...(flags.trim()
          ? [`  ${c.dim}queued ${flags.trim()} beside the clock${c.reset}`]
          : [`  ${c.dim}(beside clock — backdrop click dismisses floating menus.)${c.reset}`]),
      ]
    },
  },

  uname: {
    description: 'System label for this SPA — optional flags: -a -s -n -r -v -m -o',
    run: (args) => {
      const f = args[0]
      const y = new Date().getFullYear()
      if (!f) return [`  PortfolioOS`]

      switch (f) {
        case '-a':
          return [
            `  PortfolioOS mrgrey.dev 1.${y}-vite-no-kernel #1 SMP TAB_SPIRIT_DYNAMIC`,
            `  browser_${typeof navigator !== 'undefined' ? 'host' : 'headless'} amd64-ish UI_ON_GLOW`,
          ]
        case '-s':
          return [`  PortfolioOS`]
        case '-n':
        case '--nodename':
          return [`  mrgrey.dev`]
        case '-r':
          return [`  1.${y}-static-spa-hotreload`]
        case '-v':
          return [`  #BUILD_INFO: compiled with npm scripts and stubborn optimism`]
        case '-m':
          return [`  wasm-adjacent (JIT hugs included; fans optional)`]
        case '-o':
          return [`  GNU/not-linux-but-go-with-it`]
        case '--help':
        case '-h':
          return [
            `  ${c.dim}${c.bold}uname${c.reset}${c.dim} flags:${c.reset}`,
            `  ${c.blue}-s${c.reset}${c.dim} kernel name   ${c.blue}-r${c.reset}${c.dim} release   ${c.blue}-v${c.reset}${c.dim} version string${c.reset}`,
            `  ${c.blue}-n${c.reset}${c.dim} hostname     ${c.blue}-m${c.reset}${c.dim} machine   ${c.blue}-o${c.reset}${c.dim} OS`,
            `  ${c.blue}-a${c.reset}${c.dim} print all-of-the-above-ish${c.reset}`,
          ]
        default:
          return [
            `  ${c.red}uname:${c.reset} unknown flag ${f} ${c.dim}(${c.blue}uname --help${c.dim})${c.reset}`,
          ]
      }
    },
  },

  hostname: {
    description:
      'Print hostname — second line rotates a pointless datacenter rumor (RNG flavor)',
    run: () => [
      '',
      `  ${c.green}mrgrey.dev${c.reset}`,
      `  ${c.dim}(${pick(HOSTNAME_FLAVOR)})${c.reset}`,
      '',
    ],
  },

  clear: {
    description:
      'Clear scrollback (xterm.js) — clear --help lists flags · clear --cow whispers moo',
    run: () => [],
  },

  date: {
    description: 'Portfolio clock — locale wall time + epoch ms (browser truth)',
    run: () => runUnixDate(),
  },

  uptime: {
    description: 'Tab-session uptime since navigation — not the host machine bragging',
    run: () => runFakeUptime(),
  },

  cal: {
    description: 'ASCII month grid — cal [month 1-12] [year] · highlights today',
    run: args => runCalAscii(args),
  },

  wc: {
    description: 'Count lines · words · chars (UTF-8 bytes) on a virtual file',
    run: args => {
      if (!args[0]) return [`  ${c.red}usage:${c.reset} wc <path>`]
      const out = vfsCat(args[0])
      if (out == null || out.startsWith('cat:')) return [`  ${out ?? 'cat: I/O error'}`]
      const body = out === '(empty file)' ? '' : out
      const { lines, words, chars } = wcStats(body)
      const p = vfsNormalize(args[0])
      return [
        '',
        `  ${`${lines}`.padStart(6)} ${`${words}`.padStart(6)} ${`${chars}`.padStart(8)} ${p}`,
        `  ${c.dim}lines · words · UTF-8-ish bytes${c.reset}`,
        '',
      ]
    },
  },

  head: {
    description: 'Print first N lines — head [-n #] path (default N=10)',
    run: args => {
      const { n, path, err } = parseHeadTail('head', args)
      if (err || !path) return [`  ${c.red}${err ?? 'usage'}${c.reset}`]
      const out = vfsCat(path)
      if (out == null || out.startsWith('cat:')) return [`  ${out ?? 'cat: I/O error'}`]
      const body = out === '(empty file)' ? '' : out
      const lines = body.split('\n')
      const take = lines.slice(0, n)
      return take.length ? take.map(line => `  ${line}`) : [`  ${c.dim}(empty)${c.reset}`]
    },
  },

  tail: {
    description: 'Print last N lines — tail [-n #] path (default N=10)',
    run: args => {
      const { n, path, err } = parseHeadTail('tail', args)
      if (err || !path) return [`  ${c.red}${err ?? 'usage'}${c.reset}`]
      const out = vfsCat(path)
      if (out == null || out.startsWith('cat:')) return [`  ${out ?? 'cat: I/O error'}`]
      const body = out === '(empty file)' ? '' : out
      const lines = body.split('\n')
      const start = Math.max(0, lines.length - n)
      const take = lines.slice(start)
      return take.length ? take.map(line => `  ${line}`) : [`  ${c.dim}(empty)${c.reset}`]
    },
  },

  echo: {
    description:
      'Echo args · extras: --fortune · --cow · --d20 roll · shell-less 42/sudo/:wq reacts',
    run: (args) => {
      if (args.length === 0) return [`  ${c.dim}(empty line)${c.reset}`]

      const a0 = args[0]?.toLowerCase()
      const joined = args.join(' ')

      if (args[0] === '--help' || a0 === '-h') {
        return [
          `  ${c.dim}echo [text]${c.reset}  ${c.dim}— join args with spaces${c.reset}`,
          `  ${c.blue}echo --fortune${c.reset}${c.dim} | ${c.reset}${c.blue}-f${c.reset}  ${c.dim}random one-liner${c.reset}`,
          `  ${c.blue}echo --cow …${c.reset}  ${c.dim}same as cowsay (no apt)${c.reset}`,
          `  ${c.blue}echo --d20${c.reset}${c.dim} | ${c.reset}${c.blue}--roll${c.reset}${c.dim} random d20 for standups …${c.reset}`,
          `  ${c.dim}Also:${c.reset} ${c.blue}echo 42${c.reset}${c.dim}, ${c.reset}${c.blue}echo sudo …${c.reset}${c.dim}, ${c.reset}${c.blue}echo :wq${c.reset}`,
          '',
        ]
      }

      if (a0 === '--d20' || a0 === '--roll') {
        const v = Math.floor(Math.random() * 20) + 1
        return ['', `  ${c.green}d20 ⇒${c.reset} ${c.bold}${v}${c.reset}`, '']
      }

      if (a0 === '--fortune' || a0 === '-f')
        return ['', `  "${pick(CLI_FORTUNES)}"`, '', `  ${c.dim}(echo --fortune again for reroll)${c.reset}`, '']

      if (a0 === '--cow' || a0 === '@cow') {
        const msg = args.slice(1).join(' ')
        const bubble = msg || '(the cow stared into the abyss)'
        return ['', ...cowsayFormat(bubble).map(line => `  ${line}`), '']
      }

      const low = joined.toLowerCase()
      if (low === '42')
        return [
          '',
          `  ${c.cyan}Six times nine? In base thirteen, possibly hilarious.${c.reset}`,
          `  ${c.dim}(JavaScript floats agree approximately.)${c.reset}`,
          '',
        ]
      if (low.startsWith('sudo '))
        return [
          '',
          `  ${c.yellow}sorry, this kiosk account lacks god mode.${c.reset}`,
          `  ${c.dim}Try dragging a window splitter — low-key root access.${c.reset}`,
          '',
        ]
      if (low === ':wq') {
        return [
          '',
          `  ${c.red}easy there — this is still the shell.${c.reset}`,
          `  ${c.dim}open ${c.blue}vim welcome.txt${c.dim} then flex :wq.${c.reset}`,
          '',
        ]
      }
      if (/^hello,? world!?$/.test(low)) {
        return [
          '',
          `  hello world`,
          `  ${c.green}achievement:${c.reset} ${c.dim}tutorial boss defeated in a fictional OS.${c.reset}`,
          '',
        ]
      }

      return [`  ${joined}`]
    },
  },

  vfsreset: {
    description: '',
    hidden: true,
    run: () => {
      vfsReset()
      return [`  ${c.dim}Filesystem reset to default tree.${c.reset}`]
    },
  },
}
