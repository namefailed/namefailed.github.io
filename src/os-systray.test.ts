// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import * as osSound from './os-sound'
import * as retroFx from './retro-fx'
import * as matrixBg from './matrix-bg'
import * as desktopTiles from './desktop-tiles'
import * as wallpaper from './wallpaper'
import * as firstVisit from './first-visit-flags'
import * as staticHref from './static-portfolio-href'

import {
  initSystray,
  pushToast,
  syncSettingsSoundToggle,
} from './os-systray'

// Mock side-effectful dependencies so assertions observe os-systray's own logic
// rather than Web Audio / storage / reload behavior.
vi.mock('./os-sound', () => {
  let enabled = true
  let volume = 0.72
  return {
    getSoundVolume: vi.fn(() => volume),
    setSoundVolume: vi.fn((v: number) => {
      volume = v
    }),
    isSoundEnabled: vi.fn(() => enabled),
    toggleSound: vi.fn(() => {
      enabled = !enabled
      return enabled
    }),
    resumeAudioIfNeeded: vi.fn(() => Promise.resolve()),
    playOsSound: vi.fn(),
    // test helpers
    __setEnabled: (v: boolean) => {
      enabled = v
    },
    __setVolume: (v: number) => {
      volume = v
    },
  }
})

vi.mock('./retro-fx', () => {
  let on = false
  return {
    getRetroFx: vi.fn(() => on),
    setRetroFx: vi.fn((v: boolean) => {
      on = v
    }),
    __setRetro: (v: boolean) => {
      on = v
    },
  }
})

vi.mock('./matrix-bg', () => {
  return {
    getMatrixBgHandle: vi.fn(() => null),
  }
})

vi.mock('./desktop-tiles', () => ({ resetTileLayout: vi.fn() }))
vi.mock('./wallpaper', () => ({ clearWallpaper: vi.fn() }))
vi.mock('./first-visit-flags', () => ({ clearFirstVisitFlags: vi.fn() }))
vi.mock('./static-portfolio-href', () => ({
  resolveStaticPortfolioHref: vi.fn(() => 'https://example.test/static/'),
}))

/** Build the systray DOM the module queries by id. */
function mountSystrayDom(): void {
  document.body.innerHTML = `
    <a class="skip-link skip-link--classic" href="#">Classic</a>
    <button id="btn-yasb-clock" aria-expanded="false">12:00</button>
    <div id="yasb-settings" class="yasb-settings-panel" aria-hidden="true">
      <button id="settings-personalize">Personalize</button>
      <button id="settings-sound-toggle" aria-pressed="true">Sound</button>
      <button id="settings-retro-toggle" aria-pressed="false">CRT</button>
      <button id="settings-matrix-toggle" aria-pressed="false">Matrix</button>
      <input id="settings-volume-slider" type="range" min="0" max="100" value="50" />
      <a id="yasb-classic-link" href="#">Classic site</a>
      <button id="settings-full-reset">Full reset</button>
    </div>
    <div id="toast-stack"></div>
  `
}

const soundMock = osSound as unknown as {
  __setEnabled: (v: boolean) => void
  __setVolume: (v: number) => void
}
const retroMock = retroFx as unknown as { __setRetro: (v: boolean) => void }

beforeEach(() => {
  document.body.innerHTML = ''
  soundMock.__setEnabled(true)
  soundMock.__setVolume(0.72)
  retroMock.__setRetro(false)
  vi.mocked(matrixBg.getMatrixBgHandle).mockReturnValue(null)
  vi.useFakeTimers()
})

afterEach(() => {
  vi.runOnlyPendingTimers()
  vi.useRealTimers()
  document.body.innerHTML = ''
  // happy-dom has no default confirm; drop any stub a test installed.
  delete (window as unknown as { confirm?: unknown }).confirm
})

