// ── retro-fx.ts ───────────────────────────────────────────────────────────────
// CRT-style overlays (off by default). Toggle with `retro` / `retro on|off`.

const CLASS = 'retro-fx'
const STORAGE_KEY = 'mrgrey-retro-fx'

export function getRetroFx(): boolean {
  return document.documentElement.classList.contains(CLASS)
}

export function setRetroFx(on: boolean): void {
  document.documentElement.classList.toggle(CLASS, on)
  try {
    localStorage.setItem(STORAGE_KEY, on ? '1' : '0')
  } catch {
    /* private mode / quota */
  }
}

/** Restore preference from localStorage (default: off). Call once at startup. */
export function initRetroFxFromStorage(): void {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    setRetroFx(v === '1')
  } catch {
    setRetroFx(false)
  }
}

export function toggleRetroFx(): boolean {
  const next = !getRetroFx()
  setRetroFx(next)
  return next
}
