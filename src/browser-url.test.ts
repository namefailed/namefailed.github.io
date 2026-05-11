import { describe, expect, it } from 'vitest'
import { normalizeBrowserUrl } from './browser-url'

describe('normalizeBrowserUrl', () => {
  it('trims whitespace and rejects empty input', () => {
    expect(normalizeBrowserUrl('   ')).toBe('about:blank')
    expect(normalizeBrowserUrl('')).toBe('about:blank')
  })

  it('keeps valid http(s) URLs', () => {
    expect(normalizeBrowserUrl('https://example.com/foo')).toBe('https://example.com/foo')
    expect(normalizeBrowserUrl('http://127.0.0.1:5173/foo')).toBe('http://127.0.0.1:5173/foo')
  })

  it('prefixes bare hosts with https', () => {
    expect(normalizeBrowserUrl('example.com')).toBe('https://example.com/')
    expect(normalizeBrowserUrl('维基百科.org')).toMatch(/^https:/)
  })

  it('blocks non-http browsing schemes', () => {
    expect(normalizeBrowserUrl('javascript:alert(1)')).toBe('about:blank')
    expect(normalizeBrowserUrl('data:text/html,<p>x</p>')).toBe('about:blank')
    expect(normalizeBrowserUrl('vbscript:x')).toBe('about:blank')
    expect(normalizeBrowserUrl('file:///etc/passwd')).toBe('about:blank')
  })

  it('allows about:blank only', () => {
    expect(normalizeBrowserUrl('about:blank')).toBe('about:blank')
    expect(normalizeBrowserUrl('about:blank#hash')).toBe('about:blank')
    expect(normalizeBrowserUrl('about:config')).toBe('about:blank')
  })
})