describe('syncSettingsSoundToggle', () => {
  it('reflects enabled sound state on the toggle button', () => {
    mountSystrayDom()
    soundMock.__setEnabled(true)
    syncSettingsSoundToggle()

    const sw = document.getElementById('settings-sound-toggle')!
    expect(sw.getAttribute('aria-pressed')).toBe('true')
    expect(sw.classList.contains('yasb-settings-switch--off')).toBe(false)
    expect(sw.title).toBe('Mute UI sounds')
  })

  it('reflects muted sound state on the toggle button', () => {
    mountSystrayDom()
    soundMock.__setEnabled(false)
    syncSettingsSoundToggle()

    const sw = document.getElementById('settings-sound-toggle')!
    expect(sw.getAttribute('aria-pressed')).toBe('false')
    expect(sw.classList.contains('yasb-settings-switch--off')).toBe(true)
    expect(sw.title).toBe('Unmute UI sounds')
  })

  it('writes the rounded volume percentage into the slider when unfocused', () => {
    mountSystrayDom()
    soundMock.__setVolume(0.345)
    syncSettingsSoundToggle()

    const slider = document.getElementById('settings-volume-slider') as HTMLInputElement
    // 0.345 * 100 = 34.5 -> rounds to 35
    expect(slider.value).toBe('35')
  })

  it('does not overwrite the slider while it has focus', () => {
    mountSystrayDom()
    const slider = document.getElementById('settings-volume-slider') as HTMLInputElement
    slider.value = '11'
    slider.focus()
    soundMock.__setVolume(0.9)
    syncSettingsSoundToggle()
    expect(slider.value).toBe('11')
  })

  it('marks the matrix toggle disabled and off when no backdrop handle exists', () => {
    mountSystrayDom()
    vi.mocked(matrixBg.getMatrixBgHandle).mockReturnValue(null)
    syncSettingsSoundToggle()

    const m = document.getElementById('settings-matrix-toggle') as HTMLButtonElement
    expect(m.disabled).toBe(true)
    expect(m.getAttribute('aria-pressed')).toBe('false')
    expect(m.title).toBe('Matrix backdrop unavailable')
  })

  it('reflects an enabled matrix backdrop handle', () => {
    mountSystrayDom()
    vi.mocked(matrixBg.getMatrixBgHandle).mockReturnValue({
      isEnabled: () => true,
      setEnabled: vi.fn(),
      destroy: vi.fn(),
    })
    syncSettingsSoundToggle()

    const m = document.getElementById('settings-matrix-toggle') as HTMLButtonElement
    expect(m.disabled).toBe(false)
    expect(m.getAttribute('aria-pressed')).toBe('true')
    expect(m.title).toBe('Matrix rain on')
  })

  it('reflects a present-but-disabled matrix backdrop handle', () => {
    mountSystrayDom()
    vi.mocked(matrixBg.getMatrixBgHandle).mockReturnValue({
      isEnabled: () => false,
      setEnabled: vi.fn(),
      destroy: vi.fn(),
    })
    syncSettingsSoundToggle()

    const m = document.getElementById('settings-matrix-toggle') as HTMLButtonElement
    expect(m.disabled).toBe(false)
    expect(m.getAttribute('aria-pressed')).toBe('false')
    expect(m.title).toBe('Matrix rain off')
  })

  it('reflects retro CRT on/off titles', () => {
    mountSystrayDom()
    retroMock.__setRetro(true)
    syncSettingsSoundToggle()
    const r = document.getElementById('settings-retro-toggle')!
    expect(r.getAttribute('aria-pressed')).toBe('true')
    expect(r.title).toBe('CRT effects on — click to disable')
  })

  it('is a no-op when the toggle elements are absent', () => {
    document.body.innerHTML = '<div></div>'
    expect(() => syncSettingsSoundToggle()).not.toThrow()
  })
})

