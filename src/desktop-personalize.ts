/**
 * Desktop right-click → Personalize (theme + wallpaper).
 * Reuses `setWallpaper`, theme packs, and VFS ~/Wallpapers catalog.
 */

import { applyTheme, getThemeId, listThemeSummaries } from './theme'
import {
  currentWallpaperValue,
  listWallpaperOptionsByCategory,
  setWallpaper,
  wallpaperThumbUrl,
} from './wallpaper'
import { playOsSound } from './os-sound'

const DESKTOP_SURFACE_SELECTOR =
  '.desktop-tile, .folder-popup, #yasb-bar, #wm-taskbar, #panes, .app-window, .wm-splitter, #launcher-shell'

function isDesktopBackgroundClick(target: EventTarget | null, host: HTMLElement): boolean {
  if (!(target instanceof Element)) return false
  if (!host.contains(target)) return false
  return !target.closest(DESKTOP_SURFACE_SELECTOR)
}

function mountWallpaperThumb(btn: HTMLButtonElement, fullUrl: string, eager: boolean): void {
  const img = document.createElement('img')
  img.className = 'desktop-personalize-wall-img'
  img.alt = ''
  img.width = 192
  img.height = 120
  img.decoding = 'async'
  img.loading = eager ? 'eager' : 'lazy'
  img.fetchPriority = eager ? 'high' : 'auto'
  img.src = wallpaperThumbUrl(fullUrl)

  btn.classList.add('desktop-personalize-wall--loading')

  img.addEventListener('load', () => {
    btn.classList.remove('desktop-personalize-wall--loading')
  })

  img.addEventListener('error', () => {
    if (img.src !== fullUrl) {
      img.src = fullUrl
      return
    }
    btn.classList.remove('desktop-personalize-wall--loading')
    btn.classList.add('desktop-personalize-wall--error')
  })

  btn.appendChild(img)
}

