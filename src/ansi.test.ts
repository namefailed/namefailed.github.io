import { describe, expect, it } from 'vitest'
import { ansiToHtml, ansiToHtmlWithLinks, linkifyAnsiRenderedHtml } from './ansi'

// ─────────────────────────────────────────────────────────────────────────────
// ansiToHtml — HTML escaping
// ─────────────────────────────────────────────────────────────────────────────
describe('ansiToHtml — HTML escaping', () => {
  it('escapes HTML metacharacters in plain text', () => {
    expect(ansiToHtml('<>&')).toBe('&lt;&gt;&amp;')
  })

  it('escapes metacharacters inside styled spans', () => {
    const out = ansiToHtml('\x1b[32m<b>&\x1b[0m')
    expect(out).toContain('&lt;b&gt;&amp;')
    expect(out).not.toContain('<b>')
  })

  it('passes through plain text unchanged when no sequences present', () => {
    expect(ansiToHtml('hello world')).toBe('hello world')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// ansiToHtml — SGR colour codes
// ─────────────────────────────────────────────────────────────────────────────
describe('ansiToHtml — SGR colour rendering', () => {
  it('wraps green (32) and resets with a closing span', () => {
    const out = ansiToHtml('\x1b[32mok\x1b[0m')
    expect(out).toContain('ok')
    expect(out).toContain('color:#a6e3a1')
    expect(out).toMatch(/<\/span>$/)
  })

  it('wraps bold (1) with the a-bold class', () => {
    const out = ansiToHtml('\x1b[1mstrong\x1b[0m')
    expect(out).toContain('class="a-bold"')
    expect(out).toContain('strong')
  })

  it('wraps dim (2) with the a-dim class', () => {
    const out = ansiToHtml('\x1b[2mquiet\x1b[0m')
    expect(out).toContain('class="a-dim"')
    expect(out).toContain('quiet')
  })

  it('renders all 8 standard foreground colours', () => {
    const codes: [string, string][] = [
      ['30', '#45475a'], ['31', '#f38ba8'], ['32', '#a6e3a1'], ['33', '#f9e2af'],
      ['34', '#89b4fa'], ['35', '#f5c2e7'], ['36', '#94e2d5'], ['37', '#bac2de'],
    ]
    for (const [code, hex] of codes) {
      const out = ansiToHtml(`\x1b[${code}mx\x1b[0m`)
      expect(out).toContain(hex)
    }
  })

  it('closes all open spans on reset even when nested', () => {
    // bold + colour — two spans open
    const out = ansiToHtml('\x1b[1m\x1b[32mboth\x1b[0m')
    const opens = (out.match(/<span/g) ?? []).length
    const closes = (out.match(/<\/span>/g) ?? []).length
    expect(closes).toBe(opens)
  })

  it('auto-closes unclosed spans at end of string', () => {
    // No explicit reset
    const out = ansiToHtml('\x1b[34mblue without reset')
    expect(out).toContain('</span>')
  })

  it('handles an empty reset sequence (ESC[m) as a full reset', () => {
    const out = ansiToHtml('\x1b[32mgreen\x1b[mend')
    // After the bare reset, "end" should not be coloured
    expect(out.endsWith('end')).toBe(true)
  })

  it('ignores unknown SGR codes without crashing', () => {
    // Code 99 is unrecognised — should not add a span or throw
    expect(() => ansiToHtml('\x1b[99mtext\x1b[0m')).not.toThrow()
    const out = ansiToHtml('\x1b[99mtext\x1b[0m')
    expect(out).toContain('text')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// ansiToHtmlWithLinks — URL linkification
// ─────────────────────────────────────────────────────────────────────────────
describe('ansiToHtmlWithLinks — URL linkification', () => {
  it('linkifies https URLs in plain text', () => {
    const out = ansiToHtmlWithLinks('open https://example.com/x y')
    expect(out).toContain('class="terminal-link"')
    expect(out).toContain('href="https://example.com/x"')
    expect(out).toContain('rel="noopener noreferrer"')
  })

  it('linkifies allowlisted bare hosts (github.com)', () => {
    const out = ansiToHtmlWithLinks('repo: github.com/namefailed/dotfiles')
    expect(out).toContain('href="https://github.com/namefailed/dotfiles"')
  })

  it('linkifies allowlisted bare hosts (mrgrey.site)', () => {
    const out = ansiToHtmlWithLinks('visit mrgrey.site')
    expect(out).toContain('href="https://mrgrey.site')
  })

  it('linkifies email addresses with mailto:', () => {
    const out = ansiToHtmlWithLinks('mail me at dev@example.com thanks')
    expect(out).toContain('href="mailto:dev@example.com"')
  })

  it('opens links in a new tab with target=_blank', () => {
    const out = ansiToHtmlWithLinks('https://example.com')
    expect(out).toContain('target="_blank"')
  })

  it('does not wrap javascript: URIs', () => {
    const out = ansiToHtmlWithLinks('do not click javascript:alert(1)')
    expect(out).not.toContain('href="javascript:')
  })

  it('does not double-wrap a URL already inside an href', () => {
    const html = '<a href="https://github.com/foo">github.com/foo</a>'
    const out = linkifyAnsiRenderedHtml(html)
    // Should not produce href="...href=..." double nesting
    expect(out).not.toMatch(/href="[^"]*href=/)
  })

  it('does not double-wrap a bare host already prefixed with //', () => {
    const out = ansiToHtmlWithLinks('see https://github.com/namefailed for details')
    const matches = out.match(/href=/g) ?? []
    // Only one href for the https URL
    expect(matches.length).toBe(1)
  })

  it('strips trailing punctuation from URLs', () => {
    const out = ansiToHtmlWithLinks('see https://example.com/foo.')
    // The dot should not be part of the href
    expect(out).toContain('href="https://example.com/foo"')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// linkifyAnsiRenderedHtml — tag-aware linkification
// ─────────────────────────────────────────────────────────────────────────────
describe('linkifyAnsiRenderedHtml — tag-aware linkification', () => {
  it('linkifies text between tags without corrupting the surrounding HTML', () => {
    const html = '<span style="color:#89b4fa">https://a.com</span>'
    const out = linkifyAnsiRenderedHtml(html)
    expect(out).toContain('href="https://a.com/"')
    expect(out).not.toMatch(/href="[^"]*href=/)
  })

  it('handles input with no tags (plain text)', () => {
    const out = linkifyAnsiRenderedHtml('visit https://example.com today')
    expect(out).toContain('href="https://example.com/"')
  })

  it('handles input with no URLs (no links added)', () => {
    const html = '<span class="a-dim">no links here</span>'
    const out = linkifyAnsiRenderedHtml(html)
    expect(out).not.toContain('href=')
    expect(out).toContain('no links here')
  })

  it('preserves tag content verbatim (does not linkify inside attributes)', () => {
    const html = '<a href="https://github.com/foo">label</a>'
    const out = linkifyAnsiRenderedHtml(html)
    // The href inside the tag must survive unchanged
    expect(out).toContain('href="https://github.com/foo"')
  })
})