describe('pushToast', () => {
  it('does nothing without a toast-stack container', () => {
    document.body.innerHTML = '<div></div>'
    pushToast('hello')
    expect(document.querySelector('.toast')).toBeNull()
    expect(osSound.playOsSound).not.toHaveBeenCalled()
  })

  it('appends a transient toast and plays the notify sound', () => {
    mountSystrayDom()
    pushToast('Saved!')

    const stack = document.getElementById('toast-stack')!
    const toast = stack.querySelector('.toast') as HTMLElement
    expect(toast).not.toBeNull()
    expect(toast.textContent).toBe('Saved!')
    expect(toast.getAttribute('role')).toBe('status')
    expect(osSound.playOsSound).toHaveBeenCalledWith('notify')
  })

  it('applies an extra class when provided', () => {
    mountSystrayDom()
    pushToast('Warn', 1000, 'toast--warn')
    const toast = document.querySelector('.toast') as HTMLElement
    expect(toast.classList.contains('toast--warn')).toBe(true)
  })

  it('removes a transient toast after its duration plus exit animation', () => {
    mountSystrayDom()
    pushToast('bye', 1000)
    const toast = document.querySelector('.toast') as HTMLElement

    vi.advanceTimersByTime(1000)
    expect(toast.classList.contains('toast-out')).toBe(true)
    expect(toast.isConnected).toBe(true)

    vi.advanceTimersByTime(360)
    expect(toast.isConnected).toBe(false)
  })

  it('renders a sticky toast (duration <= 0) dismissed on click', () => {
    mountSystrayDom()
    pushToast('Stuck', 0)
    const toast = document.querySelector('.toast') as HTMLElement

    expect(toast.classList.contains('toast--sticky')).toBe(true)
    expect(toast.getAttribute('role')).toBe('alert')
    expect(toast.getAttribute('title')).toBe('Click to dismiss')
    // message wrapped in a span, not set as raw textContent
    expect(toast.querySelector('span')!.textContent).toBe('Stuck')

    // does not auto-remove
    vi.advanceTimersByTime(10000)
    expect(toast.isConnected).toBe(true)

    toast.click()
    expect(toast.classList.contains('toast-out')).toBe(true)
    vi.advanceTimersByTime(360)
    expect(toast.isConnected).toBe(false)
  })
})

