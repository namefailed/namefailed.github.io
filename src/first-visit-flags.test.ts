// @vitest-environment happy-dom
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import {
  clearFirstVisitFlags,
  dismissLegacyOnboardingUi,
  FIRST_RUN_KEY,
  SUPPRESSED_LEGACY_KEYS,
} from './first-visit-flags'
import { BOOT_SPLASH_KEY } from './boot-splash'
import { GUIDE_KEY } from './welcome-guide'
import { EMPTY_HINT_KEY } from './desktop-empty-cta'

class MockStorage implements Storage {
  private data = new Map<string, string>()
  get length() { return this.data.size }
  getItem(key: string) { return this.data.get(key) ?? null }
  setItem(key: string, value: string) { this.data.set(key, value) }
  removeItem(key: string) { this.data.delete(key) }
  clear() { this.data.clear() }
  key(index: number) { return [...this.data.keys()][index] ?? null }
}
;(globalThis as unknown as { localStorage: Storage }).localStorage = new MockStorage()

// Capture the genuine happy-dom DOM globals before the stubbing beforeAll below
// clobbers them, so the observer-path block can restore real implementations.
const realHappyDomDocument = globalThis.document
const realHappyDomMutationObserver = globalThis.MutationObserver

beforeAll(() => {
  ;(globalThis as unknown as { window: unknown }).window = {
    localStorage,
    setTimeout: (fn: () => void, _ms: number) => { fn(); return 0 },
  }
  ;(globalThis as unknown as { document: Document }).document = {
    body: null,
    querySelectorAll: () => [] as unknown as NodeListOf<Element>,
    addEventListener: () => {},
  } as unknown as Document
  ;(globalThis as unknown as { MutationObserver: typeof MutationObserver }).MutationObserver =
    class {
      observe(): void {}
      disconnect(): void {}
    } as unknown as typeof MutationObserver
})

const allFirstVisitKeys = [
  BOOT_SPLASH_KEY,
  GUIDE_KEY,
  EMPTY_HINT_KEY,
  ...SUPPRESSED_LEGACY_KEYS,
]

describe('dismissLegacyOnboardingUi', () => {
  beforeEach(() => localStorage.clear())

  it('marks suppressed legacy keys as dismissed', () => {
    dismissLegacyOnboardingUi()
    expect(localStorage.getItem(FIRST_RUN_KEY)).toBe('1')
    expect(localStorage.getItem('mrgrey-hint-portfolio-folder')).toBe('1')
    expect(localStorage.getItem('mrgrey-hint-apps-folder')).toBe('1')
    expect(localStorage.getItem('mrgrey-hint-games-folder')).toBe('1')
  })

  it('does not mark the welcome guide as seen', () => {
    dismissLegacyOnboardingUi()
    expect(localStorage.getItem(GUIDE_KEY)).toBeNull()
  })

  it('removes legacy hint bubble nodes from the DOM', () => {
    const remove = vi.fn()
    const bubble = { remove } as unknown as Element
    vi.spyOn(document, 'querySelectorAll').mockReturnValue([bubble] as unknown as NodeListOf<Element>)
    dismissLegacyOnboardingUi()
    expect(remove).toHaveBeenCalledOnce()
  })
})

describe('clearFirstVisitFlags', () => {
  beforeEach(() => localStorage.clear())

  it('removes all first-visit flag keys when they are set', () => {
    for (const key of allFirstVisitKeys) {
      localStorage.setItem(key, '1')
    }
    clearFirstVisitFlags()
    for (const key of allFirstVisitKeys) {
      expect(localStorage.getItem(key)).toBeNull()
    }
  })

  it('is a no-op when no flags are set (does not throw)', () => {
    expect(() => clearFirstVisitFlags()).not.toThrow()
  })

  it('does not remove unrelated keys (e.g. theme, wallpaper, apt)', () => {
    localStorage.setItem('mrgrey-theme', 'dracula')
    localStorage.setItem('mrgrey-wallpaper', '/wallpaper.jpg')
    localStorage.setItem('mrgrey-apt-cowsay', '1')
    clearFirstVisitFlags()
    expect(localStorage.getItem('mrgrey-theme')).toBe('dracula')
    expect(localStorage.getItem('mrgrey-wallpaper')).toBe('/wallpaper.jpg')
    expect(localStorage.getItem('mrgrey-apt-cowsay')).toBe('1')
  })
})

/**
 * Exercises the legacy-onboarding MutationObserver path (lines 34-46) against a
 * real happy-dom `document.body`. Each test resets the module so the
 * module-level `legacyOnboardingObserver` starts null, and swaps in a
 * controllable MutationObserver so nothing stays observing at teardown.
 */
