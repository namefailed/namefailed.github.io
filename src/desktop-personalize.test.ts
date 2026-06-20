// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// --- Mock wallpaper module: deterministic catalog + spies, no VFS / network. ---
const WALL_A = 'https://example.com/minimalistic/a.png'
const WALL_B = 'https://example.com/landscapes/b.png'
let currentWall = WALL_A

vi.mock('./wallpaper', () => ({
  currentWallpaperValue: () => currentWall,
  listWallpaperOptionsByCategory: () => [
    {
      category: 'Minimalistic',
      options: [{ name: 'a.png', label: 'Alpha', url: WALL_A }],
    },
    {
      category: 'Landscapes',
      options: [{ name: 'b.png', label: 'Beta', url: WALL_B }],
    },
  ],
  setWallpaper: vi.fn((url: string) => {
    currentWall = url
  }),
  wallpaperThumbUrl: (url: string) => `thumb:${url}`,
}))

// --- Mock os-sound: avoid AudioContext, observe calls. ---
vi.mock('./os-sound', () => ({
  playOsSound: vi.fn(),
}))

import { initDesktopPersonalize } from './desktop-personalize'
import { setWallpaper } from './wallpaper'
import { playOsSound } from './os-sound'
import { applyTheme, getThemeId } from './theme'

const setWallpaperMock = vi.mocked(setWallpaper)
const playOsSoundMock = vi.mocked(playOsSound)

function makeDesktop(): HTMLElement {
  const el = document.createElement('div')
  el.id = 'desktop-workspace'
  document.body.appendChild(el)
  return el
}

const dialog = () => document.querySelector<HTMLElement>('.desktop-personalize')!
const ctxMenu = () => document.querySelector<HTMLElement>('.desktop-ctx-menu')!
const personalizeItem = () =>
  document.querySelector<HTMLButtonElement>('.desktop-ctx-menu-item')!
const themeSelect = () =>
  document.querySelector<HTMLSelectElement>('.desktop-personalize-theme-select')!
const wallScroll = () =>
  document.querySelector<HTMLElement>('.desktop-personalize-wall-scroll')!

function rightClick(el: Element, x = 100, y = 100): void {
  const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
  Object.defineProperty(ev, 'target', { value: el })
  Object.defineProperty(ev, 'clientX', { value: x })
  Object.defineProperty(ev, 'clientY', { value: y })
  el.dispatchEvent(ev)
}