describe('initSystray', () => {
  it('bails out early when the clock button or panel is missing', () => {
    document.body.innerHTML = '<button id="btn-yasb-clock"></button>'
    // No panel -> should return without throwing and without wiring anything.
    expect(() => initSystray()).not.toThrow()
    const btn = document.getElementById('btn-yasb-clock')!
    btn.click()
    // aria-expanded never set because handler was never attached
    expect(btn.getAttribute('aria-expanded')).toBeNull()
  })

  it('toggles the settings panel open and closed via the clock button', () => {
    mountSystrayDom()
    initSystray()
    const clock = document.getElementById('btn-yasb-clock')!
    const panel = document.getElementById('yasb-settings')!

    clock.click()
    expect(panel.classList.contains('yasb-settings-panel--open')).toBe(true)
    expect(panel.getAttribute('aria-hidden')).toBe('false')
    expect(clock.getAttribute('aria-expanded')).toBe('true')

    clock.click()
    expect(panel.classList.contains('yasb-settings-panel--open')).toBe(false)
    expect(panel.getAttribute('aria-hidden')).toBe('true')
    expect(clock.getAttribute('aria-expanded')).toBe('false')
  })

  it('closes the panel on an outside document click', () => {
    mountSystrayDom()
    initSystray()
    const clock = document.getElementById('btn-yasb-clock')!
    const panel = document.getElementById('yasb-settings')!

    clock.click()
    expect(panel.classList.contains('yasb-settings-panel--open')).toBe(true)

    document.body.click()
    expect(panel.classList.contains('yasb-settings-panel--open')).toBe(false)
  })

  it('keeps the panel open when clicking inside it (stopPropagation)', () => {
    mountSystrayDom()
    initSystray()
    document.getElementById('btn-yasb-clock')!.click()
    const panel = document.getElementById('yasb-settings')!
    panel.click()
    expect(panel.classList.contains('yasb-settings-panel--open')).toBe(true)
  })

  it('closes the panel on Escape when open', () => {
    mountSystrayDom()
    initSystray()
    const panel = document.getElementById('yasb-settings')!
    document.getElementById('btn-yasb-clock')!.click()
    expect(panel.classList.contains('yasb-settings-panel--open')).toBe(true)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(panel.classList.contains('yasb-settings-panel--open')).toBe(false)
  })

  it('ignores non-Escape keydowns', () => {
    mountSystrayDom()
    initSystray()
    const panel = document.getElementById('yasb-settings')!
    document.getElementById('btn-yasb-clock')!.click()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    expect(panel.classList.contains('yasb-settings-panel--open')).toBe(true)
  })

  it('dispatches the personalize event and closes the panel', () => {
    mountSystrayDom()
    initSystray()
    const onPersonalize = vi.fn()
    window.addEventListener('mrgrey-open-personalize', onPersonalize)

    document.getElementById('btn-yasb-clock')!.click()
    document.getElementById('settings-personalize')!.click()

    expect(onPersonalize).toHaveBeenCalledTimes(1)
    expect(
      document.getElementById('yasb-settings')!.classList.contains('yasb-settings-panel--open'),
    ).toBe(false)
    window.removeEventListener('mrgrey-open-personalize', onPersonalize)
  })

  it('toggles sound, resumes audio, and re-syncs on the sound toggle click', async () => {
    mountSystrayDom()
    initSystray()
    vi.mocked(osSound.toggleSound).mockClear()
    vi.mocked(osSound.resumeAudioIfNeeded).mockClear()

    const sound = document.getElementById('settings-sound-toggle')!
    sound.click()
    // allow the async click handler microtasks to flush
    await vi.runAllTimersAsync()

    expect(osSound.resumeAudioIfNeeded).toHaveBeenCalled()
    expect(osSound.toggleSound).toHaveBeenCalledTimes(1)
    expect(osSound.playOsSound).toHaveBeenCalledWith('click')
    // sound now off -> switch reflects muted state
    expect(sound.getAttribute('aria-pressed')).toBe('false')
  })

  it('flips retro CRT state and re-syncs on the retro toggle click', () => {
    mountSystrayDom()
    retroMock.__setRetro(false)
    initSystray()

    const retro = document.getElementById('settings-retro-toggle')!
    retro.click()

    expect(retroFx.setRetroFx).toHaveBeenCalledWith(true)
    expect(retro.getAttribute('aria-pressed')).toBe('true')
    expect(osSound.playOsSound).toHaveBeenCalledWith('click')
  })

  it('does nothing on matrix toggle click when there is no backdrop handle', () => {
    mountSystrayDom()
    vi.mocked(matrixBg.getMatrixBgHandle).mockReturnValue(null)
    initSystray()
    vi.mocked(osSound.playOsSound).mockClear()

    document.getElementById('settings-matrix-toggle')!.click()
    expect(osSound.playOsSound).not.toHaveBeenCalled()
  })

  it('toggles the matrix backdrop via its handle on click', () => {
    mountSystrayDom()
    let on = false
    const setEnabled = vi.fn((v: boolean) => {
      on = v
    })
    vi.mocked(matrixBg.getMatrixBgHandle).mockReturnValue({
      isEnabled: () => on,
      setEnabled,
      destroy: vi.fn(),
    })
    initSystray()

    document.getElementById('settings-matrix-toggle')!.click()
    expect(setEnabled).toHaveBeenCalledWith(true)
    expect(osSound.playOsSound).toHaveBeenCalledWith('click')
  })

  it('updates the sound volume from the slider input', () => {
    mountSystrayDom()
    initSystray()
    const slider = document.getElementById('settings-volume-slider') as HTMLInputElement

    slider.value = '40'
    slider.dispatchEvent(new Event('input'))

    expect(osSound.setSoundVolume).toHaveBeenCalledWith(0.4)
    expect(osSound.resumeAudioIfNeeded).toHaveBeenCalled()
  })

  it('does not set volume for a non-numeric slider value', () => {
    // A <input type="range"> always normalizes to a number, so swap in a value
    // that parseInt cannot parse to exercise the Number.isFinite guard.
    mountSystrayDom()
    initSystray()
    vi.mocked(osSound.setSoundVolume).mockClear()
    const slider = document.getElementById('settings-volume-slider') as HTMLInputElement

    // Force a non-numeric raw value past the range-input normalization. The
    // setter is a no-op so the later syncVolumeSlider write-back doesn't throw.
    Object.defineProperty(slider, 'value', {
      configurable: true,
      get: () => 'abc',
      set: () => {},
    })
    slider.dispatchEvent(new Event('input'))
    expect(osSound.setSoundVolume).not.toHaveBeenCalled()
  })

  it('points the classic links at the resolved static portfolio href', () => {
    mountSystrayDom()
    initSystray()
    const link = document.getElementById('yasb-classic-link') as HTMLAnchorElement
    const skip = document.querySelector('.skip-link--classic') as HTMLAnchorElement
    expect(link.href).toBe('https://example.test/static/')
    expect(skip.href).toBe('https://example.test/static/')
    expect(staticHref.resolveStaticPortfolioHref).toHaveBeenCalled()
  })

  it('performs a full reset only after the user confirms', () => {
    mountSystrayDom()
    initSystray()
    const reload = vi.fn()
    const origLocation = window.location
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...origLocation, reload },
    })
    window.confirm = vi.fn(() => true)

    document.getElementById('settings-full-reset')!.click()

    expect(window.confirm).toHaveBeenCalledTimes(1)
    expect(desktopTiles.resetTileLayout).toHaveBeenCalledTimes(1)
    expect(wallpaper.clearWallpaper).toHaveBeenCalledTimes(1)
    expect(firstVisit.clearFirstVisitFlags).toHaveBeenCalledTimes(1)
    // a reset toast is pushed
    expect(document.querySelector('.toast')!.textContent).toBe('Resetting experience — reloading…')

    vi.advanceTimersByTime(1500)
    expect(reload).toHaveBeenCalledTimes(1)

    Object.defineProperty(window, 'location', { configurable: true, value: origLocation })
  })

  it('does not reset when the user cancels the confirm', () => {
    mountSystrayDom()
    initSystray()
    window.confirm = vi.fn(() => false)

    document.getElementById('settings-full-reset')!.click()

    expect(desktopTiles.resetTileLayout).not.toHaveBeenCalled()
    expect(wallpaper.clearWallpaper).not.toHaveBeenCalled()
    expect(firstVisit.clearFirstVisitFlags).not.toHaveBeenCalled()
    expect(document.querySelector('.toast')).toBeNull()
  })

  it('initializes without the classic links or full-reset button present', () => {
    // Minimal DOM: only the clock + panel + toast stack, no classic links.
    document.body.innerHTML = `
      <button id="btn-yasb-clock" aria-expanded="false">12:00</button>
      <div id="yasb-settings" class="yasb-settings-panel" aria-hidden="true"></div>
      <div id="toast-stack"></div>
    `
    expect(() => initSystray()).not.toThrow()
    // Panel toggling still works with the optional controls absent.
    const panel = document.getElementById('yasb-settings')!
    document.getElementById('btn-yasb-clock')!.click()
    expect(panel.classList.contains('yasb-settings-panel--open')).toBe(true)
  })

  it('syncs retro/matrix switches when the panel opens', () => {
    mountSystrayDom()
    retroMock.__setRetro(true)
    initSystray()

    // before opening, sync ran at init with retro off semantics already applied;
    // open the panel and confirm the retro switch reflects the enabled state.
    document.getElementById('btn-yasb-clock')!.click()
    const retro = document.getElementById('settings-retro-toggle')!
    expect(retro.getAttribute('aria-pressed')).toBe('true')
  })
})
