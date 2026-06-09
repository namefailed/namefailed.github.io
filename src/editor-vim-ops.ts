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

/** Byte span covering `nLines` lines starting at `startLineIdx` (0-based). */
export function lineBlockSpan(
  text: string,
  startLineIdx: number,
  nLines: number,
): { start: number; end: number; lineCount: number } | null {
  const lines = text.split('\n')
  if (!lines.length || startLineIdx < 0 || startLineIdx >= lines.length) return null
  const lineCount = Math.max(1, Math.min(nLines, lines.length - startLineIdx))
  let start = 0
  for (let i = 0; i < startLineIdx; i++) start += lines[i]!.length + 1
  let end = start
  for (let i = startLineIdx; i < startLineIdx + lineCount; i++) {
    end += lines[i]!.length
    if (i < lines.length - 1) end += 1
  }
  return { start, end, lineCount }
}

export function deleteLineBlockText(
  text: string,
  curLineOneBased: number,
  nLines: number,
): { text: string; pos: number } | null {
  const span = lineBlockSpan(text, curLineOneBased - 1, nLines)
  if (!span) return null
  const next = text.slice(0, span.start) + text.slice(span.end)
  return { text: next, pos: Math.min(span.start, next.length) }
}

export function yankLineBlockText(
  text: string,
  curLineOneBased: number,
  nLines: number,
): { yank: string; lineCount: number } | null {
  const span = lineBlockSpan(text, curLineOneBased - 1, nLines)
  if (!span) return null
  let yank = text.slice(span.start, span.end)
  if (!yank.endsWith('\n')) yank += '\n'
  return { yank, lineCount: span.lineCount }
}

export function deleteThroughEOLText(text: string, pos: number): { text: string; pos: number } {
  const p = Math.min(Math.max(0, pos), text.length)
  const { end } = lineBounds(text, p)
  const next = text.slice(0, p) + text.slice(end)
  return { text: next, pos: p }
}

/** Minimal vi `J` — join `span` consecutive lines without extra spacing. */
export function joinLinesText(
  text: string,
  curLineOneBased: number,
  span: number,
): { text: string; pos: number } | null {
  const lines = text.split('\n')
  const cur = curLineOneBased - 1
  if (cur < 0 || cur >= lines.length - 1) return null
  const maxSpan = Math.min(Math.max(2, span), lines.length - cur)
  const merged = lines.slice(cur, cur + maxSpan).join('')
  const block = lineBlockSpan(text, cur, maxSpan)
  if (!block) return null
  const next = text.slice(0, block.start) + merged + text.slice(block.end)
  return { text: next, pos: Math.min(block.start + merged.length, next.length) }
}

export function applyReplaceRunsText(
  text: string,
  pos: number,
  n: number,
  ch: string,
): { text: string; pos: number } | null {
  const p = Math.min(Math.max(0, pos), text.length)
  const take = Math.min(n, Math.max(0, text.length - p))
  if (take <= 0) return null
  const rep = ch.repeat(take)
  const next = text.slice(0, p) + rep + text.slice(p + take)
  const c = Math.max(p, Math.min(p + take - 1, next.length - 1))
  return { text: next, pos: c }
}

/** `p` paste after current line; `P` paste before current line. */
export function pasteYankText(
  text: string,
  pos: number,
  yank: string,
  afterLine: boolean,
): { text: string; pos: number } | null {
  if (!yank) return null
  const { start, end } = lineBounds(text, pos)
  const ins = afterLine
    ? end < text.length && text[end] === '\n'
      ? end + 1
      : text.length
    : start
  const next = text.slice(0, ins) + yank + text.slice(ins)
  return { text: next, pos: ins + yank.length - 1 }
}

/** Default `>>` / `<<` shift width (two spaces). */
export const EDITOR_INDENT = '  '

function leadingUnindentWidth(line: string): number {
  if (line.startsWith('  ')) return 2
  if (line.startsWith('\t')) return 1
  if (line.startsWith(' ')) return 1
  return 0
}

/** `>>` — indent `nLines` from caret line downward. */
export function indentLinesText(
  text: string,
  pos: number,
  nLines: number,
  indent = EDITOR_INDENT,
): { text: string; pos: number } | null {
  const p0 = Math.min(Math.max(0, pos), text.length)
  const li = text.slice(0, p0).split('\n').length - 1
  const lines = text.split('\n')
  if (li < 0 || li >= lines.length) return null
  const take = Math.max(1, Math.min(nLines, lines.length - li))
  for (let j = 0; j < take; j++) lines[li + j] = indent + (lines[li + j] ?? '')
  const next = lines.join('\n')
  const curLineIdx = text.slice(0, p0).split('\n').length - 1
  let newP = p0
  if (curLineIdx >= li && curLineIdx < li + take) newP += indent.length
  return { text: next, pos: newP }
}

