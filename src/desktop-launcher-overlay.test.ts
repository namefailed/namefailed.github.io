// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  closeLauncherOverlayFlags,
  launcherOverlayVisible,
  openLauncherFromButtonFlags,
  toggleShowDesktopFlags,
  syncLauncherOverlayDom,
  initLauncherSearchFilter,
} from './desktop-launcher-overlay'

describe('launcher overlay flags', () => {
  it('tracks visibility from either flag', () => {
    const flags = { showingDesktop: false, launcherOpen: false }
    expect(launcherOverlayVisible(flags)).toBe(false)
    flags.launcherOpen = true
    expect(launcherOverlayVisible(flags)).toBe(true)
  })

  it('toggleShowDesktop clears launcherOpen only when hiding desktop', () => {
    const flags = { showingDesktop: false, launcherOpen: true }
    toggleShowDesktopFlags(flags)
    expect(flags).toEqual({ showingDesktop: true, launcherOpen: true })
    toggleShowDesktopFlags(flags)
    expect(flags).toEqual({ showingDesktop: false, launcherOpen: false })
  })

  it('closeLauncherOverlayFlags is idempotent', () => {
    const flags = { showingDesktop: true, launcherOpen: false }
    expect(closeLauncherOverlayFlags(flags)).toBe(true)
    expect(closeLauncherOverlayFlags(flags)).toBe(false)
    expect(flags).toEqual({ showingDesktop: false, launcherOpen: false })
  })

  it('openLauncherFromButtonFlags refuses when already visible', () => {
    const flags = { showingDesktop: true, launcherOpen: false }
    expect(openLauncherFromButtonFlags(flags)).toBe(false)
    flags.showingDesktop = false
    expect(openLauncherFromButtonFlags(flags)).toBe(true)
    expect(flags.launcherOpen).toBe(true)
  })
})

// ── DOM sync + search filter (happy-dom) ─────────────────────────────────────
//
// syncLauncherOverlayDom and initLauncherSearchFilter both accept an explicit
// `doc` arg, so each test builds an isolated DOM tree and passes it in — no
// reliance on the global document, nothing to leak across tests.

/** Build a detached document fragment shaped like the real launcher shell. */
function buildLauncherDom(opts: {
  searchValue?: string
  iconLabels?: string[]
  withShell?: boolean
  withButton?: boolean
  withSearch?: boolean
  iconStyleDisplay?: string
} = {}): Document {
  const {
    searchValue = '',
    iconLabels = ['Terminal', 'Resume', 'Projects'],
    withShell = true,
    withButton = true,
    withSearch = true,
    iconStyleDisplay = 'none',
  } = opts

  const doc = document.implementation.createHTMLDocument('launcher')

  if (withShell) {
    const shell = doc.createElement('div')
    shell.id = 'launcher-shell'

    if (withSearch) {
      const input = doc.createElement('input')
      input.id = 'launcher-search'
      input.type = 'text'
      input.value = searchValue
      shell.appendChild(input)
    }
    doc.body.appendChild(shell)
  }

  if (withButton) {
    const btn = doc.createElement('button')
    btn.id = 'btn-applications'
    doc.body.appendChild(btn)
  }

  const iconsRoot = doc.createElement('div')
  iconsRoot.id = 'desktop-icons'
  for (const label of iconLabels) {
    const btn = doc.createElement('button')
    btn.className = 'desktop-icon'
    btn.style.display = iconStyleDisplay
    const labelEl = doc.createElement('span')
    labelEl.className = 'desktop-icon-label'
    labelEl.textContent = label
    btn.appendChild(labelEl)
    iconsRoot.appendChild(btn)
  }
  doc.body.appendChild(iconsRoot)

  return doc
}

const icon = (doc: Document, i: number) =>
  doc.querySelectorAll<HTMLElement>('#desktop-icons .desktop-icon')[i]!

