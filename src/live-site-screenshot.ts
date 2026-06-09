/** WordPress mShots — slow first load but real page pixels for project cards. */
export function liveSiteScreenshotUrl(web: string): string {
  return `https://s0.wp.com/mshots/v1/${encodeURIComponent(web)}?w=900`
}
