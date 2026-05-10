// ── ansi.ts ───────────────────────────────────────────────────────────────────
// Converts the ANSI escape codes we actually use into safe HTML spans.
// Handles nested open/close correctly via a depth counter.

const COLORS: Record<string, string> = {
  '30': '#45475a',   // black   (Catppuccin Surface1)
  '31': '#f38ba8',   // red
  '32': '#a6e3a1',   // green
  '33': '#f9e2af',   // yellow
  '34': '#89b4fa',   // blue
  '35': '#f5c2e7',   // pink (magenta)
  '36': '#94e2d5',   // cyan
  '37': '#bac2de',   // white
}

export function ansiToHtml(raw: string): string {
  let out   = ''
  let i     = 0
  let depth = 0

  while (i < raw.length) {
    // Check for ESC [
    if (raw[i] === '\x1b' && raw[i + 1] === '[') {
      const m = raw.slice(i).match(/^\x1b\[([0-9;]*)m/)
      if (m) {
        i += m[0].length
        const codes = m[1] === '' ? ['0'] : m[1].split(';')

        for (const code of codes) {
          if (code === '0') {
            if (depth > 0) { out += '</span>'.repeat(depth); depth = 0 }
          } else if (code === '1') {
            out += '<span class="a-bold">'; depth++
          } else if (code === '2') {
            out += '<span class="a-dim">'; depth++
          } else if (COLORS[code]) {
            out += `<span style="color:${COLORS[code]}">`;  depth++
          }
          // 7 (reverse), 27 (un-reverse) — skip; used only by vim cursor
        }
        continue
      }
    }

    // Escape HTML special chars
    const ch = raw[i]
    if      (ch === '<') out += '&lt;'
    else if (ch === '>') out += '&gt;'
    else if (ch === '&') out += '&amp;'
    else                 out += ch
    i++
  }

  if (depth > 0) out += '</span>'.repeat(depth)
  return out
}
