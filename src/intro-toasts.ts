/**
 * Cascading welcome toasts on first visit. Uses existing pushToast plumbing.
 * Gated by localStorage["mrgrey-toasts-seen"]. Replayed by `cookies clear`.
 */

export const INTRO_TOASTS_KEY = 'mrgrey-toasts-seen'

export const INTRO_TOASTS: ReadonlyArray<string> = [
  "👋 Hey, I'm Matt — welcome to my portfolio OS.",
  'Click the pink tiles to see my work — or drag them around.',
  'Tools & games are below. Try whatever catches your eye.',
  'Ctrl+D opens the launcher. Run cookies clear to replay this intro.',
]

export interface IntroToastsOptions {
  /** Injectable push function; in production pass pushToast from os-systray. */
  push: (message: string, durationMs?: number) => void
  /** ms between toasts. Default 1200. */
  gapMs?: number
  /** ms each toast stays visible. Default 4200. */
  durationMs?: number
}

export async function runIntroToasts(opts: IntroToastsOptions): Promise<void> {
  if (window.localStorage.getItem(INTRO_TOASTS_KEY) === '1') return

  const gap = opts.gapMs ?? 1200
  const dur = opts.durationMs ?? 4200

  for (let i = 0; i < INTRO_TOASTS.length; i++) {
    opts.push(INTRO_TOASTS[i], dur)
    if (i < INTRO_TOASTS.length - 1) await wait(gap)
  }

  window.localStorage.setItem(INTRO_TOASTS_KEY, '1')
}

function wait(ms: number): Promise<void> {
  return new Promise(r => window.setTimeout(r, ms))
}
