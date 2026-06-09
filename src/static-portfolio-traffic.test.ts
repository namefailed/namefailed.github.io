import { describe, it, expect } from 'vitest'
import {
  shouldRedirectToStaticPortfolio,
  staticPortfolioRedirectUrl,
} from './static-portfolio-traffic'

describe('shouldRedirectToStaticPortfolio', () => {
  it('skips when already on /static/', () => {
    expect(shouldRedirectToStaticPortfolio('/static/', '?ref=linkedin', '')).toBe(false)
    expect(shouldRedirectToStaticPortfolio('/static/index.html', '', '')).toBe(false)
  })

  it('redirects for recruiter query params', () => {
    expect(shouldRedirectToStaticPortfolio('/', '?ref=linkedin', '')).toBe(true)
    expect(shouldRedirectToStaticPortfolio('/', '?utm_source=indeed', '')).toBe(true)
    expect(shouldRedirectToStaticPortfolio('/', '?view=classic', '')).toBe(true)
  })

  it('redirects for known job-board referrers', () => {
    expect(
      shouldRedirectToStaticPortfolio('/', '', 'https://www.linkedin.com/in/foo'),
    ).toBe(true)
  })

  it('does not redirect for normal traffic', () => {
    expect(shouldRedirectToStaticPortfolio('/', '', 'https://google.com/')).toBe(false)
    expect(shouldRedirectToStaticPortfolio('/', '', '')).toBe(false)
  })
})

describe('staticPortfolioRedirectUrl', () => {
  it('preserves query string on /static/', () => {
    expect(staticPortfolioRedirectUrl('https://mrgrey.site', '?ref=linkedin')).toBe(
      'https://mrgrey.site/static/?ref=linkedin',
    )
  })

  it('uses trailing slash when no query', () => {
    expect(staticPortfolioRedirectUrl('https://mrgrey.site', '')).toBe(
      'https://mrgrey.site/static/',
    )
  })
})
