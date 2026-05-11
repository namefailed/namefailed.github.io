import { describe, expect, it } from 'vitest'
import { ansiToHtml, ansiToHtmlWithLinks, linkifyAnsiRenderedHtml } from './ansi'

describe('ansiToHtml', () => {
  it('escapes HTML metacharacters', () => {
    expect(ansiToHtml('<>&')).toBe('&lt;&gt;&amp;')
  })

  it('wraps green SGR and resets', () => {
    const out = ansiToHtml('\x1b[32mok\x1b[0m')
    expect(out).toContain('ok')
    expect(out).toContain('color:#a6e3a1')
    expect(out).toMatch(/<\/span>$/)
  })
})

describe('ansiToHtmlWithLinks', () => {
  it('linkifies https URLs in plain text', () => {
    const out = ansiToHtmlWithLinks('open https://example.com/x y')
    expect(out).toContain('class="terminal-link"')
    expect(out).toContain('href="https://example.com/x"')
    expect(out).toContain('rel="noopener noreferrer"')
  })

  it('linkifies allowlisted bare hosts', () => {
    const out = ansiToHtmlWithLinks('repo: github.com/namefailed/dotfiles')
    expect(out).toContain('href="https://github.com/namefailed/dotfiles"')
  })

  it('linkifies email addresses', () => {
    const out = ansiToHtmlWithLinks('mail me at dev@example.com thanks')
    expect(out).toContain('href="mailto:dev@example.com"')
  })

  it('does not wrap javascript: as a link', () => {
    const out = ansiToHtmlWithLinks('do not click javascript:alert(1)')
    expect(out).not.toContain('href="javascript:')
  })
})

describe('linkifyAnsiRenderedHtml', () => {
  it('skips text inside tags so href attributes stay intact', () => {
    const html = '<span style="color:#89b4fa">https://a.com</span>'
    const out = linkifyAnsiRenderedHtml(html)
    expect(out).toContain('href="https://a.com/"')
    expect(out).not.toMatch(/href="[^"]*href=/)
  })
})