describe('initDesktopPersonalize', () => {
  beforeEach(() => {
    currentWall = WALL_A
    document.body.replaceChildren()
    document.documentElement.removeAttribute('data-theme')
    localStorage.clear()
    applyTheme('mocha')
    setWallpaperMock.mockClear()
    playOsSoundMock.mockClear()
    // Stable viewport for clamp math.
    Object.defineProperty(window, 'innerWidth', { value: 1000, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true })
  })

  afterEach(() => {
    document.body.replaceChildren()
  })

  it('mounts context menu and dialog into the body, hidden by default', () => {
    initDesktopPersonalize(makeDesktop())

    const menu = ctxMenu()
    expect(menu).not.toBeNull()
    expect(menu.getAttribute('role')).toBe('menu')
    expect(menu.hidden).toBe(true)
    expect(personalizeItem().textContent).toBe('Personalize…')

    const d = dialog()
    expect(d.getAttribute('role')).toBe('dialog')
    expect(d.getAttribute('aria-modal')).toBe('true')
    expect(d.getAttribute('aria-hidden')).toBe('true')
    expect(d.classList.contains('desktop-personalize--open')).toBe(false)
  })

  it('builds the theme select from theme packs on init and selects the active id', () => {
    initDesktopPersonalize(makeDesktop())
    const sel = themeSelect()
    const values = [...sel.options].map(o => o.value)
    expect(values).toContain('mocha')
    expect(values).toContain('dracula')
    expect(values.length).toBeGreaterThan(1)
    expect(sel.value).toBe('mocha')
  })

  it('opens the context menu on background right-click and clamps within viewport', () => {
    initDesktopPersonalize(makeDesktop())
    const desktop = document.getElementById('desktop-workspace')!

    rightClick(desktop, 100, 120)

    const menu = ctxMenu()
    expect(menu.hidden).toBe(false)
    // happy-dom getBoundingClientRect returns zeros, so clamp leaves x/y as-is (>= pad 8).
    expect(menu.style.left).toBe('100px')
    expect(menu.style.top).toBe('120px')
  })

  it('clamps the context menu position to the top-left padding for negative coords', () => {
    initDesktopPersonalize(makeDesktop())
    const desktop = document.getElementById('desktop-workspace')!
    rightClick(desktop, -50, -30)
    const menu = ctxMenu()
    expect(menu.style.left).toBe('8px')
    expect(menu.style.top).toBe('8px')
  })

  it('does not open the context menu when right-clicking a desktop surface element', () => {
    initDesktopPersonalize(makeDesktop())
    const desktop = document.getElementById('desktop-workspace')!
    const win = document.createElement('div')
    win.className = 'app-window'
    desktop.appendChild(win)

    rightClick(win)
    expect(ctxMenu().hidden).toBe(true)
  })

  it('ignores a right-click whose target is not an Element (e.g. the document)', () => {
    initDesktopPersonalize(makeDesktop())
    const desktop = document.getElementById('desktop-workspace')!
    const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    Object.defineProperty(ev, 'target', { value: null })
    desktop.dispatchEvent(ev)
    expect(ctxMenu().hidden).toBe(true)
  })

  it('ignores right-clicks on targets outside the desktop host', () => {
    initDesktopPersonalize(makeDesktop())
    const outside = document.createElement('div')
    document.body.appendChild(outside)
    rightClick(outside)
    expect(ctxMenu().hidden).toBe(true)
  })

  it('opens the dialog from the Personalize menu item, building the wallpaper grid', () => {
    initDesktopPersonalize(makeDesktop())
    const desktop = document.getElementById('desktop-workspace')!
    rightClick(desktop)
    expect(ctxMenu().hidden).toBe(false)

    personalizeItem().click()

    const d = dialog()
    expect(d.classList.contains('desktop-personalize--open')).toBe(true)
    expect(d.getAttribute('aria-hidden')).toBe('false')
    // Opening closes the context menu.
    expect(ctxMenu().hidden).toBe(true)
    // Sound feedback on open.
    expect(playOsSoundMock).toHaveBeenCalledWith('click')

    // Grid built: two categories, two buttons.
    const groups = wallScroll().querySelectorAll('.desktop-personalize-wall-group')
    expect(groups.length).toBe(2)
    const buttons = wallScroll().querySelectorAll<HTMLButtonElement>('.desktop-personalize-wall')
    expect(buttons.length).toBe(2)
  })

  it('marks the active wallpaper button on build with active class + aria-selected', () => {
    initDesktopPersonalize(makeDesktop())
    personalizeItem().click()

    const active = wallScroll().querySelector<HTMLButtonElement>(
      '.desktop-personalize-wall--active',
    )!
    expect(active).not.toBeNull()
    expect(active.dataset.wallUrl).toBe(WALL_A)
    expect(active.getAttribute('aria-selected')).toBe('true')
  })

  it('mounts an eager thumbnail for the active wallpaper and lazy for the rest', () => {
    initDesktopPersonalize(makeDesktop())
    personalizeItem().click()

    const buttons = [...wallScroll().querySelectorAll<HTMLButtonElement>('.desktop-personalize-wall')]
    const activeBtn = buttons.find(b => b.dataset.wallUrl === WALL_A)!
    const otherBtn = buttons.find(b => b.dataset.wallUrl === WALL_B)!

    const activeImg = activeBtn.querySelector<HTMLImageElement>('img.desktop-personalize-wall-img')!
    expect(activeImg.loading).toBe('eager')
    expect(activeImg.fetchPriority).toBe('high')
    expect(activeImg.src).toContain(`thumb:${WALL_A}`)
    expect(activeImg.width).toBe(192)
    expect(activeImg.height).toBe(120)
    expect(activeBtn.classList.contains('desktop-personalize-wall--loading')).toBe(true)

    const otherImg = otherBtn.querySelector<HTMLImageElement>('img.desktop-personalize-wall-img')!
    expect(otherImg.loading).toBe('lazy')
    expect(otherImg.fetchPriority).toBe('auto')
  })

  it('thumbnail load handler clears the loading class', () => {
    initDesktopPersonalize(makeDesktop())
    personalizeItem().click()
    const btn = wallScroll().querySelector<HTMLButtonElement>('.desktop-personalize-wall')!
    const img = btn.querySelector<HTMLImageElement>('img')!
    expect(btn.classList.contains('desktop-personalize-wall--loading')).toBe(true)
    img.dispatchEvent(new Event('load'))
    expect(btn.classList.contains('desktop-personalize-wall--loading')).toBe(false)
  })

  it('thumbnail error falls back to the full url, then flags error on second failure', () => {
    initDesktopPersonalize(makeDesktop())
    personalizeItem().click()
    const btn = [...wallScroll().querySelectorAll<HTMLButtonElement>('.desktop-personalize-wall')].find(
      b => b.dataset.wallUrl === WALL_A,
    )!
    const img = btn.querySelector<HTMLImageElement>('img')!

    // First error: thumb url -> swap to full url, no error class yet.
    img.dispatchEvent(new Event('error'))
    expect(img.src).toContain(WALL_A)
    expect(img.src).not.toContain('thumb:')
    expect(btn.classList.contains('desktop-personalize-wall--error')).toBe(false)

    // Second error (now src === full url): flag error, clear loading.
    img.dispatchEvent(new Event('error'))
    expect(btn.classList.contains('desktop-personalize-wall--error')).toBe(true)
    expect(btn.classList.contains('desktop-personalize-wall--loading')).toBe(false)
  })

  it('clicking a wallpaper sets it, moves the active marker, and plays a sound', () => {
    initDesktopPersonalize(makeDesktop())
    personalizeItem().click()
    playOsSoundMock.mockClear()

    const betaBtn = [...wallScroll().querySelectorAll<HTMLButtonElement>('.desktop-personalize-wall')].find(
      b => b.dataset.wallUrl === WALL_B,
    )!
    betaBtn.click()

    expect(setWallpaperMock).toHaveBeenCalledWith(WALL_B)
    expect(betaBtn.classList.contains('desktop-personalize-wall--active')).toBe(true)
    expect(betaBtn.getAttribute('aria-selected')).toBe('true')

    const alphaBtn = [...wallScroll().querySelectorAll<HTMLButtonElement>('.desktop-personalize-wall')].find(
      b => b.dataset.wallUrl === WALL_A,
    )!
    expect(alphaBtn.classList.contains('desktop-personalize-wall--active')).toBe(false)
    expect(alphaBtn.getAttribute('aria-selected')).toBe('false')
    expect(playOsSoundMock).toHaveBeenCalledWith('click')
  })

  it('rebuilds-skip on reopen: grid is built once, active marker re-synced from current value', () => {
    initDesktopPersonalize(makeDesktop())
    personalizeItem().click()
    const firstButtons = wallScroll().querySelectorAll('.desktop-personalize-wall')
    const firstNode = firstButtons[0]

    // Close then change current wallpaper externally, reopen.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    currentWall = WALL_B
    personalizeItem().click()

    // Same DOM nodes (grid not rebuilt).
    const secondButtons = wallScroll().querySelectorAll('.desktop-personalize-wall')
    expect(secondButtons.length).toBe(2)
    expect(secondButtons[0]).toBe(firstNode)
    // Active marker moved to WALL_B without a rebuild.
    const active = wallScroll().querySelector<HTMLButtonElement>('.desktop-personalize-wall--active')!
    expect(active.dataset.wallUrl).toBe(WALL_B)
  })

  it('applies a theme on select change and plays a sound', () => {
    initDesktopPersonalize(makeDesktop())
    const sel = themeSelect()
    playOsSoundMock.mockClear()

    sel.value = 'dracula'
    sel.dispatchEvent(new Event('change'))

    expect(getThemeId()).toBe('dracula')
    expect(document.documentElement.dataset.theme).toBe('dracula')
    expect(playOsSoundMock).toHaveBeenCalledWith('click')
  })

  it('ignores a theme change to the already-active id (no sound)', () => {
    initDesktopPersonalize(makeDesktop())
    const sel = themeSelect()
    playOsSoundMock.mockClear()

    sel.value = 'mocha' // already active
    sel.dispatchEvent(new Event('change'))

    expect(playOsSoundMock).not.toHaveBeenCalled()
    expect(getThemeId()).toBe('mocha')
  })

  it('resets the select to the active id when an unknown theme is chosen', () => {
    initDesktopPersonalize(makeDesktop())
    const sel = themeSelect()
    // Inject an option applyTheme will reject.
    const bogus = document.createElement('option')
    bogus.value = 'does-not-exist'
    bogus.textContent = 'Bogus'
    sel.appendChild(bogus)
    sel.value = 'does-not-exist'
    sel.dispatchEvent(new Event('change'))

    // applyTheme returned false -> syncThemeSelect resets to active 'mocha'.
    expect(sel.value).toBe('mocha')
    expect(getThemeId()).toBe('mocha')
  })

  it('syncs the select when a mrgrey-theme-change event fires', () => {
    initDesktopPersonalize(makeDesktop())
    const sel = themeSelect()
    // Change theme via the API (dispatches mrgrey-theme-change).
    applyTheme('nord')
    expect(sel.value).toBe('nord')
  })

  it('leaves the select value untouched when the active id has no matching option', () => {
    initDesktopPersonalize(makeDesktop())
    const sel = themeSelect()
    // Replace options with one bogus entry so the active id ('nord' below) is absent.
    sel.replaceChildren()
    const only = document.createElement('option')
    only.value = 'placeholder'
    sel.appendChild(only)
    sel.value = 'placeholder'

    // applyTheme dispatches mrgrey-theme-change -> syncThemeSelect; no matching option.
    applyTheme('nord')
    expect(sel.value).toBe('placeholder')
  })

  it('opens the dialog on the mrgrey-open-personalize window event', () => {
    initDesktopPersonalize(makeDesktop())
    window.dispatchEvent(new CustomEvent('mrgrey-open-personalize'))
    expect(dialog().classList.contains('desktop-personalize--open')).toBe(true)
  })

  it('closes the dialog via the close button and plays a sound', () => {
    initDesktopPersonalize(makeDesktop())
    window.dispatchEvent(new CustomEvent('mrgrey-open-personalize'))
    playOsSoundMock.mockClear()

    const closeBtn = document.querySelector<HTMLButtonElement>('.desktop-personalize-close')!
    closeBtn.click()

    const d = dialog()
    expect(d.classList.contains('desktop-personalize--open')).toBe(false)
    expect(d.getAttribute('aria-hidden')).toBe('true')
    expect(playOsSoundMock).toHaveBeenCalledWith('click')
  })

  it('closes the dialog via the backdrop click (no sound)', () => {
    initDesktopPersonalize(makeDesktop())
    window.dispatchEvent(new CustomEvent('mrgrey-open-personalize'))
    playOsSoundMock.mockClear()

    const backdrop = document.querySelector<HTMLButtonElement>('.desktop-personalize-backdrop')!
    backdrop.click()
    expect(dialog().classList.contains('desktop-personalize--open')).toBe(false)
    expect(playOsSoundMock).not.toHaveBeenCalled()
  })

  it('re-marks the active wallpaper on mrgrey-wallpaper-change only while the dialog is open', () => {
    initDesktopPersonalize(makeDesktop())
    personalizeItem().click()

    currentWall = WALL_B
    window.dispatchEvent(new CustomEvent('mrgrey-wallpaper-change', { detail: WALL_B }))
    expect(
      wallScroll().querySelector<HTMLButtonElement>('.desktop-personalize-wall--active')!.dataset
        .wallUrl,
    ).toBe(WALL_B)

    // Close, change again — should NOT move marker while closed.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    currentWall = WALL_A
    window.dispatchEvent(new CustomEvent('mrgrey-wallpaper-change', { detail: WALL_A }))
    // Reopen (grid not rebuilt) — marker re-synced to WALL_A on open via build path.
    personalizeItem().click()
    expect(
      wallScroll().querySelector<HTMLButtonElement>('.desktop-personalize-wall--active')!.dataset
        .wallUrl,
    ).toBe(WALL_A)
  })

  it('clears the active marker when the current wallpaper is not in the grid', () => {
    initDesktopPersonalize(makeDesktop())
    personalizeItem().click()
    expect(wallScroll().querySelector('.desktop-personalize-wall--active')).not.toBeNull()

    // A wallpaper URL with no matching button -> active marker removed, no throw.
    currentWall = 'https://example.com/unknown/zzz.png'
    window.dispatchEvent(new CustomEvent('mrgrey-wallpaper-change', { detail: currentWall }))
    expect(wallScroll().querySelector('.desktop-personalize-wall--active')).toBeNull()
  })

  it('closes an open context menu on outside pointerdown', () => {
    initDesktopPersonalize(makeDesktop())
    const desktop = document.getElementById('desktop-workspace')!
    rightClick(desktop)
    expect(ctxMenu().hidden).toBe(false)

    const outside = document.createElement('div')
    document.body.appendChild(outside)
    outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    expect(ctxMenu().hidden).toBe(true)
  })

  it('keeps the context menu open on pointerdown inside it', () => {
    initDesktopPersonalize(makeDesktop())
    const desktop = document.getElementById('desktop-workspace')!
    rightClick(desktop)
    personalizeItem().dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    expect(ctxMenu().hidden).toBe(false)
  })

  it('Escape closes the dialog (taking priority over the context menu)', () => {
    initDesktopPersonalize(makeDesktop())
    window.dispatchEvent(new CustomEvent('mrgrey-open-personalize'))
    expect(dialog().classList.contains('desktop-personalize--open')).toBe(true)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(dialog().classList.contains('desktop-personalize--open')).toBe(false)
  })

  it('Escape closes the context menu when no dialog is open', () => {
    initDesktopPersonalize(makeDesktop())
    const desktop = document.getElementById('desktop-workspace')!
    rightClick(desktop)
    expect(ctxMenu().hidden).toBe(false)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(ctxMenu().hidden).toBe(true)
  })

  it('ignores non-Escape keydowns', () => {
    initDesktopPersonalize(makeDesktop())
    const desktop = document.getElementById('desktop-workspace')!
    rightClick(desktop)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }))
    expect(ctxMenu().hidden).toBe(false)
  })

  it('closes the context menu on window resize and blur', () => {
    initDesktopPersonalize(makeDesktop())
    const desktop = document.getElementById('desktop-workspace')!

    rightClick(desktop)
    window.dispatchEvent(new Event('resize'))
    expect(ctxMenu().hidden).toBe(true)

    rightClick(desktop)
    window.dispatchEvent(new Event('blur'))
    expect(ctxMenu().hidden).toBe(true)
  })

  it('opening the context menu closes an open dialog first', () => {
    initDesktopPersonalize(makeDesktop())
    window.dispatchEvent(new CustomEvent('mrgrey-open-personalize'))
    expect(dialog().classList.contains('desktop-personalize--open')).toBe(true)

    const desktop = document.getElementById('desktop-workspace')!
    rightClick(desktop)
    expect(dialog().classList.contains('desktop-personalize--open')).toBe(false)
    expect(ctxMenu().hidden).toBe(false)
  })
})
