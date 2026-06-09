/**
 * Pure caret / motion helpers for the modal editor (vim-like).
 *
 * Contract: functions return indices or scalar positions only — never mutate text.
 * Buffer mutations live in `editor-vim-edits.ts`.
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

/** Vim `h` / `l` — horizontal caret motion with repeat count. */
export function moveHorizPos(text: string, pos: number, delta: -1 | 1, steps = 1): number {
  const max = text.length
  let p = Math.min(Math.max(0, pos), max)
  const n = Math.max(1, steps)
  for (let i = 0; i < n; i++) {
    p = delta < 0 ? Math.max(0, p - 1) : Math.min(max, p + 1)
  }
  return p
}

/** `$` motion — last character on the current line (not past trailing newline). */
export function lineEndCaretPos(text: string, pos: number): number {
  const { start, end } = lineBounds(text, pos)
  let p = end - 1
  if (p >= start && text[p] === '\n') p--
  return Math.max(start, p)
}

export function firstNonBlankOnLine(text: string, pos: number): number {
  const { start, end } = lineBounds(text, pos)
  let p = start
  while (p < end && /\s/.test(text[p]!)) p++
  return p < end ? p : start
}

export function isWordChar(ch: string): boolean {
  return /[A-Za-z0-9_]/.test(ch)
}

/** Next word start — vim-like `w` on [A-Za-z0-9_] tokens */
export function wordForwardPos(text: string, pos: number): number {
  let p = Math.min(pos, text.length)
  while (p < text.length && !isWordChar(text[p]!)) p++
  while (p < text.length && isWordChar(text[p]!)) p++
  return p
}

/** Previous word start — vim-like `b` */
export function wordBackPos(text: string, pos: number): number {
  let p = Math.min(pos, text.length)
  if (p > 0) p--
  while (p > 0 && !isWordChar(text[p]!)) p--
  while (p > 0 && isWordChar(text[p - 1]!)) p--
  return p
}

/** End of next word — vim-like `e` */
export function wordEndForwardPos(text: string, pos: number): number {
  if (text.length === 0) return 0
  let p = Math.min(Math.max(0, pos), text.length - 1)
  if (!isWordChar(text[p]!)) {
    while (p < text.length && !isWordChar(text[p]!)) p++
    if (p >= text.length) return text.length - 1
  }
  while (p < text.length - 1 && isWordChar(text[p + 1]!)) p++
  return p
}

export function reverseFindKind(kind: 'f' | 'F' | 't' | 'T'): 'f' | 'F' | 't' | 'T' {
  if (kind === 'f') return 'F'
  if (kind === 'F') return 'f'
  if (kind === 't') return 'T'
  return 't'
}

export function findNextOnLine(
  text: string,
  kind: 'f' | 'F' | 't' | 'T',
  ch: string,
  fromPos: number,
): number | null {
  const { start, end } = lineBounds(text, fromPos)
  const line = text.slice(start, end)
  const rel = fromPos - start
  if (kind === 'f' || kind === 't') {
    const slice = line.slice(rel + 1)
    const j = slice.indexOf(ch)
    if (j < 0) return null
    const hit = start + rel + 1 + j
    return kind === 'f' ? hit : hit - 1
  }
  const before = line.slice(0, rel)
  let j = -1
  for (let bi = before.length - 1; bi >= 0; bi--) {
    if (before[bi] === ch) {
      j = bi
      break
    }
  }
  if (j < 0) return null
  const hit = start + j
  return kind === 'F' ? hit : hit + 1
}

/** Repeat `f`/`F`/`t`/`T` motion `times` from `fromPos`; null if any step fails. */
export function repeatFindPos(
  text: string,
  times: number,
  kind: 'f' | 'F' | 't' | 'T',
  ch: string,
  fromPos: number,
): number | null {
  const n = Math.max(1, times)
  let p = Math.min(Math.max(0, fromPos), text.length)
  for (let i = 0; i < n; i++) {
    const np = findNextOnLine(text, kind, ch, p)
    if (np == null) return null
    p = np
  }
  return p
}

/** Repeat vertical motion `steps` times. */
export function moveVertRepeat(text: string, pos: number, delta: -1 | 1, steps: number): number {
  let p = Math.min(Math.max(0, pos), text.length)
  const n = Math.max(1, steps)
  for (let i = 0; i < n; i++) p = moveVertPos(text, p, delta)
  return p
}

export function wordForwardRepeat(text: string, pos: number, steps: number): number {
  let p = Math.min(Math.max(0, pos), text.length)
  for (let i = 0; i < Math.max(1, steps); i++) p = wordForwardPos(text, p)
  return p
}

export function wordBackRepeat(text: string, pos: number, steps: number): number {
  let p = Math.min(Math.max(0, pos), text.length)
  for (let i = 0; i < Math.max(1, steps); i++) p = wordBackPos(text, p)
  return p
}

export function wordEndForwardRepeat(text: string, pos: number, steps: number): number {
  let p = Math.min(Math.max(0, pos), text.length)
  for (let i = 0; i < Math.max(1, steps); i++) p = wordEndForwardPos(text, p)
  return p
}

/** `A` — caret position at end of current line. */
export function appendLineEndPos(text: string, pos: number): number {
  const p = Math.min(Math.max(0, pos), text.length)
  const rest = text.slice(p)
  const nl = rest.indexOf('\n')
  return nl === -1 ? text.length : p + nl
}
