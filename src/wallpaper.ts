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
import { FS_HOME, vfsListEntries, vfsReadRaw } from './os-fs'

export const WALLPAPER_KEY = 'mrgrey-wallpaper'
/** Default wallpaper — calm mocha minimal (shown on first boot). */
export const WALLPAPER_DEFAULT = 'https://raw.githubusercontent.com/zhichaoh/catppuccin-wallpapers/main/minimalistic/mocha.png'

export interface WallpaperOption {
  name: string
  label: string
  url: string
}

/** Max edge length for personalize-grid previews (full URL still used on the desktop). */
export const WALLPAPER_THUMB_MAX_PX = 192

/**
 * Small preview URL for the personalize grid — avoids downloading multi‑MB originals.
 * Remote http(s) images go through wsrv.nl (webp, cover crop); local/data URLs pass through.
 */
export function wallpaperThumbUrl(url: string, maxPx = WALLPAPER_THUMB_MAX_PX): string {
  const trimmed = url.trim()
  if (
    trimmed.startsWith('/') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('radial-gradient') ||
    trimmed.startsWith('linear-gradient')
  ) {
    return trimmed
  }
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return trimmed

  const params = new URLSearchParams({
    url: trimmed,
    w: String(maxPx),
    h: String(Math.round(maxPx * 0.625)),
    fit: 'cover',
    output: 'webp',
    q: '78',
  })
  return `https://wsrv.nl/?${params.toString()}`
}

/** Category label derived from bundled catppuccin-wallpapers paths. */
export function wallpaperCategory(option: WallpaperOption): string {
  const u = option.url
  if (u.includes('/minimalistic/')) return 'Minimalistic'
  if (u.includes('/landscapes/')) return 'Landscapes'
  if (u.includes('/gradients/')) return 'Gradients'
  if (u.includes('/waves/')) return 'Waves'
  if (u.includes('/mandelbrot/')) return 'Mandelbrot'
  if (u.includes('/misc/')) return 'Misc'
  return 'Other'
}

const WALLPAPER_CATEGORY_ORDER = [
  'Minimalistic',
  'Landscapes',
  'Gradients',
  'Waves',
  'Mandelbrot',
  'Misc',
  'Other',
] as const

/** Options grouped for the personalize dialog (stable category order). */
export function listWallpaperOptionsByCategory(): ReadonlyArray<{
  category: string
  options: WallpaperOption[]
}> {
  const buckets = new Map<string, WallpaperOption[]>()
  for (const opt of listWallpaperOptions()) {
    const cat = wallpaperCategory(opt)
    const list = buckets.get(cat) ?? []
    list.push(opt)
    buckets.set(cat, list)
  }
  return WALLPAPER_CATEGORY_ORDER.filter(c => buckets.has(c)).map(category => ({
    category,
    options: buckets.get(category)!,
  }))
}

const WALLPAPER_DIR = `${FS_HOME}/Wallpapers`

/** Bundled wallpapers from the virtual ~/Wallpapers folder (same URLs as file explorer). */
export function listWallpaperOptions(): WallpaperOption[] {
  const res = vfsListEntries(WALLPAPER_DIR)
  if (!res.ok) return []

  const out: WallpaperOption[] = []
  for (const entry of res.entries) {
    if (entry.kind !== 'f') continue
    if (!/\.(png|jpe?g|webp|gif)$/i.test(entry.name)) continue
    const raw = vfsReadRaw(`${WALLPAPER_DIR}/${entry.name}`)
    if (!raw.ok) continue
    const url = raw.body.trim()
    if (!url.startsWith('http') && !url.startsWith('/') && !url.startsWith('data:')) continue
    out.push({
      name: entry.name,
      url,
      label: entry.name
        .replace(/\.[^.]+$/, '')
        .replace(/[-_]+/g, ' ')
        .replace(/\b\w/g, ch => ch.toUpperCase()),
    })
  }
  return out
}

/** Saved wallpaper URL, or the default when nothing is stored yet. */
export function currentWallpaperValue(): string {
  return storageGet(WALLPAPER_KEY) || WALLPAPER_DEFAULT
}

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
