/**
 * Everything `help`, `help -v`, and `help <topic>` renders.
 * Takes the live command map so this file stays import-cycle free from `index.ts`.
 */

import { c } from '../theme'
import type { Command } from './types'

export type CommandRegistry = Record<string, Command>

/** contact → links, plain → static, etc. — matches what fingers actually type */
const HELP_TOPIC_ALIASES: Readonly<Record<string, string>> = {
  contact: 'links',
  skills: 'resume',
  plain: 'static',
  x: 'static',
}

function helpSectionLine(title: string): string {
  return `  ${c.pink}${title}${c.reset}  ${c.dim}${'─'.repeat(Math.max(0, 44 - title.length))}${c.reset}`
}

/** Grab text before “ — ” for narrow columns when the sentence is Long™ */
export function shortenDescriptionForColumns(desc: string, maxLen: number): string {
  let s = desc.trim()
  const split = /\s+[—\-]\s+/.exec(s)
  if (
    split &&
    typeof split.index === 'number' &&
    split.index >= 12 &&
    split.index <= Math.min(s.length - 14, maxLen + 45)
  ) {
    const head = s.slice(0, split.index).trim()
    const paren = head.indexOf('·(')
    s = paren > 10 ? head.slice(0, paren).trim() : head
  }
  if (s.length > maxLen) s = `${s.slice(0, maxLen - 1).trimEnd()}…`
  return s
}

export function parseHelpArgv(args: string[]): { rosterVerbose: boolean; topics: string[] } {
  const topics: string[] = []
  let rosterVerbose = false
  for (const a of args) {
    if (a.toLowerCase() === '-v') rosterVerbose = true
    else topics.push(a)
  }
  return { rosterVerbose, topics }
}

function resolveHelpLookupKey(registry: CommandRegistry, raw: string): string | null {
  const n = raw.trim().toLowerCase()
  const key = HELP_TOPIC_ALIASES[n] ?? n
  const def = registry[key]
  if (def && !def.hidden) return key
  return null
}

function widestNameColumn(entries: Iterable<[string, Command]>): number {
  let w = 8
  for (const [n, def] of entries) {
    if (def.hidden) continue
    w = Math.max(w, n.length)
  }
  return Math.min(Math.max(w, 8), 14)
}

function formatDualCommandRow(
  k1: string,
  d1: string,
  k2: string | null,
  d2: string | null,
  nw: number,
  dw: number,
): string {
  const sd1 = shortenDescriptionForColumns(d1, dw)
  const pad1 = ' '.repeat(Math.max(0, dw - sd1.length))
  let left =
    `${c.blue}${k1.padEnd(nw)}${c.reset}` + ` ${c.dim}${sd1}${pad1}${c.reset}`
  if (!k2 || !d2) return `  ${left}`

  const sd2 = shortenDescriptionForColumns(d2, dw)
  const pad2 = ' '.repeat(Math.max(0, dw - sd2.length))
  const right =
    `  ${c.blue}${k2.padEnd(nw)}${c.reset}` + ` ${c.dim}${sd2}${pad2}${c.reset}`
  return `  ${left}  ${right}`
}

const HELP_GROUPS: ReadonlyArray<{ title: string; keys: readonly string[] }> = [
  { title: 'Portfolio & contact', keys: ['links', 'projects', 'resume', 'static'] },
  {
    title: 'Programs',
    keys: ['explorer', 'browse', 'edit', 'editor', 'vim', 'whoami', 'paint', 'cube', 'snake', 'pong'],
  },
  { title: 'Filesystem', keys: ['pwd', 'ls', 'cd', 'cat', 'touch', 'mkdir', 'rm', 'wc', 'head', 'tail'] },
  { title: 'Shell & misc', keys: ['help', 'keybinds', 'cookies', 'clear', 'echo', 'reboot', 'ps', 'date', 'uptime', 'cal'] },
  { title: 'Look · sound · effects', keys: ['theme', 'retro', 'matrix', 'sound'] },
  { title: 'Fun & fakery', keys: ['notify', 'apt', 'cowsay'] },
]

function formatCommandRibbon(registry: CommandRegistry, keys: readonly string[]): string | null {
  const parts = keys
    .filter(key => {
      const def = registry[key]
      return def && !def.hidden
    })
    .map(k => `${c.blue}${k}${c.reset}`)
  if (parts.length === 0) return null
  return parts.join(`${c.dim} · ${c.reset}`)
}

