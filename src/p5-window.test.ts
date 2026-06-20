// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { P5Window, type P5WindowOptions } from './p5-window'
import { P5_EXAMPLES, sketchFilename } from './p5-sketches'
import { vfsReadRaw, vfsWrite, vfsMkdir, vfsReset, vfsRm } from './os-fs'

function opts(over: Partial<P5WindowOptions> = {}): P5WindowOptions {
  return {
    initialVfsPath: null,
    onOpenWindow: vi.fn(),
    onClose: vi.fn(),
    onMinimize: vi.fn(),
    onMaximize: vi.fn(),
    onFocus: vi.fn(),
    ...over,
  }
}

/** Find a toolbar button in the window by its visible text. */
function btn(win: P5Window, text: string): HTMLButtonElement | undefined {
  return [...win.el.querySelectorAll('button')].find(
    b => b.textContent === text,
  ) as HTMLButtonElement | undefined
}

const labelEl = (win: P5Window): HTMLElement =>
  win.el.querySelector('.p5-label') as HTMLElement
const errorBanner = (win: P5Window): HTMLElement =>
  win.el.querySelector('.p5-error-banner') as HTMLElement
const iframe = (win: P5Window): HTMLIFrameElement =>
  win.el.querySelector('iframe.p5-iframe') as HTMLIFrameElement
/** Real src value stashed by the test's prototype src-setter (see beforeEach). */
const iframeSrc = (win: P5Window): string =>
  (iframe(win) as unknown as { __src?: string }).__src ?? ''
const emptyState = (win: P5Window): HTMLElement =>
  win.el.querySelector('.p5-empty-state') as HTMLElement
const iframeHost = (win: P5Window): HTMLElement =>
  win.el.querySelector('.p5-iframe-host') as HTMLElement
const dropOverlay = (win: P5Window): HTMLElement =>
  win.el.querySelector('.p5-drop-overlay') as HTMLElement