describe('syncLauncherOverlayDom', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows: toggles the launchers-visible class on and sets ARIA expanded/hidden', () => {
    const doc = buildLauncherDom()
    const desktopEl = doc.createElement('div')

    syncLauncherOverlayDom(true, desktopEl, doc)

    expect(desktopEl.classList.contains('launchers-visible')).toBe(true)
    expect(doc.getElementById('launcher-shell')!.getAttribute('aria-hidden')).toBe('false')
    expect(doc.getElementById('btn-applications')!.getAttribute('aria-expanded')).toBe('true')
  })

  it('hides: removes the class and flips ARIA to hidden/collapsed', () => {
    const doc = buildLauncherDom()
    const desktopEl = doc.createElement('div')
    desktopEl.classList.add('launchers-visible')

    syncLauncherOverlayDom(false, desktopEl, doc)

    expect(desktopEl.classList.contains('launchers-visible')).toBe(false)
    expect(doc.getElementById('launcher-shell')!.getAttribute('aria-hidden')).toBe('true')
    expect(doc.getElementById('btn-applications')!.getAttribute('aria-expanded')).toBe('false')
  })

  it('hiding blurs the active element when focus is inside the shell', () => {
    const doc = buildLauncherDom({ searchValue: 'res' })
    const desktopEl = doc.createElement('div')
    const input = doc.getElementById('launcher-search') as HTMLInputElement
    input.focus()
    expect(doc.activeElement).toBe(input)
    const blurSpy = vi.spyOn(input, 'blur')

    syncLauncherOverlayDom(false, desktopEl, doc)

    expect(blurSpy).toHaveBeenCalledOnce()
  })

  it('hiding does NOT blur when focus is outside the shell', () => {
    const doc = buildLauncherDom()
    const desktopEl = doc.createElement('div')
    const outside = doc.getElementById('btn-applications') as HTMLElement
    outside.focus()
    expect(doc.activeElement).toBe(outside)
    const blurSpy = vi.spyOn(outside, 'blur')

    syncLauncherOverlayDom(false, desktopEl, doc)

    expect(blurSpy).not.toHaveBeenCalled()
  })

  it('hiding clears a non-empty search value and resets every icon display (lines 54-56)', () => {
    const doc = buildLauncherDom({ searchValue: 'resume', iconStyleDisplay: 'none' })
    const desktopEl = doc.createElement('div')
    const input = doc.getElementById('launcher-search') as HTMLInputElement
    // Pre-state: a search was active so some icons were hidden.
    expect(input.value).toBe('resume')
    expect(icon(doc, 0).style.display).toBe('none')

    syncLauncherOverlayDom(false, desktopEl, doc)

    expect(input.value).toBe('')
    for (const el of doc.querySelectorAll<HTMLElement>('#desktop-icons .desktop-icon')) {
      expect(el.style.display).toBe('')
    }
  })

  it('hiding with an EMPTY search value leaves icon display untouched (skips lines 54-56)', () => {
    const doc = buildLauncherDom({ searchValue: '', iconStyleDisplay: 'none' })
    const desktopEl = doc.createElement('div')

    syncLauncherOverlayDom(false, desktopEl, doc)

    // input.value was falsy → the reset block never runs → display stays 'none'.
    expect(icon(doc, 0).style.display).toBe('none')
  })

  it('showing never clears the search value even when one is present', () => {
    const doc = buildLauncherDom({ searchValue: 'proj' })
    const desktopEl = doc.createElement('div')
    const input = doc.getElementById('launcher-search') as HTMLInputElement

    syncLauncherOverlayDom(true, desktopEl, doc)

    expect(input.value).toBe('proj')
  })

  it('is robust when the shell, button, and search input are all absent', () => {
    const doc = buildLauncherDom({ withShell: false, withButton: false })
    const desktopEl = doc.createElement('div')

    expect(() => syncLauncherOverlayDom(false, desktopEl, doc)).not.toThrow()
    // Class still toggles on the desktop element itself.
    syncLauncherOverlayDom(true, desktopEl, doc)
    expect(desktopEl.classList.contains('launchers-visible')).toBe(true)
  })

  it('hiding with a shell but no search input does not throw', () => {
    const doc = buildLauncherDom({ withSearch: false })
    const desktopEl = doc.createElement('div')

    expect(() => syncLauncherOverlayDom(false, desktopEl, doc)).not.toThrow()
    expect(doc.getElementById('launcher-shell')!.getAttribute('aria-hidden')).toBe('true')
  })
})

