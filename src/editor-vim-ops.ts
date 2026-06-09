/**
 * Pure text/cursor helpers for the modal editor (vim-like motions).
 */

export function lineCountTotal(text: string): number {
  if (!text) return 1
  return Math.max(1, text.split('\n').length)
}

export function getLineCol(text: string, pos: number): { line: number; col: number } {
  const p = Math.min(Math.max(0, pos), text.length)
  const pref = text.slice(0, p)
  const line = pref.split('\n').length
  const li = pref.lastIndexOf('\n')
  const col = p - (li + 1) + 1
  return { line, col }
}

export function lineBounds(text: string, pos: number): { start: number; end: number } {
  const lineStart = text.lastIndexOf('\n', pos - 1) + 1
  let lineEnd = text.indexOf('\n', pos)
  if (lineEnd === -1) lineEnd = text.length
  return { start: lineStart, end: lineEnd }
}

export function gotoLinePos(text: string, oneBased: number): number {
  const lines = text.split('\n')
  const maxL = Math.max(1, lines.length)
  const n = Math.max(1, Math.min(oneBased, maxL))
  let pos = 0
  for (let i = 0; i < n - 1; i++) pos += lines[i]!.length + 1
  return pos
}

export function consumeCountDigits(digits: string, defaultN = 1): number {
  if (!digits) return Math.max(1, defaultN)
  const v = parseInt(digits, 10)
  if (!Number.isFinite(v) || v < 1) return Math.max(1, defaultN)
  return Math.min(v, 50_000)
}

export function consumeOptionalNat(digits: string): number | null {
  if (!digits) return null
  const v = parseInt(digits, 10)
  if (!Number.isFinite(v) || v < 1) return null
  return Math.min(v, 50_000)
}

/** Vim `j` / `k` — return new caret index preserving column when possible. */
export function moveVertPos(text: string, pos: number, delta: -1 | 1): number {
  const p = Math.min(Math.max(0, pos), text.length)
  const before = text.slice(0, p)
  const lineStart = before.lastIndexOf('\n') + 1
  const col = p - lineStart
  const lines = text.split('\n')
  const lineIdx = before.split('\n').length - 1
  const targetLine = Math.max(0, Math.min(lines.length - 1, lineIdx + delta))
  const targetText = lines[targetLine] ?? ''
  const newCol = Math.min(col, targetText.length)
  let out = 0
  for (let i = 0; i < targetLine; i++) out += lines[i]!.length + 1
  return out + newCol
}

export function firstNonBlankOnLine(text: string, pos: number): number {
  const { start, end } = lineBounds(text, pos)
  let p = start
  while (p < end && /\s/.test(text[p]!)) p++
  return p < end ? p : start
}
