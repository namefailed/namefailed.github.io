// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { dismissLegacyOnboardingUi } from './first-visit-flags'
import { initThemeFromStorage } from './theme'
import { loadSavedWallpaper } from './wallpaper'
import { initRetroFxFromStorage } from './retro-fx'
import { initOsSound } from './os-sound'
import { initSystray, syncSettingsSoundToggle } from './os-systray'
import { initMatrixBg } from './matrix-bg'
import { runBootSplash } from './boot-splash'
import { Desktop } from './desktop'
import { bootstrapShellUi } from './bootstrap-shell'

// ── Mock every collaborator so the import graph stays light and synchronous ────
vi.mock('./first-visit-flags', () => ({ dismissLegacyOnboardingUi: vi.fn() }))
vi.mock('./theme', () => ({ initThemeFromStorage: vi.fn() }))
vi.mock('./wallpaper', () => ({ loadSavedWallpaper: vi.fn() }))
vi.mock('./retro-fx', () => ({ initRetroFxFromStorage: vi.fn() }))
vi.mock('./os-sound', () => ({ initOsSound: vi.fn() }))
vi.mock('./os-systray', () => ({ initSystray: vi.fn(), syncSettingsSoundToggle: vi.fn() }))
vi.mock('./matrix-bg', () => ({ initMatrixBg: vi.fn() }))
vi.mock('./boot-splash', () => ({ runBootSplash: vi.fn(() => Promise.resolve()) }))
vi.mock('./desktop', () => ({ Desktop: vi.fn() }))

// Typed handles to the mocked collaborators.
const mDismiss = vi.mocked(dismissLegacyOnboardingUi)
const mTheme = vi.mocked(initThemeFromStorage)
const mWallpaper = vi.mocked(loadSavedWallpaper)
const mRetro = vi.mocked(initRetroFxFromStorage)
const mSound = vi.mocked(initOsSound)
const mSystray = vi.mocked(initSystray)
const mSyncToggle = vi.mocked(syncSettingsSoundToggle)
const mMatrix = vi.mocked(initMatrixBg)
const mBoot = vi.mocked(runBootSplash)
const mDesktop = vi.mocked(Desktop)

/** Build the HTML shell the bootstrapper expects: #desktop + #matrix-bg canvas. */
function mountShell(opts: { desktop?: boolean; matrix?: boolean } = {}): {
  desktopEl: HTMLElement | null
  matrixEl: HTMLCanvasElement | null
} {
  document.body.innerHTML = ''
  let desktopEl: HTMLElement | null = null
  let matrixEl: HTMLCanvasElement | null = null
  if (opts.desktop !== false) {
    desktopEl = document.createElement('div')
    desktopEl.id = 'desktop'
    document.body.appendChild(desktopEl)
  }
  if (opts.matrix !== false) {
    matrixEl = document.createElement('canvas')
    matrixEl.id = 'matrix-bg'
    document.body.appendChild(matrixEl)
  }
  return { desktopEl, matrixEl }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
  document.body.innerHTML = ''
  // `requestIdleCallback` is not part of happy-dom; clear anything a test added.
  delete (globalThis as { requestIdleCallback?: unknown }).requestIdleCallback
  delete (globalThis as { cancelIdleCallback?: unknown }).cancelIdleCallback
})