export function renderHelpVerboseRoster(registry: CommandRegistry): string[] {
  const visible = Object.entries(registry).filter(([, v]) => !v.hidden)
  const nw = widestNameColumn(visible)
  const dw = 29
  const groupedKeys = new Set<string>()
  for (const g of HELP_GROUPS) for (const k of g.keys) groupedKeys.add(k)

  const lines: string[] = ['']

  lines.push(
    `  ${c.pink}Portfolio OS${c.reset}  ${c.dim}${c.bold}Every keyword${c.reset}${c.dim} on one screen, ${c.bold}with a sentence${c.reset}${c.dim} next to each for quick scanning.${c.reset}`,
  )
  lines.push(
    `  ${c.dim}For ${c.bold}one${c.reset}${c.dim} item only, skip this list and run ${c.blue}help resume${c.reset}${c.dim}-style.${c.reset}`,
  )
  lines.push(
    `  ${c.dim}${c.bold}Shortcuts:${c.reset} ${c.blue}Ctrl+T${c.reset}${c.dim}/${c.blue}Ctrl+D${c.reset}${c.dim}: command bar ↔ app launcher · ${c.blue}Ctrl+H${c.reset}${c.dim} or ${c.blue}K${c.reset}${c.dim} / ${c.blue}L${c.reset}${c.dim} or ${c.blue}J${c.reset}${c.dim}: move between panels · ${c.blue}Ctrl+1–9${c.reset}${c.dim}: dock slots · ${c.blue}Ctrl+Q/M/F${c.reset}${c.dim}: close · shrink · enlarge.${c.reset}`,
  )
  lines.push('')

  for (const { title, keys } of HELP_GROUPS) {
    lines.push(helpSectionLine(title))
    lines.push('')
    const names = keys.filter(k => registry[k] && !registry[k]!.hidden)
    for (let i = 0; i < names.length; i += 2) {
      const k1 = names[i]!
      const k2 = names[i + 1] ?? null
      const cmd1 = registry[k1]!
      const cmd2 = k2 ? registry[k2]! : null
      lines.push(
        formatDualCommandRow(
          k1,
          cmd1.description,
          k2 ? k2 : null,
          cmd2 ? cmd2.description : null,
          nw,
          dw,
        ),
      )
    }
    lines.push('')
  }

  const orphans = visible
    .filter(([name]) => !groupedKeys.has(name))
    .sort(([a], [b]) => a.localeCompare(b))
  if (orphans.length > 0) {
    lines.push(helpSectionLine('Other'))
    lines.push('')
    for (let i = 0; i < orphans.length; i += 2) {
      const [n1, c1] = orphans[i]!
      const row2 = orphans[i + 1]
      lines.push(
        formatDualCommandRow(
          n1,
          c1.description,
          row2 ? row2[0] : null,
          row2 ? row2[1].description : null,
          nw,
          dw,
        ),
      )
    }
    lines.push('')
  }

  lines.push(
    `  ${c.dim}${c.bold}Tip:${c.reset} ${c.blue}theme random${c.reset}${c.dim} · ${c.reset}${c.blue}reboot --dry-run${c.reset}${c.dim} · ${c.reset}${c.blue}cd -${c.reset}${c.dim} · ${c.reset}${c.blue}wc welcome.txt${c.reset}`,
  )
  lines.push('')
  return lines
}

export function renderHelpTopicDetails(registry: CommandRegistry, words: readonly string[]): string[] {
  const lines: string[] = ['']
  let anyUnknown = false
  const cleaned = [...new Set(words.map(w => w.trim()).filter(Boolean))]
  for (const w of cleaned) {
    const key = resolveHelpLookupKey(registry, w)
    if (!key) {
      anyUnknown = true
      lines.push(`  ${c.red}Unknown keyword:${c.reset} ${c.blue}${w}${c.reset}`, '')
      continue
    }
    const cmd = registry[key]!
    lines.push(`  ${c.blue}${key}${c.reset}`)
    lines.push(`  ${c.dim}${cmd.description}${c.reset}`, '')
  }
  if (anyUnknown) {
    lines.push(`  ${c.dim}Browse names with ${c.blue}help${c.reset}${c.dim}; full glossary:${c.reset} ${c.blue}help -v${c.reset}`)
  } else {
    lines.push(
      `  ${c.dim}${c.bold}Every${c.reset}${c.dim} keyword + short note:${c.reset} ${c.blue}help -v${c.reset}`,
    )
  }
  lines.push('')
  return lines
}