describe('P5Window', () => {
  let created = 0
  const blobUrls: string[] = []

  // happy-dom tries to *navigate* an attached iframe whenever its `src` is set,
  // and chokes on our mock `blob:` URLs with a noisy DOMException. Replace the
  // src accessor with a plain string store so the value round-trips for our
  // assertions without triggering a fetch.
  const origSrcDescriptor = Object.getOwnPropertyDescriptor(
    HTMLIFrameElement.prototype,
    'src',
  )

  beforeEach(() => {
    document.body.replaceChildren()
    localStorage.clear()
    vfsReset() // start every test from a pristine in-memory VFS tree
    created = 0
    blobUrls.length = 0

    // The getter intentionally returns '' so happy-dom's connect-time
    // navigation never sees a blob URL to fetch; the real value is stashed on
    // `__src` and read by the `iframeSrc()` helper for assertions.
    Object.defineProperty(HTMLIFrameElement.prototype, 'src', {
      configurable: true,
      get() {
        return ''
      },
      set(this: { __src?: string }, value: string) {
        this.__src = value
      },
    })

    // URL blob lifecycle — track create/revoke so we can assert on them.
    globalThis.URL.createObjectURL = vi.fn(() => {
      const url = `blob:mock/${created++}`
      blobUrls.push(url)
      return url
    }) as unknown as typeof URL.createObjectURL
    globalThis.URL.revokeObjectURL = vi.fn() as unknown as typeof URL.revokeObjectURL
  })

  afterEach(() => {
    localStorage.clear()
    vfsReset() // leave no VFS drift for the rest of the suite
    if (origSrcDescriptor) {
      Object.defineProperty(HTMLIFrameElement.prototype, 'src', origSrcDescriptor)
    }
  })

  // ── construction & first-run ────────────────────────────────────────────────

  it('mounts chrome, p5 classes, and toolbar controls', () => {
    const win = new P5Window(opts())
    document.body.appendChild(win.el)

    expect(win.el.classList.contains('p5-app')).toBe(true)
    expect(win.el.dataset.app).toBe('p5')
    expect(win.command).toBe('p5')
    expect(win.el.querySelector('.p5-stack')).not.toBeNull()
    expect(win.el.querySelector('.p5-toolbar')).not.toBeNull()
    expect(btn(win, '▶ Run')).toBeDefined()
    expect(btn(win, 'Edit')).toBeDefined()
    expect(btn(win, 'Open…')).toBeDefined()
    expect(btn(win, 'Examples ▾')).toBeDefined()
    win.dispose()
  })

  it('auto-runs the first example when no initial VFS path is given', () => {
    const win = new P5Window(opts())
    const first = P5_EXAMPLES[0]!

    // The label shows the example title; the iframe points at a blob URL.
    expect(labelEl(win).textContent).toBe(first.label)
    expect(iframeSrc(win)).toBe('blob:mock/0')
    expect(emptyState(win).style.display).toBe('none')
    expect(btn(win, '▶ Run')!.disabled).toBe(false)
    expect(btn(win, 'Edit')!.disabled).toBe(false)
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
    win.dispose()
  })

  it('forwards the constructor callbacks to chrome traffic-light buttons', () => {
    const o = opts()
    const win = new P5Window(o)
    document.body.appendChild(win.el)
    ;(win.el.querySelector('.dot-close') as HTMLElement).click()
    ;(win.el.querySelector('.dot-min') as HTMLElement).click()
    ;(win.el.querySelector('.dot-max') as HTMLElement).click()
    expect(o.onClose).toHaveBeenCalledTimes(1)
    expect(o.onMinimize).toHaveBeenCalledTimes(1)
    expect(o.onMaximize).toHaveBeenCalledTimes(1)
    win.dispose()
  })

  // ── initialVfsPath branch ───────────────────────────────────────────────────

  it('loads from VFS on construction when initialVfsPath is provided', () => {
    vfsMkdir('/home/namefailed/p5.js')
    vfsWrite('/home/namefailed/p5.js/seed.js', 'function setup(){}')
    const win = new P5Window(opts({ initialVfsPath: '/home/namefailed/p5.js/seed.js' }))

    expect(labelEl(win).textContent).toBe('seed.js')
    expect(iframeSrc(win)).toBe('blob:mock/0')
    expect(errorBanner(win).hidden).toBe(true)
    win.dispose()
  })

  it('shows an error and does not run when initialVfsPath is missing in the VFS', () => {
    const win = new P5Window(opts({ initialVfsPath: '/no/such/file.js' }))

    expect(labelEl(win).textContent).toBe('not found: /no/such/file.js')
    expect(errorBanner(win).hidden).toBe(false)
    expect(errorBanner(win).textContent).toContain('Could not read /no/such/file.js')
    // run() never fired, so no blob was created.
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    win.dispose()
  })

  // ── Run button ──────────────────────────────────────────────────────────────

  it('re-runs the current sketch (new blob, old one revoked) when Run is clicked', () => {
    const win = new P5Window(opts())
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1) // first example
    btn(win, '▶ Run')!.click()
    expect(URL.createObjectURL).toHaveBeenCalledTimes(2)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock/0')
    expect(iframeSrc(win)).toBe('blob:mock/1')
    win.dispose()
  })

  // ── Examples dropdown ───────────────────────────────────────────────────────

  it('opens and closes the examples dropdown on toggle', () => {
    const win = new P5Window(opts())
    document.body.appendChild(win.el)
    const examplesBtn = btn(win, 'Examples ▾')!

    expect(win.el.querySelector('.p5-dropdown')).toBeNull()
    examplesBtn.click()
    const menu = win.el.querySelector('.p5-dropdown')
    expect(menu).not.toBeNull()
    expect(menu!.querySelectorAll('.p5-dropdown-item').length).toBe(P5_EXAMPLES.length)
    // toggling again closes it
    examplesBtn.click()
    expect(win.el.querySelector('.p5-dropdown')).toBeNull()
    win.dispose()
  })

  it('runs the chosen example and closes the dropdown when an item is clicked', () => {
    const win = new P5Window(opts())
    document.body.appendChild(win.el)
    btn(win, 'Examples ▾')!.click()

    const target = P5_EXAMPLES[2]!
    const item = [...win.el.querySelectorAll('.p5-dropdown-item')].find(
      el => el.textContent === target.label,
    ) as HTMLButtonElement
    item.click()

    expect(labelEl(win).textContent).toBe(target.label)
    expect(win.el.querySelector('.p5-dropdown')).toBeNull()
    win.dispose()
  })

  it('closes an open dropdown on an outside document click', () => {
    const win = new P5Window(opts())
    document.body.appendChild(win.el)
    btn(win, 'Examples ▾')!.click()
    expect(win.el.querySelector('.p5-dropdown')).not.toBeNull()

    document.body.click() // outside the dropdown
    expect(win.el.querySelector('.p5-dropdown')).toBeNull()
    win.dispose()
  })

  it('keeps the dropdown open when clicking inside it', () => {
    const win = new P5Window(opts())
    document.body.appendChild(win.el)
    btn(win, 'Examples ▾')!.click()
    const menu = win.el.querySelector('.p5-dropdown') as HTMLElement
    menu.click() // inside
    expect(win.el.querySelector('.p5-dropdown')).not.toBeNull()
    win.dispose()
  })

  // ── Edit button / editCurrent ───────────────────────────────────────────────

  it('persists an example sketch to the VFS and opens the editor on Edit', () => {
    const onOpenWindow = vi.fn()
    const win = new P5Window(opts({ onOpenWindow }))
    const first = P5_EXAMPLES[0]!

    btn(win, 'Edit')!.click()

    const expectedPath = `/home/namefailed/p5.js/${sketchFilename(first.label)}`
    expect(onOpenWindow).toHaveBeenCalledTimes(1)
    expect(onOpenWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        command: 'edit',
        title: `edit — ${expectedPath}`,
        editorPath: expectedPath,
      }),
    )
    // The sketch was actually written to the VFS.
    const read = vfsReadRaw(expectedPath)
    expect(read.ok).toBe(true)
    if (read.ok) expect(read.body).toBe(first.code)
    win.dispose()
  })

  it('shows an error and does not open the editor when the VFS save fails', () => {
    // Replace the seeded example *file* with a *directory* at the exact path
    // editCurrent will try to write to, so vfsWrite returns an "is a directory"
    // error. (vfsReset seeds the examples as files, so remove first.)
    const first = P5_EXAMPLES[0]!
    const target = `/home/namefailed/p5.js/${sketchFilename(first.label)}`
    vfsRm(target)
    expect(vfsMkdir(target)).toBeNull()

    const onOpenWindow = vi.fn()
    const win = new P5Window(opts({ onOpenWindow }))
    btn(win, 'Edit')!.click()

    expect(onOpenWindow).not.toHaveBeenCalled()
    expect(errorBanner(win).hidden).toBe(false)
    expect(errorBanner(win).textContent).toContain(`Could not save sketch to ${target}`)
    win.dispose()
  })

  it('reuses the existing VFS path on Edit for a VFS-loaded sketch (no duplicate write)', () => {
    vfsMkdir('/home/namefailed/p5.js')
    vfsWrite('/home/namefailed/p5.js/mine.js', 'function setup(){}')
    const onOpenWindow = vi.fn()
    const win = new P5Window(
      opts({ onOpenWindow, initialVfsPath: '/home/namefailed/p5.js/mine.js' }),
    )

    btn(win, 'Edit')!.click()
    expect(onOpenWindow).toHaveBeenCalledWith(
      expect.objectContaining({ editorPath: '/home/namefailed/p5.js/mine.js' }),
    )
    win.dispose()
  })

  // ── VFS open modal ──────────────────────────────────────────────────────────

  it('toggles the VFS open modal and pre-fills the current path', () => {
    vfsMkdir('/home/namefailed/p5.js')
    vfsWrite('/home/namefailed/p5.js/mine.js', 'function setup(){}')
    const win = new P5Window(opts({ initialVfsPath: '/home/namefailed/p5.js/mine.js' }))
    document.body.appendChild(win.el)

    btn(win, 'Open…')!.click()
    const modal = win.el.querySelector('.p5-vfs-modal') as HTMLElement
    expect(modal).not.toBeNull()
    const input = modal.querySelector('.p5-vfs-modal-input') as HTMLInputElement
    expect(input.value).toBe('/home/namefailed/p5.js/mine.js')

    // Clicking Open… again removes the modal.
    btn(win, 'Open…')!.click()
    expect(win.el.querySelector('.p5-vfs-modal')).toBeNull()
    win.dispose()
  })

  it('loads the typed path from the modal Open button', () => {
    vfsMkdir('/home/namefailed/p5.js')
    vfsWrite('/home/namefailed/p5.js/typed.js', 'function setup(){}')
    const win = new P5Window(opts())
    document.body.appendChild(win.el)

    btn(win, 'Open…')!.click()
    const modal = win.el.querySelector('.p5-vfs-modal') as HTMLElement
    const input = modal.querySelector('.p5-vfs-modal-input') as HTMLInputElement
    input.value = '/home/namefailed/p5.js/typed.js'
    const openBtn = [...modal.querySelectorAll('button')].find(
      b => b.textContent === 'Open',
    ) as HTMLButtonElement
    openBtn.click()

    expect(labelEl(win).textContent).toBe('typed.js')
    expect(win.el.querySelector('.p5-vfs-modal')).toBeNull()
    win.dispose()
  })

  it('cancels the modal without loading anything', () => {
    const win = new P5Window(opts())
    document.body.appendChild(win.el)
    btn(win, 'Open…')!.click()
    const modal = win.el.querySelector('.p5-vfs-modal') as HTMLElement
    const cancelBtn = [...modal.querySelectorAll('button')].find(
      b => b.textContent === 'Cancel',
    ) as HTMLButtonElement
    cancelBtn.click()
    expect(win.el.querySelector('.p5-vfs-modal')).toBeNull()
    win.dispose()
  })

  it('submits the modal on Enter and dismisses it on Escape', () => {
    vfsMkdir('/home/namefailed/p5.js')
    vfsWrite('/home/namefailed/p5.js/enter.js', 'function setup(){}')
    const win = new P5Window(opts())
    document.body.appendChild(win.el)

    // Enter submits.
    btn(win, 'Open…')!.click()
    let input = win.el.querySelector('.p5-vfs-modal-input') as HTMLInputElement
    input.value = '/home/namefailed/p5.js/enter.js'
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(win.el.querySelector('.p5-vfs-modal')).toBeNull()
    expect(labelEl(win).textContent).toBe('enter.js')

    // Escape dismisses without loading.
    btn(win, 'Open…')!.click()
    input = win.el.querySelector('.p5-vfs-modal-input') as HTMLInputElement
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(win.el.querySelector('.p5-vfs-modal')).toBeNull()
    win.dispose()
  })

  it('does not load when the modal Open is clicked with a blank path', () => {
    const win = new P5Window(opts())
    document.body.appendChild(win.el)
    const labelBefore = labelEl(win).textContent

    btn(win, 'Open…')!.click()
    const modal = win.el.querySelector('.p5-vfs-modal') as HTMLElement
    const input = modal.querySelector('.p5-vfs-modal-input') as HTMLInputElement
    input.value = '   '
    const openBtn = [...modal.querySelectorAll('button')].find(
      b => b.textContent === 'Open',
    ) as HTMLButtonElement
    openBtn.click()

    expect(win.el.querySelector('.p5-vfs-modal')).toBeNull()
    expect(labelEl(win).textContent).toBe(labelBefore) // unchanged
    win.dispose()
  })

  // ── postMessage error forwarding ────────────────────────────────────────────

  it('shows an error banner for a matching-nonce p5-error message', () => {
    const win = new P5Window(opts())
    // The instance nonce is private; resolve it from the iframe's blob HTML is
    // not available, so drive the handler through the real window event by
    // matching whatever nonce the iframe was built with. Instead we assert the
    // happy path: post with the stored nonce.
    const nonce = (win as unknown as { iframeNonce: string }).iframeNonce
    window.dispatchEvent(
      new MessageEvent('message', { data: { kind: 'p5-error', nonce, message: 'boom' } }),
    )
    expect(errorBanner(win).hidden).toBe(false)
    expect(errorBanner(win).textContent).toBe('⚠ boom')
    win.dispose()
  })

  it('ignores p5-error messages with a non-matching nonce', () => {
    const win = new P5Window(opts())
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { kind: 'p5-error', nonce: 'other-tile', message: 'nope' },
      }),
    )
    expect(errorBanner(win).hidden).toBe(true)
    win.dispose()
  })

  it('ignores non-p5-error and malformed messages', () => {
    const win = new P5Window(opts())
    const nonce = (win as unknown as { iframeNonce: string }).iframeNonce
    window.dispatchEvent(new MessageEvent('message', { data: null }))
    window.dispatchEvent(new MessageEvent('message', { data: 'a string' }))
    window.dispatchEvent(
      new MessageEvent('message', { data: { kind: 'other', nonce } }),
    )
    expect(errorBanner(win).hidden).toBe(true)
    win.dispose()
  })

  it('falls back to a default message when p5-error has no string message', () => {
    const win = new P5Window(opts())
    const nonce = (win as unknown as { iframeNonce: string }).iframeNonce
    window.dispatchEvent(
      new MessageEvent('message', { data: { kind: 'p5-error', nonce, message: 42 } }),
    )
    expect(errorBanner(win).textContent).toBe('⚠ Sketch failed')
    win.dispose()
  })

  // ── drag & drop ─────────────────────────────────────────────────────────────

  it('activates and clears the drop overlay on dragover/dragleave', () => {
    const win = new P5Window(opts())
    document.body.appendChild(win.el)
    const host = iframeHost(win)
    const overlay = dropOverlay(win)

    host.dispatchEvent(new Event('dragover', { bubbles: true }))
    expect(overlay.classList.contains('p5-drop-overlay--active')).toBe(true)

    // dragleave with relatedTarget outside the host clears the overlay.
    const leave = new Event('dragleave', { bubbles: true }) as DragEvent
    Object.defineProperty(leave, 'relatedTarget', { value: document.body })
    host.dispatchEvent(leave)
    expect(overlay.classList.contains('p5-drop-overlay--active')).toBe(false)
    win.dispose()
  })

  it('keeps the overlay active on dragleave onto a child node', () => {
    const win = new P5Window(opts())
    document.body.appendChild(win.el)
    const host = iframeHost(win)
    const overlay = dropOverlay(win)

    host.dispatchEvent(new Event('dragover', { bubbles: true }))
    const leave = new Event('dragleave', { bubbles: true }) as DragEvent
    Object.defineProperty(leave, 'relatedTarget', { value: iframe(win) }) // a child of host
    host.dispatchEvent(leave)
    expect(overlay.classList.contains('p5-drop-overlay--active')).toBe(true)
    win.dispose()
  })

  it('reads and runs a dropped .js file', async () => {
    const win = new P5Window(opts())
    const host = iframeHost(win)
    const file = new File(['function setup(){ /* dropped */ }'], 'dropped.js', {
      type: 'text/javascript',
    })

    const drop = new Event('drop', { bubbles: true }) as DragEvent
    Object.defineProperty(drop, 'dataTransfer', { value: { files: [file] } })
    host.dispatchEvent(drop)

    // FileReader is async — wait a tick for onload.
    await vi.waitFor(() => {
      expect(labelEl(win).textContent).toBe('dropped.js')
    })
    expect(win.el.querySelector('.p5-drop-overlay--active')).toBeNull()
    win.dispose()
  })

  it('rejects a dropped non-.js file with an error banner', () => {
    const win = new P5Window(opts())
    const host = iframeHost(win)
    const file = new File(['x'], 'image.png', { type: 'image/png' })
    const drop = new Event('drop', { bubbles: true }) as DragEvent
    Object.defineProperty(drop, 'dataTransfer', { value: { files: [file] } })
    host.dispatchEvent(drop)

    expect(errorBanner(win).hidden).toBe(false)
    expect(errorBanner(win).textContent).toContain('Only .js files are accepted')
    expect(errorBanner(win).textContent).toContain('image.png')
    win.dispose()
  })

  it('ignores a drop with no file', () => {
    const win = new P5Window(opts())
    const host = iframeHost(win)
    const labelBefore = labelEl(win).textContent
    const drop = new Event('drop', { bubbles: true }) as DragEvent
    Object.defineProperty(drop, 'dataTransfer', { value: { files: [] } })
    host.dispatchEvent(drop)
    expect(labelEl(win).textContent).toBe(labelBefore)
    win.dispose()
  })

  it('surfaces an error banner when reading a dropped file fails', () => {
    const origFileReader = globalThis.FileReader
    // A FileReader stub whose readAsText synchronously invokes onerror.
    class FailingReader {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      result: string | null = null
      readAsText(): void {
        this.onerror?.()
      }
    }
    globalThis.FileReader = FailingReader as unknown as typeof FileReader

    try {
      const win = new P5Window(opts())
      const host = iframeHost(win)
      const file = new File(['x'], 'broken.js', { type: 'text/javascript' })
      const drop = new Event('drop', { bubbles: true }) as DragEvent
      Object.defineProperty(drop, 'dataTransfer', { value: { files: [file] } })
      host.dispatchEvent(drop)

      expect(errorBanner(win).hidden).toBe(false)
      expect(errorBanner(win).textContent).toBe('⚠ Could not read broken.js')
      win.dispose()
    } finally {
      globalThis.FileReader = origFileReader
    }
  })

  // ── external API ────────────────────────────────────────────────────────────

  it('toggles active / minimized / maximized state via the public API', () => {
    const win = new P5Window(opts())
    expect(win.isMaximized()).toBe(false)

    win.setActive(true)
    expect(win.el.classList.contains('active')).toBe(true)
    win.setActive(false)
    expect(win.el.classList.contains('active')).toBe(false)

    win.setMinimized(true)
    expect(win.el.classList.contains('minimized')).toBe(true)
    win.setMinimized(false)
    expect(win.el.classList.contains('minimized')).toBe(false)

    win.el.classList.add('maximized')
    expect(win.isMaximized()).toBe(true)
    win.dispose()
  })

  it('scrollBy is a harmless no-op', () => {
    const win = new P5Window(opts())
    expect(() => win.scrollBy(50)).not.toThrow()
    win.dispose()
  })

  // ── dispose ─────────────────────────────────────────────────────────────────

  it('revokes the blob, blanks the iframe, and detaches global listeners on dispose', () => {
    const win = new P5Window(opts())
    document.body.appendChild(win.el)
    const theIframe = iframe(win)

    win.dispose()

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock/0')
    expect((theIframe as unknown as { __src?: string }).__src).toBe('about:blank')

    // After dispose, an outside document click must not crash, and a matching
    // postMessage must no longer surface a banner (listener removed).
    expect(() => document.body.click()).not.toThrow()
    const nonce = (win as unknown as { iframeNonce: string }).iframeNonce
    window.dispatchEvent(
      new MessageEvent('message', { data: { kind: 'p5-error', nonce, message: 'after' } }),
    )
    expect(errorBanner(win).hidden).toBe(true)
  })

  it('closes an open dropdown on dispose', () => {
    const win = new P5Window(opts())
    document.body.appendChild(win.el)
    btn(win, 'Examples ▾')!.click()
    expect(win.el.querySelector('.p5-dropdown')).not.toBeNull()
    win.dispose()
    expect(win.el.querySelector('.p5-dropdown')).toBeNull()
  })

  it('dispose is safe to call when no blob was ever created', () => {
    const win = new P5Window(opts({ initialVfsPath: '/missing.js' }))
    expect(() => win.dispose()).not.toThrow()
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
  })
})
