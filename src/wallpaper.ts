/**
 * Desktop wallpaper — apply a URL or CSS gradient string to #desktop
 * and persist the choice to localStorage so it survives page reloads.
 *
 * Dispatches 'mrgrey-wallpaper-change' (CustomEvent<string | null>) so that
 * matrix-bg.ts can keep its canvas backdrop in sync without a direct import.
 *
 * Wallpaper files in the VFS (e.g. ~/Wallpapers/mocha.jpg) store a plain URL
 * string as their body.  The file-explorer reads that body and passes it here.
 */

import { storageGet, storageSet, storageRemove } from './storage'

export const WALLPAPER_KEY = 'mrgrey-wallpaper'
/** Default wallpaper — Mandelbrot lavender (shown on first boot). */
export const WALLPAPER_DEFAULT = 'https://raw.githubusercontent.com/zhichaoh/catppuccin-wallpapers/main/mandelbrot/mandelbrot_full_lavender.png'

/** Apply a wallpaper value to the #desktop element (the wallpaper layer).
 *  Targets #desktop rather than #desktop-workspace so the matrix canvas and
 *  yasb-bar are not covered, and the new image replaces the existing background.
 *  Accepts a full URL (http / data:) or any CSS <image> value (gradient). */
export function applyWallpaper(value: string): void {
  const el = document.getElementById('desktop')
  if (!el) return
  const trimmed = value.trim()
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('data:')
  ) {
    el.style.backgroundImage = `url("${trimmed}")`
  } else {
    // CSS gradient or other <image> value
    el.style.backgroundImage = trimmed
  }
  el.style.backgroundSize     = 'cover'
  el.style.backgroundPosition = 'center'
  el.style.backgroundRepeat   = 'no-repeat'
}

/** Apply a wallpaper, persist it, and notify listeners (e.g. matrix-bg). */
export function setWallpaper(value: string): void {
  applyWallpaper(value)
  const trimmed = value.trim()
  storageSet(WALLPAPER_KEY, trimmed)
  window.dispatchEvent(new CustomEvent<string>('mrgrey-wallpaper-change', { detail: trimmed }))
}

/** Remove the wallpaper (revert #desktop to its stylesheet background-image). */
export function clearWallpaper(): void {
  const el = document.getElementById('desktop')
  if (el) {
    el.style.backgroundImage    = ''
    el.style.backgroundSize     = ''
    el.style.backgroundPosition = ''
    el.style.backgroundRepeat   = ''
  }
  storageRemove(WALLPAPER_KEY)
  window.dispatchEvent(new CustomEvent<null>('mrgrey-wallpaper-change', { detail: null }))
}

/** Read any saved wallpaper from localStorage and apply it on startup.
 *  Falls back to WALLPAPER_DEFAULT when no preference has been saved. */
export function loadSavedWallpaper(): void {
  const saved = storageGet(WALLPAPER_KEY)
  applyWallpaper(saved || WALLPAPER_DEFAULT)
}