describe('initLauncherSearchFilter', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does nothing when there is no search input', () => {
    const doc = buildLauncherDom({ withSearch: false })
    const onInput = vi.fn()
    expect(() => initLauncherSearchFilter(onInput, doc)).not.toThrow()
    expect(onInput).not.toHaveBeenCalled()
  })

  it('routes the trimmed/lowercased query to the onInput callback and skips default filtering (lines 69-73)', () => {
    const doc = buildLauncherDom({ iconStyleDisplay: '' })
    const onInput = vi.fn()
    initLauncherSearchFilter(onInput, doc)

    const input = doc.getElementById('launcher-search') as HTMLInputElement
    input.value = '  ReSuMe  '
    input.dispatchEvent(new Event('input'))

    expect(onInput).toHaveBeenCalledExactlyOnceWith('resume')
    // The early return means the default per-icon display filter never ran.
    expect(icon(doc, 0).style.display).toBe('')
    expect(icon(doc, 1).style.display).toBe('')
  })

  it('without a callback, filters icons by label substring (lines 74-77)', () => {
    const doc = buildLauncherDom({
      iconLabels: ['Terminal', 'Resume', 'Projects'],
      iconStyleDisplay: '',
    })
    initLauncherSearchFilter(undefined, doc)

    const input = doc.getElementById('launcher-search') as HTMLInputElement
    input.value = 'res'
    input.dispatchEvent(new Event('input'))

    // Only "Resume" contains "res" → others hidden.
    expect(icon(doc, 0).style.display).toBe('none') // Terminal
    expect(icon(doc, 1).style.display).toBe('') // Resume
    expect(icon(doc, 2).style.display).toBe('none') // Projects
  })

  it('an empty query reveals every icon (the `!q` branch of line 77)', () => {
    const doc = buildLauncherDom({ iconStyleDisplay: 'none' })
    initLauncherSearchFilter(undefined, doc)

    const input = doc.getElementById('launcher-search') as HTMLInputElement
    input.value = '   ' // trims to '' → falsy query
    input.dispatchEvent(new Event('input'))

    for (const el of doc.querySelectorAll<HTMLElement>('#desktop-icons .desktop-icon')) {
      expect(el.style.display).toBe('')
    }
  })

  it('matching is case-insensitive and matches on substrings anywhere in the label', () => {
    const doc = buildLauncherDom({ iconLabels: ['Terminal', 'Resume'], iconStyleDisplay: '' })
    initLauncherSearchFilter(undefined, doc)

    const input = doc.getElementById('launcher-search') as HTMLInputElement
    input.value = 'MIN' // "Terminal" contains "min"; "Resume" does not.
    input.dispatchEvent(new Event('input'))

    expect(icon(doc, 0).style.display).toBe('') // Terminal
    expect(icon(doc, 1).style.display).toBe('none') // Resume
  })

  it('treats an icon with a missing label as the empty string (the `?? \'\'` fallback on line 76)', () => {
    const doc = buildLauncherDom({ iconLabels: [], iconStyleDisplay: '' })
    // Add a bare icon button with no .desktop-icon-label child.
    const iconsRoot = doc.getElementById('desktop-icons')!
    const bare = doc.createElement('button')
    bare.className = 'desktop-icon'
    bare.style.display = ''
    iconsRoot.appendChild(bare)

    initLauncherSearchFilter(undefined, doc)
    const input = doc.getElementById('launcher-search') as HTMLInputElement
    input.value = 'anything'
    input.dispatchEvent(new Event('input'))

    // label resolves to '' → does not include the query → hidden.
    expect(icon(doc, 0).style.display).toBe('none')
  })

  it('a fresh non-matching query re-hides icons revealed by a prior empty query', () => {
    const doc = buildLauncherDom({ iconLabels: ['Resume', 'Projects'], iconStyleDisplay: '' })
    initLauncherSearchFilter(undefined, doc)
    const input = doc.getElementById('launcher-search') as HTMLInputElement

    input.value = ''
    input.dispatchEvent(new Event('input'))
    expect(icon(doc, 0).style.display).toBe('')

    input.value = 'zzz'
    input.dispatchEvent(new Event('input'))
    expect(icon(doc, 0).style.display).toBe('none')
    expect(icon(doc, 1).style.display).toBe('none')
  })
})
