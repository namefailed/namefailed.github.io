/**
 * Recruiter / social → `/static/` brochure redirect logic. The live redirect is a
 * hand-mirrored copy inlined in `index.html` (it has to run before the ES module
 * bundle loads, or the desktop flashes before redirecting). This module is the
 * unit-tested reference for that logic — keep the two in sync.
 */

const RECRUITER_QUERY = /\b(?:ref|utm_source|from)=(linkedin|indeed|glassdoor|hiring|jobs|recruiter|job)\b/i
const RECRUITER_VIEW = /\bview=(classic|static|resume)\b/i
const RECRUITER_REFERRER = /linkedin\.com|indeed\.com|glassdoor\.com|jobs\.lever\.co|greenhouse\.io/i

export function shouldRedirectToStaticPortfolio(
  pathname: string,
  search: string,
  referrer: string,
): boolean {
  if (/\/static(\/|$)/.test(pathname)) return false
  if (RECRUITER_VIEW.test(search)) return true
  if (RECRUITER_QUERY.test(search)) return true
  if (referrer && RECRUITER_REFERRER.test(referrer)) return true
  return false
}

export function staticPortfolioRedirectUrl(origin: string, search: string): string {
  const qs = search && search.length > 0 ? search : ''
  return `${origin}/static/${qs}`
}