export function initDesktopPersonalize(desktopEl: HTMLElement): void {
  const ctxMenu = document.createElement('div')
  ctxMenu.className = 'desktop-ctx-menu'
  ctxMenu.setAttribute('role', 'menu')
  ctxMenu.hidden = true

  const personalizeItem = document.createElement('button')
  personalizeItem.type = 'button'
  personalizeItem.className = 'desktop-ctx-menu-item'
  personalizeItem.setAttribute('role', 'menuitem')
  personalizeItem.textContent = 'Personalize…'
  ctxMenu.appendChild(personalizeItem)
  document.body.appendChild(ctxMenu)

  const dialog = document.createElement('div')
  dialog.className = 'desktop-personalize'
  dialog.setAttribute('role', 'dialog')
  dialog.setAttribute('aria-modal', 'true')
  dialog.setAttribute('aria-label', 'Personalize desktop')
  dialog.setAttribute('aria-hidden', 'true')

  const backdrop = document.createElement('button')
  backdrop.type = 'button'
  backdrop.className = 'desktop-personalize-backdrop'
  backdrop.setAttribute('aria-label', 'Close personalize')

  const panel = document.createElement('div')
  panel.className = 'desktop-personalize-panel'

  const header = document.createElement('div')
  header.className = 'desktop-personalize-header'

  const title = document.createElement('h2')
  title.className = 'desktop-personalize-title'
  title.textContent = 'Personalize'

  const closeBtn = document.createElement('button')
  closeBtn.type = 'button'
  closeBtn.className = 'desktop-personalize-close'
  closeBtn.setAttribute('aria-label', 'Close')
  closeBtn.textContent = '✕'

  header.append(title, closeBtn)

  const themeSection = document.createElement('section')
  themeSection.className = 'desktop-personalize-section desktop-personalize-section--theme'

  const themeLabel = document.createElement('label')
  themeLabel.className = 'desktop-personalize-label'
  themeLabel.textContent = 'Palette'

  const themeSelect = document.createElement('select')
  themeSelect.className = 'desktop-personalize-theme-select'
  themeSelect.setAttribute('autocomplete', 'off')
  themeLabel.appendChild(themeSelect)
  themeSection.appendChild(themeLabel)

  const wallpaperSection = document.createElement('section')
  wallpaperSection.className =
    'desktop-personalize-section desktop-personalize-section--wallpaper'

  const wallpaperLabel = document.createElement('span')
  wallpaperLabel.className = 'desktop-personalize-label'
  wallpaperLabel.textContent = 'Wallpaper'

  const wallpaperScroll = document.createElement('div')
  wallpaperScroll.className = 'desktop-personalize-wall-scroll'

  wallpaperSection.append(wallpaperLabel, wallpaperScroll)

  panel.append(header, themeSection, wallpaperSection)
  dialog.append(backdrop, panel)
  document.body.appendChild(dialog)

  let ctxOpen = false
  let dialogOpen = false
  let activeWallBtn: HTMLButtonElement | null = null
  let wallpaperGridBuilt = false

  const syncThemeSelect = (): void => {
    const cur = getThemeId()
    if ([...themeSelect.options].some(o => o.value === cur)) themeSelect.value = cur
  }

  const buildThemeSelect = (): void => {
    themeSelect.replaceChildren()
    for (const { id, label } of listThemeSummaries()) {
      const opt = document.createElement('option')
      opt.value = id
      opt.textContent = label
      themeSelect.appendChild(opt)
    }
    syncThemeSelect()
  }

  const markWallpaperActive = (url: string): void => {
    activeWallBtn?.classList.remove('desktop-personalize-wall--active')
    activeWallBtn?.setAttribute('aria-selected', 'false')
    activeWallBtn =
      wallpaperScroll.querySelector<HTMLButtonElement>(`[data-wall-url="${CSS.escape(url)}"]`) ??
      null
    activeWallBtn?.classList.add('desktop-personalize-wall--active')
    activeWallBtn?.setAttribute('aria-selected', 'true')
  }

  const buildWallpaperGrid = (): void => {
    if (wallpaperGridBuilt) {
      markWallpaperActive(currentWallpaperValue())
      return
    }

    wallpaperScroll.replaceChildren()
    const activeUrl = currentWallpaperValue()

    for (const group of listWallpaperOptionsByCategory()) {
      const groupEl = document.createElement('div')
      groupEl.className = 'desktop-personalize-wall-group'

      const groupTitle = document.createElement('h3')
      groupTitle.className = 'desktop-personalize-wall-group-title'
      groupTitle.textContent = group.category
      groupEl.appendChild(groupTitle)

      const grid = document.createElement('div')
      grid.className = 'desktop-personalize-wall-grid'
      grid.setAttribute('role', 'listbox')
      grid.setAttribute('aria-label', `${group.category} wallpapers`)

      for (const wp of group.options) {
        const btn = document.createElement('button')
        btn.type = 'button'
        btn.className = 'desktop-personalize-wall'
        btn.dataset.wallUrl = wp.url
        btn.setAttribute('role', 'option')
        btn.setAttribute('aria-selected', wp.url === activeUrl ? 'true' : 'false')
        btn.title = wp.label

        mountWallpaperThumb(btn, wp.url, wp.url === activeUrl)

        const cap = document.createElement('span')
        cap.className = 'desktop-personalize-wall-label'
        cap.textContent = wp.label
        btn.appendChild(cap)

        const check = document.createElement('span')
        check.className = 'desktop-personalize-wall-check'
        check.setAttribute('aria-hidden', 'true')
        check.textContent = '✓'
        btn.appendChild(check)

        btn.addEventListener('click', () => {
          setWallpaper(wp.url)
          markWallpaperActive(wp.url)
          playOsSound('click')
        })

        grid.appendChild(btn)
        if (wp.url === activeUrl) activeWallBtn = btn
      }

      groupEl.appendChild(grid)
      wallpaperScroll.appendChild(groupEl)
    }

    activeWallBtn?.classList.add('desktop-personalize-wall--active')
    wallpaperGridBuilt = true
  }

  const closeCtxMenu = (): void => {
    if (!ctxOpen) return
    ctxOpen = false
    ctxMenu.hidden = true
  }

  const openCtxMenu = (x: number, y: number): void => {
    closePersonalizeDialog()
    ctxOpen = true
    ctxMenu.hidden = false

    const pad = 8
    const rect = ctxMenu.getBoundingClientRect()
    let left = x
    let top = y
    left = Math.max(pad, Math.min(left, window.innerWidth - rect.width - pad))
    top = Math.max(pad, Math.min(top, window.innerHeight - rect.height - pad))
    ctxMenu.style.left = `${left}px`
    ctxMenu.style.top = `${top}px`
  }

  const closePersonalizeDialog = (): void => {
    if (!dialogOpen) return
    dialogOpen = false
    dialog.classList.remove('desktop-personalize--open')
    dialog.setAttribute('aria-hidden', 'true')
  }

  const openPersonalizeDialog = (): void => {
    closeCtxMenu()
    buildThemeSelect()
    buildWallpaperGrid()
    dialogOpen = true
    dialog.classList.add('desktop-personalize--open')
    dialog.setAttribute('aria-hidden', 'false')
    themeSelect.focus()
    playOsSound('click')
  }

  buildThemeSelect()

  desktopEl.addEventListener('contextmenu', e => {
    if (!isDesktopBackgroundClick(e.target, desktopEl)) return
    e.preventDefault()
    openCtxMenu(e.clientX, e.clientY)
  })

  personalizeItem.addEventListener('click', () => openPersonalizeDialog())

  themeSelect.addEventListener('change', () => {
    const id = themeSelect.value
    if (!id || id === getThemeId()) return
    if (!applyTheme(id)) {
      syncThemeSelect()
      return
    }
    playOsSound('click')
  })

  window.addEventListener('mrgrey-open-personalize', () => openPersonalizeDialog())

  closeBtn.addEventListener('click', () => {
    closePersonalizeDialog()
    playOsSound('click')
  })

  backdrop.addEventListener('click', () => closePersonalizeDialog())

  window.addEventListener('mrgrey-theme-change', syncThemeSelect)

  window.addEventListener('mrgrey-wallpaper-change', () => {
    if (!dialogOpen) return
    markWallpaperActive(currentWallpaperValue())
  })

  document.addEventListener(
    'pointerdown',
    e => {
      if (ctxOpen && !ctxMenu.contains(e.target as Node)) closeCtxMenu()
    },
    true,
  )

  document.addEventListener(
    'keydown',
    e => {
      if (e.key !== 'Escape') return
      if (dialogOpen) {
        closePersonalizeDialog()
        e.stopPropagation()
        return
      }
      if (ctxOpen) closeCtxMenu()
    },
    true,
  )

  window.addEventListener('resize', () => closeCtxMenu())
  window.addEventListener('blur', () => closeCtxMenu())
}
