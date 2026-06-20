/**
 * Tiny ANSI line builders shared by resume / projects / contact copy.
 * Centralised so I’m not copy-pasting pink headers and bar charts in three files.
 */

import { c } from '../../theme'

/** Dim middle dot — fake list bullet in terminal-formatted copy */
export const dimInterpunct = `${c.dim}·${c.reset}`

export function dimRule(length: number): string {
  return `  ${c.dim}${'─'.repeat(length)}${c.reset}`
}

/** Pink title + dim rule to the right (fixed width feel in mono) */
export function sectionHeadingLine(title: string, ruleTargetWidth = 44): string {
  const dashes = Math.max(0, ruleTargetWidth - title.length)
  return `  ${c.pink}${title}${c.reset}  ${c.dim}${'─'.repeat(dashes)}${c.reset}`
}

/** ANSI bar segment only (█/░) — used by `skillMeterLine`. */
export function skillMeterBarAnsi(pct: number, width = 18): string {
  const filled = Math.round((pct / 100) * width)
  const empty = width - filled
  return `${c.pink}${'█'.repeat(filled)}${c.reset}` + `${c.dim}${'░'.repeat(empty)}${c.reset}`
}

/** One row: padded label + bar + right-aligned percent */
export function skillMeterLine(label: string, pct: number, labelWidth: number): string {
  let display = label
  if (display.length > labelWidth) {
    display = `${display.slice(0, Math.max(1, labelWidth - 1))}…`
  }
  const padded = display.padEnd(labelWidth)
  return (
    `  ${c.blue}${padded}${c.reset}` +
    `${skillMeterBarAnsi(pct)}  ` +
    `${c.dim}${String(pct).padStart(3)}%${c.reset}`
  )
}
