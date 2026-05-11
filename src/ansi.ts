/** ANSI SGR sequences we emit → escaped HTML spans; nested styles use a depth counter. */

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

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}

/** Allow only http(s) and mailto for security (no javascript:, data:, etc.). */
function safeUrlHref(raw: string): string | null {
  const t = raw.replace(/[),.;:!?'"\]]+$/u, '').trim()
  if (!t) return null
  if (t.toLowerCase().startsWith('mailto:')) {
    const rest = t.slice(7).split('?')[0]!
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+/.test(rest)) return `mailto:${rest}`
    return null
  }
  try {
    const u = new URL(t)
    if (u.protocol === 'http:' || u.protocol === 'https:') return u.href
  } catch {
    /* invalid */
  }
  return null
}

/** Portfolio copy often omits schemes; keep list tight to avoid random host false positives */
const BARE_HOST =
  /\b(github\.com\/[a-zA-Z0-9._/-]+|(?:www\.)?linkedin\.com\/[a-zA-Z0-9./-]+\/?|mrgrey\.dev(?:\/[a-zA-Z0-9._/-]*)?\/?)\b/gi

const EMAIL = /\b[a-zA-Z0-9][a-zA-Z0-9._%+-]*@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g

/** Avoid double-links: bare `github.com` inside `https://github.com`, and `user@` inside `mailto:user@`. */
function linkifyBareOrEmailBlocked(input: string, offset: number): boolean {
  if (offset >= 2 && input.slice(offset - 2, offset) === '//') return true
  if (offset >= 7 && input.slice(offset - 7, offset).toLowerCase() === 'mailto:') return true
  return false
}

function linkifyTextSegment(text: string): string {
  let t = text.replace(/\b(https?:\/\/[^\s<"&]+|mailto:[^\s<"&]+)/gi, full => {
    const safe = safeUrlHref(full)
    if (!safe) return full
    return `<a class="terminal-link" href="${escapeAttr(safe)}" target="_blank" rel="noopener noreferrer">${full}</a>`
  })
  t = t.replace(BARE_HOST, (raw, ...args) => {
    const offset = args[args.length - 2] as number
    const input = args[args.length - 1] as string
    if (linkifyBareOrEmailBlocked(input, offset)) return raw
    const hostPath = raw.replace(/^www\./i, '')
    const withScheme = hostPath.startsWith('linkedin.com')
      ? `https://www.${hostPath}`
      : `https://${hostPath}`
    const safe = safeUrlHref(withScheme)
    if (!safe) return raw
    return `<a class="terminal-link" href="${escapeAttr(safe)}" target="_blank" rel="noopener noreferrer">${raw}</a>`
  })
  t = t.replace(EMAIL, (raw, ...args) => {
    const offset = args[args.length - 2] as number
    const input = args[args.length - 1] as string
    if (linkifyBareOrEmailBlocked(input, offset)) return raw
    const mail = safeUrlHref(`mailto:${raw}`)
    if (!mail) return raw
    return `<a class="terminal-link" href="${escapeAttr(mail)}" target="_blank" rel="noopener noreferrer">${raw}</a>`
  })
  return t
}

/**
 * Walk well-formed ANSI→HTML (no angle brackets in text except entities) and linkify
 * only between tags so `href="…"` is never corrupted.
 */
export function linkifyAnsiRenderedHtml(html: string): string {
  const out: string[] = []
  let i = 0
  while (i < html.length) {
    const lt = html.indexOf('<', i)
    if (lt === -1) {
      out.push(linkifyTextSegment(html.slice(i)))
      break
    }
    if (lt > i) out.push(linkifyTextSegment(html.slice(i, lt)))
    const gt = html.indexOf('>', lt)
    if (gt === -1) {
      out.push(html.slice(lt))
      break
    }
    out.push(html.slice(lt, gt + 1))
    i = gt + 1
  }
  return out.join('')
}

/** ANSI → HTML with clickable http(s) and mailto links (new tab, noopener). */
export function ansiToHtmlWithLinks(raw: string): string {
  return linkifyAnsiRenderedHtml(ansiToHtml(raw))
}
