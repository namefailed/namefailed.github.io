/**
 * Bits of “Unix cosplay” shared by `ls -h`, `wc`, `head`/`tail`, `date`, `uptime`, `cal`.
 * Nothing clever — kept in one place so tweaking column math doesn’t mean three hunts.
 */

import { c } from '../theme'

/** Shared encoder — instantiated once per module rather than per `wcStats` call. */
const encoder = new TextEncoder()

export function fmtHumanBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1048576) return `${(n / 1024).toFixed(n % 1024 === 0 ? 0 : 1)} KiB`
  return `${(n / 1048576).toFixed(1)} MiB`
}

export function wcStats(s: string): { lines: number; words: number; chars: number } {
  const lines = s === '' ? 0 : s.split('\n').length
  const words = s.trim() ? s.trim().split(/\s+/).length : 0
  const chars = encoder.encode(s).length
  return { lines, words, chars }
}

export function runUnixDate(): string[] {
  const d = new Date()
  let friendly: string
  try {
    // dateStyle:'full' already includes the weekday — pairing it with a `weekday`
    // option is illegal and throws, so keep them apart.
    friendly = d.toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'medium' })
  } catch {
    // Fallback for environments without full ICU date formatting.
    friendly = d.toString()
  }
  return [
    '',
    `  ${friendly}`,
    `  ${c.dim}epoch ms ${Date.now()} · UTC offset ${-d.getTimezoneOffset()} min${c.reset}`,
    '',
  ]
}

export function runFakeUptime(): string[] {
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

export function runCalAscii(args: string[]): string[] {
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

export function parseHeadTail(
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
