/** Motion helpers for the /static/ brochure — respect prefers-reduced-motion. */

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function animateCounter(
  numEl: { textContent: string | null },
  target: number,
  suffix: string,
  durationMs = 950,
  raf: (cb: (now: number) => void) => number = (cb) => requestAnimationFrame(cb),
): void {
  if (prefersReducedMotion()) {
    numEl.textContent = `${target}${suffix}`
    return
  }
  let startMs: number | null = null
  const step = (now: number): void => {
    if (startMs === null) startMs = now
    const t = Math.min(1, (now - startMs) / durationMs)
    const eased = 1 - Math.pow(1 - t, 3)
    numEl.textContent = `${Math.round(eased * target)}${suffix}`
    if (t < 1) raf(step)
  }
  raf(step)
}

export function typewriter(
  target: HTMLElement,
  text: string,
  opts: {
    speedMs?: number
    delayMs?: number
    schedule?: (fn: () => void, ms: number) => number
    createCursor?: () => HTMLElement
  } = {},
): void {
  if (prefersReducedMotion()) {
    target.textContent = text
    return
  }
  const speedMs = opts.speedMs ?? 22
  const delayMs = opts.delayMs ?? 750
  const schedule = opts.schedule ?? ((fn, ms) => window.setTimeout(fn, ms))
  const createCursor = opts.createCursor ?? (() => {
    const c = document.createElement('span')
    c.className = 'plain-cursor'
    return c
  })

  target.textContent = ''
  const cursor = createCursor()
  target.appendChild(cursor)
  let i = 0
  const tick = (): void => {
    if (i < text.length) {
      cursor.insertAdjacentText('beforebegin', text[i++]!)
      schedule(tick, speedMs + Math.random() * 14)
    } else {
      schedule(() => cursor.classList.add('plain-cursor--done'), 2400)
    }
  }
  schedule(tick, delayMs)
}
