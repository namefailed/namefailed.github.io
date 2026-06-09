import { describe, it, expect, vi, afterEach } from 'vitest'
import { resolveStaticPortfolioHref } from './static-portfolio-href'

describe('resolveStaticPortfolioHref', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns /static/ when window is undefined', () => {
    vi.stubGlobal('window', undefined)
    expect(resolveStaticPortfolioHref()).toBe('/static/')
  })

  it('resolves http origin path', () => {
    vi.stubGlobal('window', {
      location: {
        protocol: 'https:',
        origin: 'https://mrgrey.site',
        href: 'https://mrgrey.site/',
      },
    })
    expect(resolveStaticPortfolioHref()).toBe('https://mrgrey.site/static/')
  })

  it('resolves file: protocol to static/index.html sibling', () => {
    vi.stubGlobal('window', {
      location: {
        protocol: 'file:',
        href: 'file:///C:/Users/dev/index.html',
      },
    })
    expect(resolveStaticPortfolioHref()).toContain('static/index.html')
  })
})
