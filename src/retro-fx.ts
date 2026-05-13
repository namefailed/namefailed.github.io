/** Optional CRT-style filter; toggled with `retro` / `retro on|off`. */

import { storageGetBool, storageSetBool } from './storage'

const CLASS = 'retro-fx'
const STORAGE_KEY = 'mrgrey-retro-fx'

export function getRetroFx(): boolean {
  return document.documentElement.classList.contains(CLASS)
}

export function setRetroFx(on: boolean): void {
  document.documentElement.classList.toggle(CLASS, on)
  storageSetBool(STORAGE_KEY, on)
}

/** Restore preference from localStorage (default: off). Call once at startup. */
export function initRetroFxFromStorage(): void {
  setRetroFx(storageGetBool(STORAGE_KEY, false))
}

export function toggleRetroFx(): boolean {
  const next = !getRetroFx()
  setRetroFx(next)
  return next
}