describe('bootstrapShellUi', () => {
  beforeEach(() => {
    // No requestIdleCallback by default — drives the window.setTimeout fallback path.
    delete (globalThis as { requestIdleCallback?: unknown }).requestIdleCallback
  })

  it('runs every pre-mount init exactly once, in source order', async () => {
    mountShell()
    await bootstrapShellUi()

    expect(mDismiss).toHaveBeenCalledTimes(1)
    expect(mTheme).toHaveBeenCalledTimes(1)
    expect(mWallpaper).toHaveBeenCalledTimes(1)
    expect(mRetro).toHaveBeenCalledTimes(1)
    expect(mSound).toHaveBeenCalledTimes(1)
    expect(mSystray).toHaveBeenCalledTimes(1)

    // Source order: dismiss → theme → wallpaper → retro → sound → systray.
    const order = [
      mDismiss.mock.invocationCallOrder[0],
      mTheme.mock.invocationCallOrder[0],
      mWallpaper.mock.invocationCallOrder[0],
      mRetro.mock.invocationCallOrder[0],
      mSound.mock.invocationCallOrder[0],
      mSystray.mock.invocationCallOrder[0],
    ]
    expect(order).toEqual([...order].sort((a, b) => a - b))
  })

  it('mounts the Desktop with the #desktop element, after the boot splash resolves', async () => {
    const { desktopEl } = mountShell()
    await bootstrapShellUi()

    expect(mBoot).toHaveBeenCalledTimes(1)
    expect(mDesktop).toHaveBeenCalledTimes(1)
    expect(mDesktop).toHaveBeenCalledWith(desktopEl)
    expect(mDesktop.mock.instances).toHaveLength(1)
    // Desktop is constructed strictly after runBootSplash was invoked.
    expect(mDesktop.mock.invocationCallOrder[0]).toBeGreaterThan(
      mBoot.mock.invocationCallOrder[0],
    )
  })

  it('aborts with a console.error and does NOT mount Desktop when #desktop is missing', async () => {
    mountShell({ desktop: false })
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await bootstrapShellUi()

    expect(errSpy).toHaveBeenCalledWith('[bootstrap-shell] Missing #desktop.')
    expect(mDesktop).not.toHaveBeenCalled()
    expect(mBoot).not.toHaveBeenCalled()
    expect(mMatrix).not.toHaveBeenCalled()
    // The early-running inits still fired before the guard.
    expect(mDismiss).toHaveBeenCalledTimes(1)
    expect(mSystray).toHaveBeenCalledTimes(1)
  })

  it('uses requestIdleCallback when present, initializing the matrix canvas and re-syncing the toggle', async () => {
    const { desktopEl, matrixEl } = mountShell()
    // Stub a synchronous requestIdleCallback so the deferred work runs inline.
    const ric = vi.fn<(cb: () => void, opts?: { timeout?: number }) => number>((cb) => {
      cb()
      return 1
    })
    vi.stubGlobal('requestIdleCallback', ric)

    await bootstrapShellUi()

    expect(ric).toHaveBeenCalledTimes(1)
    expect(ric.mock.calls[0][1]).toEqual({ timeout: 2400 })
    expect(mMatrix).toHaveBeenCalledTimes(1)
    expect(mMatrix).toHaveBeenCalledWith(matrixEl, desktopEl)
    // syncSettingsSoundToggle runs twice: once eagerly, once inside the idle run().
    expect(mSyncToggle).toHaveBeenCalledTimes(2)
  })

  it('falls back to window.setTimeout(16) when requestIdleCallback is absent', async () => {
    vi.useFakeTimers()
    const { desktopEl, matrixEl } = mountShell()
    expect(typeof (globalThis as { requestIdleCallback?: unknown }).requestIdleCallback).toBe(
      'undefined',
    )
    const setTimeoutSpy = vi.spyOn(window, 'setTimeout')

    await bootstrapShellUi()

    // The deferred matrix work is scheduled via window.setTimeout(run, 16).
    const matrixCall = setTimeoutSpy.mock.calls.find((c) => c[1] === 16)
    expect(matrixCall).toBeDefined()
    // Not run yet — the timer is still pending.
    expect(mMatrix).not.toHaveBeenCalled()

    vi.runAllTimers()

    expect(mMatrix).toHaveBeenCalledTimes(1)
    expect(mMatrix).toHaveBeenCalledWith(matrixEl, desktopEl)
    expect(mSyncToggle).toHaveBeenCalledTimes(2)
  })

  it('skips matrix init (no canvas branch) when #matrix-bg is missing but still mounts Desktop', async () => {
    const { desktopEl } = mountShell({ matrix: false })
    // requestIdleCallback present so the scheduler reaches the canvas guard.
    const ric = vi.fn<(cb: () => void) => number>((cb) => {
      cb()
      return 1
    })
    vi.stubGlobal('requestIdleCallback', ric)

    await bootstrapShellUi()

    // The canvas guard returns before scheduling any idle/timeout work.
    expect(ric).not.toHaveBeenCalled()
    expect(mMatrix).not.toHaveBeenCalled()
    // Only the eager syncSettingsSoundToggle ran (no second call from run()).
    expect(mSyncToggle).toHaveBeenCalledTimes(1)
    // Desktop still mounts with the desktop element.
    expect(mDesktop).toHaveBeenCalledWith(desktopEl)
  })
})