describe('dismissLegacyOnboardingUi DOM observer path', () => {
  type FreshModule = typeof import('./first-visit-flags')

  class FakeMutationObserver {
    static instances: FakeMutationObserver[] = []
    callback: MutationCallback
    observe = vi.fn<(target: Node, options?: MutationObserverInit) => void>()
    disconnect = vi.fn<() => void>()
    takeRecords = vi.fn<() => MutationRecord[]>(() => [])
    constructor(cb: MutationCallback) {
      this.callback = cb
      FakeMutationObserver.instances.push(this)
    }
  }

  async function loadFresh(): Promise<FreshModule> {
    vi.resetModules()
    return import('./first-visit-flags')
  }

  function addLegacyNode(className: string): Element {
    const el = document.createElement('div')
    el.className = className
    document.body.appendChild(el)
    return el
  }

  beforeEach(() => {
    localStorage.clear()
    // Restore the genuine happy-dom document (the top-level beforeAll swapped in
    // a body:null stub) and reset its tree to a clean head+body.
    ;(globalThis as unknown as { document: Document }).document = realHappyDomDocument
    document.documentElement.innerHTML = '<head></head><body></body>'
    FakeMutationObserver.instances = []
    ;(globalThis as unknown as { MutationObserver: typeof MutationObserver }).MutationObserver =
      FakeMutationObserver as unknown as typeof MutationObserver
  })

  afterEach(() => {
    ;(globalThis as unknown as { MutationObserver: typeof MutationObserver }).MutationObserver =
      realHappyDomMutationObserver
    vi.restoreAllMocks()
  })

  it('observes document.body and purges existing legacy nodes on first dismissal', async () => {
    const bubble = addLegacyNode('hint-bubble')
    const toast = addLegacyNode('intro-toast')
    const keep = addLegacyNode('regular-node')

    const mod = await loadFresh()
    mod.dismissLegacyOnboardingUi()

    expect(FakeMutationObserver.instances).toHaveLength(1)
    const obs = FakeMutationObserver.instances[0]
    expect(obs.observe).toHaveBeenCalledOnce()
    expect(obs.observe).toHaveBeenCalledWith(document.body, { childList: true, subtree: true })

    // The initial purge inside start() removed the legacy nodes immediately.
    expect(document.body.contains(bubble)).toBe(false)
    expect(document.body.contains(toast)).toBe(false)
    expect(document.body.contains(keep)).toBe(true)
  })

  it('does not create a second observer when called again', async () => {
    const mod = await loadFresh()
    mod.dismissLegacyOnboardingUi()
    mod.dismissLegacyOnboardingUi()

    expect(FakeMutationObserver.instances).toHaveLength(1)
    expect(FakeMutationObserver.instances[0].observe).toHaveBeenCalledOnce()
  })

  it('purges legacy nodes added later via the observer callback', async () => {
    const mod = await loadFresh()
    mod.dismissLegacyOnboardingUi()

    const lateBubble = addLegacyNode('hint-bubble')
    expect(document.body.contains(lateBubble)).toBe(true)

    // Simulate the MutationObserver firing for the newly inserted node.
    FakeMutationObserver.instances[0].callback([], FakeMutationObserver.instances[0] as unknown as MutationObserver)
    expect(document.body.contains(lateBubble)).toBe(false)
  })

  it('defers observer setup until DOMContentLoaded when body is absent', async () => {
    // Strip the body so ensureLegacyOnboardingObserver takes the addEventListener branch.
    document.documentElement.removeChild(document.body)
    expect(document.body).toBeFalsy()

    const mod = await loadFresh()
    mod.dismissLegacyOnboardingUi()

    // The observer object is built eagerly, but start() (and thus observe) is
    // deferred to the DOMContentLoaded listener while body is absent.
    expect(FakeMutationObserver.instances).toHaveLength(1)
    expect(FakeMutationObserver.instances[0].observe).not.toHaveBeenCalled()

    const body = document.createElement('body')
    document.documentElement.appendChild(body)
    const lateBubble = addLegacyNode('intro-toast')

    document.dispatchEvent(new Event('DOMContentLoaded'))

    expect(FakeMutationObserver.instances[0].observe).toHaveBeenCalledWith(
      document.body,
      { childList: true, subtree: true },
    )
    expect(document.body.contains(lateBubble)).toBe(false)
  })

  it('still persists the suppression flags before touching the DOM', async () => {
    const mod = await loadFresh()
    mod.dismissLegacyOnboardingUi()
    for (const key of SUPPRESSED_LEGACY_KEYS) {
      expect(localStorage.getItem(key)).toBe('1')
    }
  })
})
