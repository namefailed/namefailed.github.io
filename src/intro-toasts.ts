/**
 * Cascading welcome toasts on first visit. Uses existing pushToast plumbing.
 * Gated by localStorage["mrgrey-toasts-seen"]. Replayed by `cookies clear`.
 */

export const INTRO_TOASTS_KEY = 'mrgrey-toasts-seen'

export const INTRO_TOASTS: ReadonlyArray<string> = [
  "👋 Hey, I'm Matt — welcome to my portfolio OS.",
  'Open the Portfolio folder to see my work, or drag it anywhere.',
  'The Apps folder has tools & games. Try whatever catches your eye.',
  'Ctrl+D opens the launcher. Run cookies clear to replay this intro.',
]

export interface IntroToastsOptions {
  /** Injectable push function; in production pass pushToast from os-systray. */
  push: (message: string, durationMs?: number) => void
  /** ms between toasts. Default 1200. */
  gapMs?: number
}

export async function runIntroToasts(opts: IntroToastsOptions): Promise<void> {
  if (window.localStorage.getItem(INTRO_TOASTS_KEY) === '1') return

  const gap = opts.gapMs ?? 1200

  for (let i = 0; i < INTRO_TOASTS.length; i++) {
    // Pass 0 → sticky: toasts stay until the user clicks them
    opts.push(INTRO_TOASTS[i], 0)
    if (i < INTRO_TOASTS.length - 1) await wait(gap)
  }

  window.localStorage.setItem(INTRO_TOASTS_KEY, '1')
}

function wait(ms: number): Promise<void> {
  return new Promise(r => window.setTimeout(r, ms))
}