/** `<<` — unindent `nLines` from caret line downward. */
export function unindentLinesText(
  text: string,
  pos: number,
  nLines: number,
): { text: string; pos: number } | null {
  const p0 = Math.min(Math.max(0, pos), text.length)
  const li = text.slice(0, p0).split('\n').length - 1
  const lines = text.split('\n')
  if (li < 0 || li >= lines.length) return null
  const take = Math.max(1, Math.min(nLines, lines.length - li))
  const curLineIdx = text.slice(0, p0).split('\n').length - 1
  let removedBefore = 0
  for (let j = 0; j < take; j++) {
    const idx = li + j
    const s = lines[idx] ?? ''
    const cut = leadingUnindentWidth(s)
    if (cut && idx === curLineIdx) {
      const lineStart = text.lastIndexOf('\n', p0 - 1) + 1
      const col = p0 - lineStart
      removedBefore = Math.min(cut, col)
    }
    lines[idx] = s.slice(cut)
  }
  const next = lines.join('\n')
  return { text: next, pos: Math.max(0, p0 - removedBefore) }
}

/** `~` — toggle case on next `n` non-newline characters. */
export function toggleCaseRunText(
  text: string,
  pos: number,
  n: number,
): { text: string; pos: number } | null {
  let p = Math.min(Math.max(0, pos), text.length)
  let buf = text
  let toggled = 0
  while (toggled < n && p < buf.length) {
    const ch = buf[p]!
    if (ch === '\n') {
      p++
      continue
    }
    const repl = ch === ch.toLowerCase() ? ch.toUpperCase() : ch.toLowerCase()
    buf = buf.slice(0, p) + repl + buf.slice(p + 1)
    p++
    toggled++
  }
  if (buf === text) return null
  return { text: buf, pos: Math.min(p, buf.length) }
}

/** `s` — delete `n` characters under cursor (enter insert in caller). */
export function substituteCharsText(
  text: string,
  pos: number,
  n: number,
): { text: string; pos: number } | null {
  const take = Math.max(1, n)
  const p = Math.min(Math.max(0, pos), text.length)
  const del = Math.min(take, Math.max(0, text.length - p))
  if (del <= 0) return null
  const next = text.slice(0, p) + text.slice(p + del)
  return { text: next, pos: p }
}

/** `x` — delete `n` characters forward from cursor. */
export function deleteCharForwardText(
  text: string,
  pos: number,
  n: number,
): { text: string; pos: number } | null {
  const p = Math.min(Math.max(0, pos), text.length)
  const kill = Math.min(Math.max(1, n), Math.max(0, text.length - p))
  if (!kill) return null
  const next = text.slice(0, p) + text.slice(p + kill)
  return { text: next, pos: p }
}

/** `X` — delete `n` characters backward from cursor. */
export function deleteCharBackwardText(
  text: string,
  pos: number,
  n: number,
): { text: string; pos: number } | null {
  const p = Math.min(Math.max(0, pos), text.length)
  const chop = Math.min(Math.max(1, n), p)
  if (!chop) return null
  const next = text.slice(0, p - chop) + text.slice(p)
  return { text: next, pos: p - chop }
}

/** `Y` — yank from cursor through end of line (no trailing newline). */
export function yankToEOLText(text: string, pos: number): string {
  const p = Math.min(Math.max(0, pos), text.length)
  const { end } = lineBounds(text, p)
  return text.slice(p, end)
}

/** `A` — caret position at end of current line. */
export function appendLineEndPos(text: string, pos: number): number {
  const p = Math.min(Math.max(0, pos), text.length)
  const rest = text.slice(p)
  const nl = rest.indexOf('\n')
  return nl === -1 ? text.length : p + nl
}

/** `o` — open new line below current line. */
export function openLineBelowText(text: string, pos: number): { text: string; pos: number } {
  const p = Math.min(Math.max(0, pos), text.length)
  const nl = text.indexOf('\n', p)
  const insAt = nl === -1 ? text.length : nl
  const next = text.slice(0, insAt) + '\n' + text.slice(insAt)
  return { text: next, pos: insAt + 1 }
}

/** `O` — open new line above current line. */
export function openLineAboveText(text: string, pos: number): { text: string; pos: number } {
  const p = Math.min(Math.max(0, pos), text.length)
  const lineStart = text.lastIndexOf('\n', p - 1) + 1
  const next = text.slice(0, lineStart) + '\n' + text.slice(lineStart)
  return { text: next, pos: lineStart }
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

/** Repeat word motion `steps` times. */
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
