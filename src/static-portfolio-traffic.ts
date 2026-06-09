/**
 * Redirect recruiter / social traffic to the readable `/static/` brochure.
 * Runs synchronously before the shell boots (see `index.html`).
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
