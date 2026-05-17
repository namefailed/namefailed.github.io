/**
 * Desktop wallpaper — apply a URL or CSS gradient string to #desktop-workspace
 * and persist the choice to localStorage so it survives page reloads.
 *
 * Wallpaper files in the VFS (e.g. ~/wallpapers/mocha.jpg) store a plain URL
 * string as their body.  The file-explorer reads that body and passes it here.
 */

const WALLPAPER_KEY = 'mrgrey-wallpaper'

/** Apply a wallpaper value to the desktop workspace element.
 *  Accepts a full URL (http / data:) or any CSS <image> value (gradient). */
export function applyWallpaper(value: string): void {
  const el = document.getElementById('desktop-workspace')
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

/** Apply a wallpaper and persist it to localStorage. */
export function setWallpaper(value: string): void {
  applyWallpaper(value)
  window.localStorage.setItem(WALLPAPER_KEY, value.trim())
}

/** Remove the wallpaper (revert to the CSS background-color from the theme). */
export function clearWallpaper(): void {
  const el = document.getElementById('desktop-workspace')
  if (el) {
    el.style.backgroundImage    = ''
    el.style.backgroundSize     = ''
    el.style.backgroundPosition = ''
    el.style.backgroundRepeat   = ''
  }
  window.localStorage.removeItem(WALLPAPER_KEY)
}

/** Read any saved wallpaper from localStorage and apply it on startup. */
export function loadSavedWallpaper(): void {
  const saved = window.localStorage.getItem(WALLPAPER_KEY)
  if (saved) applyWallpaper(saved)
}
