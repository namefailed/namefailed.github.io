/** OS-level commands: cookies · ps · apt · cowsay · notify · date · uptime · cal · echo */

import { c } from '../theme'
import { randomPick } from '../random-pick'
import { ECHO_FORTUNE_LINES } from './cli-fortunes'
import { runCalAscii, runFakeUptime, runUnixDate } from './cli-text-utils'
import {
  vfsReset,
  vfsReloadFromStorage,
  vfsPersistedFootprint,
  vfsFormatPath,
  vfsPwd,
} from '../os-fs'
import { getDesktopRef } from '../os-registry'
import { runApt } from '../os-apt'
import { cowsayFormat } from '../os-packages'
import { pushToast } from '../os-systray'

import type { Command } from './types'

export const systemCommands: Record<string, Command> = {

  cookies: {
    description:
      'Fake home FS + first-visit flags · cookies reload | clear | stats (themes/sound use separate keys)',
    run: args => {
      const sub = args[0]?.toLowerCase()
      if (sub === 'clear') {
        vfsReset()
        // Wipe desktop-experience flags so the full first-visit flow replays on next load
        const keysToWipe = [
          'mrgrey-boot-seen',
          'mrgrey-toasts-seen',
          'mrgrey-desktop-tile-positions',
        ]
        for (const key of keysToWipe) window.localStorage.removeItem(key)
        // Sweep all hint-bubble flags (namespaced under mrgrey-hint-)
        const prefix = 'mrgrey-hint-'
        for (let i = window.localStorage.length - 1; i >= 0; i--) {
          const k = window.localStorage.key(i)
          if (k && k.startsWith(prefix)) window.localStorage.removeItem(k)
        }
        return [
          `  ${c.green}Virtual home cleared.${c.reset}  ${c.dim}Factory default tree written to storage.${c.reset}`,
          `  ${c.dim}First-visit flags wiped — boot splash, toasts, hints, tile positions reset.${c.reset}`,
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
        `  ${c.blue}cookies clear${c.reset}  ${c.dim}— wipe FS + restore default notes (themes untouched)${c.reset}`,
      ]
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
      return ['', ...cowsayFormat(msg || ' ').map(line => `  ${line}`), '']
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
          const ms = Number.parseInt(args[i + 1], 10)
          if (!Number.isNaN(ms)) duration = Math.min(22000, Math.max(900, ms))
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
        const roll = Math.floor(Math.random() * 20) + 1
        return ['', `  ${c.green}d20 ⇒${c.reset} ${c.bold}${roll}${c.reset}`, '']
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
          `  ${c.dim}open ${c.blue}vim notes.txt${c.dim} then flex :wq.${c.reset}`,
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
}
