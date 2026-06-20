/** VFS file-system commands: pwd · ls · cd · cat · touch · mkdir · rm · wc · head · tail · vfsreset */

import { c } from '../theme'
import {
  fmtHumanBytes,
  parseHeadTail,
  wcStats,
} from './cli-text-utils'
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
  vfsNormalize,
  vfsFormatPath,
  vfsOldPwdFormatted,
  FS_HOME,
  type VfsLongEntry,
} from '../os-fs'
import { playOsSound } from '../os-sound'

import type { Command } from './types'

export const vfsCommands: Record<string, Command> = {

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
      const flag = args[0]
      if (flag === '-P') {
        lines.push(
          `  ${c.dim}-P:${c.reset} physical path identical — ${c.yellow}no symlinks in this FS${c.reset}${c.dim}.${c.reset}`,
        )
      } else if (flag === '-L') {
        lines.push(`  ${c.dim}-L:${c.reset} logical path (${c.bold}same string${c.reset}${c.dim} here — default).${c.reset}`)
      } else if (flag && !flag.startsWith('-')) {
        lines.push(`  ${c.dim}(ignoring stray ${JSON.stringify(flag)} — try ${c.blue}-P${c.dim} · ${c.blue}-L${c.dim})${c.reset}`)
      }
      lines.push(`  ${c.dim}Paths persist via localStorage in this browser profile.${c.reset}`, '')
      return lines
    },
  },

  ls: {
    description:
      'List directory — -a all incl . .. · -A all but . .. · -l long mode · -h human sizes (with -l)',
    run: args => {
      let showAll = false // -a : include dotfiles plus the . and .. entries
      let almostAll = false // -A : include dotfiles but omit . and .. (POSIX "almost all")
      let long = false
      let human = false
      const pathChunks: string[] = []
      for (const a of args) {
        if (a === '-a') showAll = true
        else if (a === '-A') almostAll = true
        else if (a === '-l') long = true
        else if (a === '-h' || a === '--human-readable') human = true
        else if (!a.startsWith('-')) pathChunks.push(a)
      }
      const all = showAll || almostAll
      // -A lists dotfiles but drops the . and .. pseudo-dirs that -a keeps.
      const dropDotDirs = almostAll && !showAll
      const target = pathChunks.join(' ')
      if (long) {
        const rows = vfsLsLong(target || undefined, { all })
        if (rows.length >= 1 && typeof rows[0] === 'string' && rows[0].startsWith('ls:'))
          return [`  ${rows[0]}`]
        let data = rows as VfsLongEntry[]
        if (dropDotDirs) data = data.filter(r => r.name !== '.' && r.name !== '..')
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

      let lines = vfsLs(target || undefined, { all })
      if (lines.length === 1 && lines[0].startsWith('ls:')) return [`  ${lines[0]}`]
      if (dropDotDirs) lines = lines.filter(n => n !== '.' && n !== '..')
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
      const digitWidth = String(rows.length).length
      return rows.map((line, i) => `  ${c.dim}${String(i + 1).padStart(digitWidth)}${c.reset} │ ${line}`)
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
    description: 'Remove a file or directory — directories are deleted recursively (no -r needed)',
    run: (args) => {
      if (!args[0]) return [`  ${c.red}usage:${c.reset} rm <path>`]
      const err = vfsRm(args[0])
      if (err) return [`  ${err}`]
      playOsSound('click')
      return [`  ${c.dim}removed${c.reset} ${vfsNormalize(args[0])}`, `  ${c.dim}(trash-cli not installed — this is final)${c.reset}`]
    },
  },

  wc: {
    description: 'Count lines · words · chars (UTF-8 bytes) on a virtual file',
    run: args => {
      if (!args[0]) return [`  ${c.red}usage:${c.reset} wc <path>`]
      const out = vfsCat(args[0])
      if (out == null || out.startsWith('cat:')) return [`  ${out ?? 'cat: I/O error'}`]
      const body = out === '(empty file)' ? '' : out
      const { lines, words, chars } = wcStats(body)
      const path = vfsNormalize(args[0])
      return [
        '',
        `  ${`${lines}`.padStart(6)} ${`${words}`.padStart(6)} ${`${chars}`.padStart(8)} ${path}`,
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
      // An empty file has no lines — fall through to the (empty) marker rather
      // than ''.split('\n') === [''] printing a stray blank line.
      const lines = body === '' ? [] : body.split('\n')
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
      const lines = body === '' ? [] : body.split('\n')
      const start = Math.max(0, lines.length - n)
      const take = lines.slice(start)
      return take.length ? take.map(line => `  ${line}`) : [`  ${c.dim}(empty)${c.reset}`]
    },
  },

  vfsreset: {
    description: 'Reset VFS to default tree — wipes all files, restores default notes and sketches',
    hidden: true,
    run: () => {
      vfsReset()
      return [`  ${c.dim}Filesystem reset to default tree.${c.reset}`]
    },
  },
}
