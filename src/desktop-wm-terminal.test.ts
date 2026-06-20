// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest'
import { initYasbLauncherChrome, type YasbLauncherChromeHost } from './desktop-wm-terminal'
import type { LauncherOverlayFlags } from './desktop-launcher-overlay'

/**
 * Build a host whose overlay flags and callbacks are observable. `visible`
 * seeds the launcherOverlayVisible() input (showingDesktop OR launcherOpen).
 */
function makeHost(visible = false): YasbLauncherChromeHost & {
  onApplicationsClick: Mock<() => void>
  onCloseLauncher: Mock<() => void>
  launcherOverlay: LauncherOverlayFlags
} {
  return {
    launcherOverlay: { showingDesktop: visible, launcherOpen: false },
    onApplicationsClick: vi.fn<() => void>(),
    onCloseLauncher: vi.fn<() => void>(),
  }
}

describe('initYasbLauncherChrome', () => {
  // The module wires a capture-phase keydown listener onto the document and
  // never removes it. Track every document listener added during a test so
  // afterEach can strip them — otherwise stale listeners from a prior mount
  // fire on later tests (and leak into the full suite as teardown hazards).
  const origDocAdd = document.addEventListener.bind(document)
  let docListeners: Array<
    [string, EventListenerOrEventListenerObject, boolean | AddEventListenerOptions | undefined]
  > = []

  beforeEach(() => {
    docListeners = []
    document.addEventListener = ((
      type: string,
      fn: EventListenerOrEventListenerObject,
      opts?: boolean | AddEventListenerOptions,
    ): void => {
      docListeners.push([type, fn, opts])
      origDocAdd(type, fn, opts)
    }) as typeof document.addEventListener
    document.body.replaceChildren()
  })

  afterEach(() => {
    document.addEventListener = origDocAdd as typeof document.addEventListener
    for (const [type, fn, opts] of docListeners) document.removeEventListener(type, fn, opts)
    docListeners = []
    document.body.replaceChildren()
    vi.restoreAllMocks()
  })

  /** Create #btn-applications and #launcher-backdrop in the real document. */
  function mountChrome(): { btn: HTMLButtonElement; backdrop: HTMLElement } {
    const btn = document.createElement('button')
    btn.id = 'btn-applications'
    const backdrop = document.createElement('div')
    backdrop.id = 'launcher-backdrop'
    document.body.append(btn, backdrop)
    return { btn, backdrop }
  }

  function escapeEvent(init: KeyboardEventInit = {}): KeyboardEvent {
    return new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true, ...init })
  }

  it('Applications click stops propagation and calls onApplicationsClick', () => {
    const { btn } = mountChrome()
    const host = makeHost()
    initYasbLauncherChrome(host, document)

    const ev = new MouseEvent('click', { bubbles: true, cancelable: true })
    const stopSpy = vi.spyOn(ev, 'stopPropagation')
    btn.dispatchEvent(ev)

    expect(stopSpy).toHaveBeenCalledOnce()
    expect(host.onApplicationsClick).toHaveBeenCalledOnce()
    expect(host.onCloseLauncher).not.toHaveBeenCalled()
  })

  it('backdrop click calls onCloseLauncher', () => {
    const { backdrop } = mountChrome()
    const host = makeHost()
    initYasbLauncherChrome(host, document)

    backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(host.onCloseLauncher).toHaveBeenCalledOnce()
    expect(host.onApplicationsClick).not.toHaveBeenCalled()
  })

  it('Escape while the overlay is visible closes it and prevents default', () => {
    mountChrome()
    const host = makeHost(true) // showingDesktop true → overlay visible
    initYasbLauncherChrome(host, document)

    const ev = escapeEvent()
    document.dispatchEvent(ev)

    expect(host.onCloseLauncher).toHaveBeenCalledOnce()
    expect(ev.defaultPrevented).toBe(true)
  })

  it('Escape with launcherOpen (the other visibility flag) also closes', () => {
    mountChrome()
    const host = makeHost(false)
    host.launcherOverlay.launcherOpen = true // launcherOverlayVisible → true via the OR
    initYasbLauncherChrome(host, document)

    document.dispatchEvent(escapeEvent())

    expect(host.onCloseLauncher).toHaveBeenCalledOnce()
  })

  it('Escape while the overlay is hidden is ignored (no close, no preventDefault)', () => {
    mountChrome()
    const host = makeHost(false) // both flags false → overlay not visible
    initYasbLauncherChrome(host, document)

    const ev = escapeEvent()
    document.dispatchEvent(ev)

    expect(host.onCloseLauncher).not.toHaveBeenCalled()
    expect(ev.defaultPrevented).toBe(false)
  })

  it('a non-Escape key is ignored even while the overlay is visible', () => {
    mountChrome()
    const host = makeHost(true)
    initYasbLauncherChrome(host, document)

    const ev = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true })
    document.dispatchEvent(ev)

    expect(host.onCloseLauncher).not.toHaveBeenCalled()
    expect(ev.defaultPrevented).toBe(false)
  })

  it.each([
    ['ctrlKey', { ctrlKey: true }],
    ['altKey', { altKey: true }],
    ['metaKey', { metaKey: true }],
  ])('Escape combined with %s is ignored (modifier guard)', (_label, mods) => {
    mountChrome()
    const host = makeHost(true)
    initYasbLauncherChrome(host, document)

    const ev = escapeEvent(mods)
    document.dispatchEvent(ev)

    expect(host.onCloseLauncher).not.toHaveBeenCalled()
    expect(ev.defaultPrevented).toBe(false)
  })

  it('is a no-op safely when the chrome elements are absent (optional-chaining guards)', () => {
    // No #btn-applications / #launcher-backdrop in the DOM.
    const host = makeHost(true)
    expect(() => initYasbLauncherChrome(host, document)).not.toThrow()

    // The keydown listener is still wired even without the buttons.
    document.dispatchEvent(escapeEvent())
    expect(host.onCloseLauncher).toHaveBeenCalledOnce()
  })

  it('defaults to the global document when no doc argument is given', () => {
    const { btn } = mountChrome()
    const host = makeHost()
    initYasbLauncherChrome(host) // exercises the `doc = document` default

    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(host.onApplicationsClick).toHaveBeenCalledOnce()
  })
})
