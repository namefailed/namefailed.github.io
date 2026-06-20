/**
 * Pure buffer mutation helpers for the modal editor (vim-like).
 *
 * Contract: every edit returns `{ text, pos }` or `null` when a no-op.
 * Callers (`editor-window`, tests) own DOM, undo stack, and mode transitions.
 */

import { getLineCol, lineBounds } from './editor-vim-motions'

export type BufferEditResult = { text: string; pos: number }

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
): BufferEditResult | null {
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

export function deleteThroughEOLText(text: string, pos: number): BufferEditResult {
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
): BufferEditResult | null {
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
): BufferEditResult | null {
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
): BufferEditResult | null {
  if (!yank) return null
  const { start, end } = lineBounds(text, pos)
  // `p` on the final line, which has no trailing newline: open a real line
  // below instead of gluing the yank onto the current line. Synthesize the
  // separator and drop the yank's own trailing newline — otherwise the buffer
  // ends with a blank last line.
  if (afterLine && !(end < text.length && text[end] === '\n')) {
    const sep = text.length > 0 ? '\n' : ''
    const body = sep + (yank.endsWith('\n') ? yank.slice(0, -1) : yank)
    return { text: text + body, pos: text.length + sep.length }
  }
  const ins = afterLine ? end + 1 : start
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
): BufferEditResult | null {
  const p0 = Math.min(Math.max(0, pos), text.length)
  const li = text.slice(0, p0).split('\n').length - 1
  const lines = text.split('\n')
  if (li < 0 || li >= lines.length) return null
  const take = Math.max(1, Math.min(nLines, lines.length - li))
  for (let j = 0; j < take; j++) lines[li + j] = indent + (lines[li + j] ?? '')
  const next = lines.join('\n')
  // The caret sits on the first indented line, so it always shifts one indent right.
  return { text: next, pos: p0 + indent.length }
}

/** `<<` — unindent `nLines` from caret line downward. */
export function unindentLinesText(
  text: string,
  pos: number,
  nLines: number,
): BufferEditResult | null {
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
): BufferEditResult | null {
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
): BufferEditResult | null {
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
): BufferEditResult | null {
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
): BufferEditResult | null {
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

/** `o` — open new line below current line. */
export function openLineBelowText(text: string, pos: number): BufferEditResult {
  const p = Math.min(Math.max(0, pos), text.length)
  const nl = text.indexOf('\n', p)
  const insAt = nl === -1 ? text.length : nl
  const next = text.slice(0, insAt) + '\n' + text.slice(insAt)
  return { text: next, pos: insAt + 1 }
}

/** `O` — open new line above current line. */
export function openLineAboveText(text: string, pos: number): BufferEditResult {
  const p = Math.min(Math.max(0, pos), text.length)
  const lineStart = text.lastIndexOf('\n', p - 1) + 1
  const next = text.slice(0, lineStart) + '\n' + text.slice(lineStart)
  return { text: next, pos: lineStart }
}

/** Line number (1-based) at `pos` — convenience for edit helpers. */
export function lineIndexOneBased(text: string, pos: number): number {
  return getLineCol(text, pos).line
}
