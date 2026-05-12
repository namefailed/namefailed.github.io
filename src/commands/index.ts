/**
 * Keyword → handler map for the xterm shell. Split files:
 *   `help-output.ts` — help screens
 *   `cli-text-utils.ts` / `cli-fortunes.ts` — fake Unix bits
 */
import { c } from '../theme'
import { randomPick } from '../random-pick'
import { ECHO_FORTUNE_LINES } from './cli-fortunes'
import {
  fmtHumanBytes,
  parseHeadTail,
  runCalAscii,
  runFakeUptime,
  runUnixDate,
  wcStats,
} from './cli-text-utils'
import { renderKeybindsLegend, runShellHelp } from './help-output'
import {
  linksAndContactLines,
  projectsLines,
  resumeAndSkillsLines,
  whoamiAboutLines,
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

import type { Command } from './types'

export type { Command } from './types'

export const commands: Record<string, Command> = {

  help: {
    description:
      'Summarises keywords; try help resume for one keyword, help -v for every keyword with notes',
    run: args => runShellHelp(commands, args),
  },

  keybinds: {
    description: 'Full keyboard shortcut legend — WM, terminal, editor, explorer, games',
    run: () => renderKeybindsLegend(),
  },

  static: {
    description:
      'Static portfolio — résumé, projects & contact at `/static/` (no desktop UI; phones auto-redirect here)',
    run: () => [],
  },

  /** @deprecated Prefer `static`; kept so old scripts still work */
  plain: {
    hidden: true,
    description: 'Hidden alias for `static`',
    run: () => [],
  },

  /** @deprecated Prefer `static`; kept so old muscle memory still works */
  x: {
    hidden: true,
    description: 'Hidden alias for `static`',
    run: () => [],
  },

  links: {
    description:
      'Contact tile — portrait rail, GitHub/LinkedIn/email/phone/site, browse hints (CLI alias: `contact`)',
    loadMs: 400,
    run: () => linksAndContactLines(),
  },

  resume: {
    description:
      'Résumé + skill matrix — narrative, bar chart, certs (same path as legacy `skills`)',
    loadMs: 800,
    run: () => resumeAndSkillsLines(),
  },

  projects: {
    description:
      'Shipped work + placeholder cards for future repos and live demos (structured list)',
    loadMs: 800,
    run: () => projectsLines(),
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

  // cube: temporarily disabled while we revisit the rotation math.
  // Keeping the entry out of the registry hides it from help/autocomplete;
  // desktop.ts intercepts any 'cube' invocation and shows a toast.

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
    description:
      'About me tile — work story, SCA persona Graee na Uile, links (résumé: `resume`; outbound: `links`)',
    loadMs: 350,
    run: () => whoamiAboutLines(),
  },

  vim: {
    description:
      'Editor tile — vim [path] opens same mini-vim buffer as edit (default welcome.txt)',
    run: () => [],
  },

  retro: {
    description:
      'CRT shader — retro · on | off | status | --help · bare word toggles scanlines',
    run: () => [],
  },

  matrix: {
    description:
      'Matrix rain — matrix on | off | status | --help · clock menu syncs · on/off saved for reload',
    run: () => [],
  },

  theme: {
    description:
      'Catppuccin packs — theme · list · random · current · <id> paints UI + terminal',
    run: () => [],
  },

  sound: {
    description:
      'UI bleeps — sound on | off · status | ? · bare word toggles · volume in clock menu',
    run: () => [],
  },

  reboot: {
    description:
      'Kernel cosplay — full reboot replays boot art; reboot --dry-run prints log sampler',
    run: () => [],
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
            `  ${r.mode} ${r.nlink} ${c.dim}namefailed namefailed${c.reset} ${szDisp} ${r.mon} ${r.day} ${r.hhmm} ${r.name}`,
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
          `${padEnd('namefailed', userW)} ${padStart(String(r.pid), pidW)} ${padStart(String(1 + (idx % 3)), ppidW)} ` +
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
        return ['', `  "${randomPick(ECHO_FORTUNE_LINES)}"`, '', `  ${c.dim}(echo --fortune again for reroll)${c.reset}`, '']

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
