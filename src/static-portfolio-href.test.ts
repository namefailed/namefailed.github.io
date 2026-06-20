import { describe, it, expect, vi, afterEach } from 'vitest'
import { resolveDesktopShellHref, resolveStaticPortfolioHref } from './static-portfolio-href'

describe('resolveDesktopShellHref', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('returns / when window is undefined', () => {
    vi.stubGlobal('window', undefined)
    expect(resolveDesktopShellHref()).toBe('/')
  })

  it('resolves http origin root', () => {
    vi.stubGlobal('window', {
      location: {
        protocol: 'https:',
        origin: 'https://mrgrey.site',
        href: 'https://mrgrey.site/static/',
      },
    })
    expect(resolveDesktopShellHref()).toBe('https://mrgrey.site/')
  })

  it('resolves file: protocol to parent index.html', () => {
    vi.stubGlobal('window', {
      location: {
        protocol: 'file:',
        href: 'file:///C:/Users/dev/static/index.html',
      },
    })
    expect(resolveDesktopShellHref()).toContain('index.html')
    expect(resolveDesktopShellHref()).not.toContain('static')
  })

  it('falls back to parent index.html when origin is an invalid URL base', () => {
    // Non-file: protocol with a bogus origin makes `new URL(basePath, origin)`
    // throw, exercising the catch fallback against location.href.
    vi.stubGlobal('window', {
      location: {
        protocol: 'https:',
        origin: 'not-a-valid-origin',
        href: 'https://mrgrey.site/static/index.html',
      },
    })
    expect(resolveDesktopShellHref()).toBe('https://mrgrey.site/index.html')
  })

  it('appends a trailing slash to a BASE_URL that lacks one', () => {
    // BASE_URL without a trailing slash exercises the ternary else-branch.
    vi.stubEnv('BASE_URL', '/repo')
    vi.stubGlobal('window', {
      location: {
        protocol: 'https:',
        origin: 'https://mrgrey.site',
        href: 'https://mrgrey.site/repo/static/',
      },
    })
    expect(resolveDesktopShellHref()).toBe('https://mrgrey.site/repo/')
  })

  it('falls back to "/" base when BASE_URL is undefined', () => {
    // Undefined BASE_URL exercises the `?? '/'` nullish fallback.
    vi.stubEnv('BASE_URL', undefined as unknown as string)
    vi.stubGlobal('window', {
      location: {
        protocol: 'https:',
        origin: 'https://mrgrey.site',
        href: 'https://mrgrey.site/static/',
      },
    })
    expect(resolveDesktopShellHref()).toBe('https://mrgrey.site/')
  })
})

describe('resolveStaticPortfolioHref', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
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

  it('falls back to static/index.html sibling when origin is an invalid URL base', () => {
    // Non-file: protocol with a bogus origin makes `new URL(pathSegments, origin)`
    // throw, exercising the catch fallback resolved against location.href.
    vi.stubGlobal('window', {
      location: {
        protocol: 'https:',
        origin: 'not-a-valid-origin',
        href: 'https://mrgrey.site/sub/page.html',
      },
    })
    expect(resolveStaticPortfolioHref()).toBe('https://mrgrey.site/sub/static/index.html')
  })

  it('appends a trailing slash to a BASE_URL that lacks one', () => {
    // BASE_URL without a trailing slash exercises the ternary else-branch.
    vi.stubEnv('BASE_URL', '/repo')
    vi.stubGlobal('window', {
      location: {
        protocol: 'https:',
        origin: 'https://mrgrey.site',
        href: 'https://mrgrey.site/repo/',
      },
    })
    expect(resolveStaticPortfolioHref()).toBe('https://mrgrey.site/repo/static/')
  })

  it('falls back to "/" base when BASE_URL is undefined', () => {
    // Undefined BASE_URL exercises the `?? '/'` nullish fallback.
    vi.stubEnv('BASE_URL', undefined as unknown as string)
    vi.stubGlobal('window', {
      location: {
        protocol: 'https:',
        origin: 'https://mrgrey.site',
        href: 'https://mrgrey.site/',
      },
    })
    expect(resolveStaticPortfolioHref()).toBe('https://mrgrey.site/static/')
  })
})