export function renderHelpCompactRoster(registry: CommandRegistry): string[] {
  const visible = Object.entries(registry).filter(([, v]) => !v.hidden)
  const groupedKeys = new Set<string>()
  for (const g of HELP_GROUPS) for (const k of g.keys) groupedKeys.add(k)

  const lines: string[] = ['']

  lines.push(
    `  ${c.pink}Portfolio OS${c.reset}  ${c.dim}${c.bold}Résumé and work samples${c.reset}${c.dim} staged like a workstation you already recognise.${c.reset}`,
  )
  lines.push(
    `  ${c.blue}Ctrl+T${c.reset}${c.dim}/${c.blue}Ctrl+D${c.reset}${c.dim}: command bar ↔ launcher · ${c.blue}Ctrl+H${c.reset}${c.dim} or ${c.blue}K${c.reset}${c.dim} / ${c.blue}L${c.reset}${c.dim} or ${c.blue}J${c.reset}${c.dim}: earlier or later panel · ${c.blue}Ctrl+Q/M/F${c.reset}${c.dim}: close · shrink · enlarge.${c.reset}`,
  )
  lines.push('')
  lines.push(
    `  ${c.dim}Grouped ${c.bold}names${c.reset}${c.dim}. ${c.blue}help${c.dim} ${c.blue}<keyword>${c.reset}${c.dim} (${c.blue}help resume${c.reset}${c.dim}) expands ${c.bold}one${c.reset}${c.dim}. Want that for ${c.bold}all${c.reset}${c.dim} at once:${c.reset} ${c.blue}help -v${c.reset}`,
  )
  lines.push('')

  for (const { title, keys } of HELP_GROUPS) {
    const ribbon = formatCommandRibbon(registry, keys)
    if (!ribbon) continue
    lines.push(`  ${c.pink}${title}:${c.reset} ${ribbon}`)
  }

  const orphans = visible.filter(([name]) => !groupedKeys.has(name)).sort(([a], [b]) => a.localeCompare(b))
  if (orphans.length > 0) {
    lines.push(`  ${c.pink}Other:${c.reset} ${formatCommandRibbon(registry, orphans.map(([n]) => n)) ?? ''}`)
  }

  lines.push('')
  lines.push(
    `  ${c.dim}Try ${c.blue}theme random${c.reset}${c.dim} · ${c.blue}browse https://example.com${c.reset}${c.dim} · ${c.blue}cookies stats${c.reset}`,
  )
  lines.push('')
  return lines
}

/** Entry point wired as `help`’s run — forwards the registry from `commands` constant */
export function runShellHelp(registry: CommandRegistry, args: string[] = []): string[] {
  const { rosterVerbose, topics } = parseHelpArgv(args)
  if (topics.length > 0) return renderHelpTopicDetails(registry, topics)
  if (rosterVerbose) return renderHelpVerboseRoster(registry)
  return renderHelpCompactRoster(registry)
}


// keybinds legend

function kbRow(key: string, action: string, key2?: string, action2?: string): string {
  const kw = 16
  const aw = 28
  const left = `  ${c.blue}${key.padEnd(kw)}${c.reset}${c.dim}${action.padEnd(aw)}${c.reset}`
  if (!key2) return left
  return left + `  ${c.blue}${key2.padEnd(kw)}${c.reset}${c.dim}${action2 ?? ""}${c.reset}`
}

export function renderKeybindsLegend(): string[] {
  const sec = (t: string) => helpSectionLine(t)
  return [
    "",
    `  ${c.pink}${c.bold}keybinds${c.reset}  ${c.dim}Window manager  terminal  games${c.reset}`,
    "",
    sec("Window manager  (global, always active)"),
    "",
    kbRow("Ctrl+T",    "focus / restore terminal",   "Ctrl+D",    "toggle app launcher"),
    kbRow("Ctrl+1-9",  "activate dock slot N",        "Ctrl+H/K",  "focus previous panel"),
    kbRow("Ctrl+Q",    "close focused window",        "Ctrl+L/J",  "focus next panel"),
    kbRow("Ctrl+M",    "minimize focused window",     "Ctrl+F",    "maximize / restore"),
    kbRow("Escape",    "close launcher overlay"),
    "",
    sec("Terminal  (vim-style input layer)"),
    "",
    kbRow("i",          "enter insert mode",          "Esc",       "enter normal mode"),
    kbRow("h / l",      "move cursor left / right",   "w / b",     "word forward / back"),
    kbRow("0 / $",      "start / end of line",        "x",         "delete under cursor"),
    kbRow("d d / D",    "delete line / to end",       "y y / p",   "yank line / paste"),
    kbRow("Tab",        "autocomplete command",        "up / down", "command history"),
    kbRow("Ctrl+C",     "interrupt / cancel",          "Ctrl+U",    "clear to line start"),
    "",
    sec("Editor  (edit / vim / editor tiles)"),
    "",
    kbRow("h j k l",    "move cursor",                ":w",        "save file"),
    kbRow("i / a",      "insert / append",            ":q / :wq",  "quit / save-quit"),
    kbRow("w / b",      "word forward / back",        ":e [path]", "open path"),
    kbRow("dd / yy",    "delete / yank line",         "p",         "paste below"),
    "",
    sec("File explorer  (explorer tile)"),
    "",
    kbRow("up / down",  "navigate list",              "Enter",     "open file or folder"),
    kbRow("F2",         "rename selected",            "Del",       "delete selected"),
    kbRow("Ctrl+C/V",   "copy / paste",               "Ctrl+X",    "cut"),
    "",
    sec("Games"),
    "",
    kbRow("Snake",      "WASD / arrows  Space to restart after game over"),
    kbRow("Pong",       "W/S player 1  up/down player 2  vs AI by default"),
    kbRow("Paint",      "[ / ] adjust brush size  click and drag to draw"),
    kbRow("Cube",       "U D L R F B + Shift prime  Space scramble  drag orbit"),
    "",
    `  ${c.dim}Tip: ${c.reset}${c.blue}help -v${c.reset}${c.dim} for the full command glossary.${c.reset}`,
    "",
  ]
}
