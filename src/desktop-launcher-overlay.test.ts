import { describe, it, expect } from 'vitest'
import {
  closeLauncherOverlayFlags,
  launcherOverlayVisible,
  openLauncherFromButtonFlags,
  toggleShowDesktopFlags,
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
