// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  FS_HOME,
  vfsReset,
  vfsListEntries,
  vfsReadRaw,
  vfsMkdir,
  vfsTouch,
  vfsWrite,
} from './os-fs'
import { WALLPAPER_KEY } from './wallpaper'
import { FileExplorerWindow } from './file-explorer-window'

// ── localStorage stub (repo MockStorage pattern) ─────────────────────────────
class MockStorage implements Storage {
  private data = new Map<string, string>()
  get length() {
    return this.data.size
  }
  getItem(key: string) {
    return this.data.get(key) ?? null
  }
  setItem(key: string, value: string) {
    this.data.set(key, value)
  }
  removeItem(key: string) {
    this.data.delete(key)
  }
  clear() {
    this.data.clear()
  }
  key(index: number) {
    return [...this.data.keys()][index] ?? null
  }
}

function opts(over: Partial<ConstructorParameters<typeof FileExplorerWindow>[0]> = {}) {
  return {
    initialPath: FS_HOME,
    onClose: vi.fn(),
    onMinimize: vi.fn(),
    onMaximize: vi.fn(),
    onFocus: vi.fn(),
    onOpenInEditor: vi.fn(),
    ...over,
  }
}

const FE_PREFS_KEY = 'portfolio-fe-prefs-v1'

describe('FileExplorerWindow', () => {
  const origGBCR = HTMLElement.prototype.getBoundingClientRect

  beforeEach(() => {
    ;(globalThis as unknown as { localStorage: Storage }).localStorage = new MockStorage()
    localStorage.clear()
    // Fresh default VFS tree in memory for every test.
    vfsReset()
    vi.useFakeTimers()
    document.body.replaceChildren()
    // happy-dom provides neither prompt nor confirm; install stubbable defaults.
    vi.stubGlobal('prompt', vi.fn<(msg?: string, def?: string) => string | null>(() => null))
    vi.stubGlobal('confirm', vi.fn<(msg?: string) => boolean>(() => false))
    // happy-dom lacks layout; give scrollBy/getBoundingClientRect harmless stubs.
    HTMLElement.prototype.getBoundingClientRect = vi.fn(
      () => ({ width: 600, height: 400, top: 0, left: 0, right: 600, bottom: 400, x: 0, y: 0 }),
    ) as unknown as typeof HTMLElement.prototype.getBoundingClientRect
  })

  afterEach(() => {
    // Drain the os-fs debounced save + the explorer flash timer before unfaking.
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    HTMLElement.prototype.getBoundingClientRect = origGBCR
    vfsReset()
    document.body.replaceChildren()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  /** Construct + mount the window into the body. */
  function mount(over: Partial<ConstructorParameters<typeof FileExplorerWindow>[0]> = {}) {
    const o = opts(over)
    const win = new FileExplorerWindow(o)
    document.body.appendChild(win.el)
    return { win, o }
  }

  const rows = (win: FileExplorerWindow): HTMLButtonElement[] =>
    [...win.el.querySelectorAll<HTMLButtonElement>('.fe-row')]
  const rowNamed = (win: FileExplorerWindow, name: string): HTMLButtonElement | undefined =>
    rows(win).find(r => r.querySelector('.fe-row-name')?.textContent === name)
  const body = (win: FileExplorerWindow) => win.el.querySelector('.fe-body') as HTMLElement
  const status = (win: FileExplorerWindow) =>
    (win.el.querySelector('.fe-status') as HTMLElement).textContent
  const btn = (win: FileExplorerWindow, label: string) =>
    [...win.el.querySelectorAll<HTMLButtonElement>('button')].find(
      b => b.getAttribute('aria-label') === label || b.title === label,
    )!

  const mockPrompt = (value: string | null) =>
    (window.prompt as unknown as ReturnType<typeof vi.fn>).mockReturnValue(value)
  const mockConfirm = (value: boolean) =>
    (window.confirm as unknown as ReturnType<typeof vi.fn>).mockReturnValue(value)

  // ── mount / chrome ─────────────────────────────────────────────────────────
  it('mounts with the file-explorer-app class and the explorer command', () => {
    const { win } = mount()
    expect(win.el.classList.contains('file-explorer-app')).toBe(true)
    expect(win.command).toBe('explorer')
    expect(win.getAbsPath()).toBe(FS_HOME)
  })

  it('renders the home directory listing with folders before files', () => {
    const { win } = mount()
    const names = rows(win).map(r => r.querySelector('.fe-row-name')?.textContent)
    // Default home has these dirs and notes.txt.
    expect(names).toContain('Documents')
    expect(names).toContain('Wallpapers')
    expect(names).toContain('notes.txt')
    // First entry is a folder (folders-asc default).
    expect(rows(win)[0]!.querySelector('.fe-row-kind')?.textContent).toBe('folder')
    // notes.txt is a file row.
    expect(rowNamed(win, 'notes.txt')!.querySelector('.fe-row-kind')?.textContent).toBe('file')
  })

  it('shows the initial status hint then settles to the clipboard line after the flash timer', () => {
    const { win } = mount()
    expect(status(win)).toMatch(/Double-click to open/)
    vi.advanceTimersByTime(3400)
    expect(status(win)).toMatch(/items · Clipboard empty\./)
  })

  // ── navigation ─────────────────────────────────────────────────────────────
  it('double-clicking a folder navigates into it', () => {
    const { win } = mount()
    rowNamed(win, 'Documents')!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    expect(win.getAbsPath()).toBe(`${FS_HOME}/Documents`)
    expect(rowNamed(win, 'readme.txt')).toBeTruthy()
  })

  it('the Up button navigates to the parent folder', () => {
    const { win } = mount({ initialPath: `${FS_HOME}/Documents` })
    expect(win.getAbsPath()).toBe(`${FS_HOME}/Documents`)
    btn(win, 'Up to parent folder').click()
    expect(win.getAbsPath()).toBe(FS_HOME)
  })

  it('the Home button jumps to ~ and refocuses', () => {
    const { win, o } = mount({ initialPath: `${FS_HOME}/Documents` })
    btn(win, 'Home (~)').click()
    expect(win.getAbsPath()).toBe(FS_HOME)
    expect(o.onFocus).toHaveBeenCalled()
  })

  it('breadcrumb buttons navigate to ancestor folders', () => {
    const { win } = mount({ initialPath: `${FS_HOME}/Documents` })
    const homeCrumb = [...win.el.querySelectorAll<HTMLButtonElement>('.fe-crumb')].find(
      c => c.textContent === '~',
    )!
    homeCrumb.click()
    expect(win.getAbsPath()).toBe(FS_HOME)
  })

  it('navigateTo a non-home path renders a fallback breadcrumb span', () => {
    const { win } = mount({ initialPath: '/etc' })
    expect(win.el.querySelector('.fe-path-fallback')?.textContent).toBe('/etc')
    expect(rowNamed(win, 'hostname')).toBeTruthy()
  })

  // ── file open ──────────────────────────────────────────────────────────────
  it('double-clicking a non-image file opens it in the editor', () => {
    const { win, o } = mount()
    rowNamed(win, 'notes.txt')!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    expect(o.onOpenInEditor).toHaveBeenCalledWith(`${FS_HOME}/notes.txt`)
  })

  it('open-in-editor footer button opens the selected file', () => {
    const { win, o } = mount()
    rowNamed(win, 'notes.txt')!.click() // select
    const edit = win.el.querySelector('.fe-footer-btn--accent') as HTMLButtonElement
    expect(edit.disabled).toBe(false)
    expect(edit.textContent).toBe('open in editor')
    edit.click()
    expect(o.onOpenInEditor).toHaveBeenCalledWith(`${FS_HOME}/notes.txt`)
  })

  it('a .js file relabels the footer button to open in p5.js', () => {
    vfsTouch(`${FS_HOME}/sketch.js`)
    const { win } = mount()
    rowNamed(win, 'sketch.js')!.click()
    expect((win.el.querySelector('.fe-footer-btn--accent') as HTMLButtonElement).textContent).toBe(
      'open in p5.js',
    )
  })

  // ── wallpaper path (vfsReadRaw) ──────────────────────────────────────────────
  it('set-as-wallpaper reads the raw URL body and applies it to #desktop', () => {
    const desktop = document.createElement('div')
    desktop.id = 'desktop'
    document.body.appendChild(desktop)

    const { win } = mount({ initialPath: `${FS_HOME}/Wallpapers` })
    const file = rowNamed(win, 'cats.png')!
    file.click() // select image -> footer button becomes "set as wallpaper"
    const edit = win.el.querySelector('.fe-footer-btn--accent') as HTMLButtonElement
    expect(edit.textContent).toBe('set as wallpaper')

    const evt = vi.fn()
    window.addEventListener('mrgrey-wallpaper-change', evt)
    edit.click()
    window.removeEventListener('mrgrey-wallpaper-change', evt)

    const expected = vfsReadRaw(`${FS_HOME}/Wallpapers/cats.png`)
    const url = expected.ok ? expected.body.trim() : ''
    expect(localStorage.getItem(WALLPAPER_KEY)).toBe(url)
    expect(desktop.style.backgroundImage).toBe(`url("${url}")`)
    expect(status(win)).toBe('Wallpaper applied ✓')
    expect(evt).toHaveBeenCalledOnce()
  })

  it('set-as-wallpaper on an empty image file reports an error and does not persist', () => {
    document.body.appendChild(Object.assign(document.createElement('div'), { id: 'desktop' }))
    vfsWrite(`${FS_HOME}/Wallpapers/blank.png`, '   ')
    const { win } = mount({ initialPath: `${FS_HOME}/Wallpapers` })
    rowNamed(win, 'blank.png')!.click()
    ;(win.el.querySelector('.fe-footer-btn--accent') as HTMLButtonElement).click()
    expect(status(win)).toBe('Wallpaper file is empty')
    expect(localStorage.getItem(WALLPAPER_KEY)).toBeNull()
    expect((win.el.querySelector('.fe-status') as HTMLElement).classList.contains('fe-status--error')).toBe(
      true,
    )
  })

  // ── empty + error states ─────────────────────────────────────────────────────
  it('renders an empty-folder placeholder for a directory with no entries', () => {
    vfsMkdir(`${FS_HOME}/empty`)
    const { win } = mount({ initialPath: `${FS_HOME}/empty` })
    expect(body(win).querySelector('.fe-empty')?.textContent).toBe('(empty folder)')
    expect(rows(win)).toHaveLength(0)
    vi.advanceTimersByTime(3400)
    expect(status(win)).toMatch(/^0 items/)
  })

  it('renders an error row when the path cannot be opened', () => {
    const { win } = mount({ initialPath: '/does/not/exist' })
    const err = body(win).querySelector('.fe-error') as HTMLElement
    expect(err).toBeTruthy()
    expect(err.textContent).toMatch(/Cannot open/)
  })

  it('renders "Not a directory" error when navigating onto a file', () => {
    const { win } = mount({ initialPath: `${FS_HOME}/notes.txt` })
    expect(body(win).querySelector('.fe-error')?.textContent).toBe('Not a directory')
  })

  // ── selection + toolbar sync ─────────────────────────────────────────────────
  it('clicking a row marks it active and enables the contextual toolbar buttons', () => {
    const { win } = mount()
    const docs = rowNamed(win, 'Documents')!
    docs.click()
    expect(docs.classList.contains('fe-row--active')).toBe(true)
    expect(btn(win, 'Rename (F2)').disabled).toBe(false)
    expect(btn(win, 'Delete (Del)').disabled).toBe(false)
    expect(btn(win, 'Cut (Ctrl+X)').disabled).toBe(false)
    expect(btn(win, 'Copy (Ctrl+C)').disabled).toBe(false)
    // A folder selection keeps "open in editor" disabled (only files open).
    expect((win.el.querySelector('.fe-footer-btn--accent') as HTMLButtonElement).disabled).toBe(true)
  })

  it('selecting a second row moves the active class to it', () => {
    const { win } = mount()
    rowNamed(win, 'Documents')!.click()
    rowNamed(win, 'Downloads')!.click()
    expect(rowNamed(win, 'Documents')!.classList.contains('fe-row--active')).toBe(false)
    expect(rowNamed(win, 'Downloads')!.classList.contains('fe-row--active')).toBe(true)
  })

  // ── keyboard handling ────────────────────────────────────────────────────────
  const press = (win: FileExplorerWindow, init: KeyboardEventInit) =>
    body(win).dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...init }))

  it('ArrowDown selects the first row and ArrowUp moves the selection', () => {
    const { win } = mount()
    press(win, { key: 'ArrowDown' })
    const first = rows(win)[0]!
    expect(first.classList.contains('fe-row--active')).toBe(true)
    press(win, { key: 'ArrowDown' })
    expect(rows(win)[1]!.classList.contains('fe-row--active')).toBe(true)
    press(win, { key: 'ArrowUp' })
    expect(rows(win)[0]!.classList.contains('fe-row--active')).toBe(true)
  })

  it('Enter on a selected folder navigates into it', () => {
    const { win } = mount()
    rowNamed(win, 'Documents')!.click()
    press(win, { key: 'Enter' })
    expect(win.getAbsPath()).toBe(`${FS_HOME}/Documents`)
  })

  it('Enter on a selected file opens it in the editor', () => {
    const { win, o } = mount()
    rowNamed(win, 'notes.txt')!.click()
    press(win, { key: 'Enter' })
    expect(o.onOpenInEditor).toHaveBeenCalledWith(`${FS_HOME}/notes.txt`)
  })

  it('Escape clears the active selection and disables contextual buttons', () => {
    const { win } = mount()
    rowNamed(win, 'Documents')!.click()
    press(win, { key: 'Escape' })
    expect(win.el.querySelector('.fe-row--active')).toBeNull()
    expect(btn(win, 'Rename (F2)').disabled).toBe(true)
  })

  it('Delete key removes the selected file after confirmation', () => {
    vfsTouch(`${FS_HOME}/scratch.txt`)
    const { win } = mount()
    mockConfirm(true)
    rowNamed(win, 'scratch.txt')!.click()
    press(win, { key: 'Delete' })
    expect(rowNamed(win, 'scratch.txt')).toBeUndefined()
    expect(status(win)).toBe('Removed scratch.txt')
  })

  it('a declined delete confirmation leaves the file in place', () => {
    vfsTouch(`${FS_HOME}/keep.txt`)
    const { win } = mount()
    mockConfirm(false)
    rowNamed(win, 'keep.txt')!.click()
    press(win, { key: 'Delete' })
    expect(rowNamed(win, 'keep.txt')).toBeTruthy()
  })

  it('Ctrl+C then navigate + Ctrl+V duplicates the file into the new folder', () => {
    const { win } = mount()
    rowNamed(win, 'notes.txt')!.click()
    press(win, { key: 'c', ctrlKey: true })
    expect(btn(win, 'Paste (Ctrl+V)').disabled).toBe(false)
    win.navigateTo(`${FS_HOME}/Documents`)
    press(win, { key: 'v', ctrlKey: true })
    expect(status(win)).toMatch(/Copied into/)
    // Original stays; a copy now lives in Documents.
    const src = vfsListEntries(FS_HOME)
    const dst = vfsListEntries(`${FS_HOME}/Documents`)
    expect(src.ok && src.entries.some(e => e.name === 'notes.txt')).toBe(true)
    expect(dst.ok && dst.entries.some(e => e.name === 'notes.txt')).toBe(true)
  })

  it('paste into the same folder surfaces the name-collision error', () => {
    const { win } = mount()
    rowNamed(win, 'notes.txt')!.click()
    press(win, { key: 'c', ctrlKey: true })
    press(win, { key: 'v', ctrlKey: true })
    expect(status(win)).toMatch(/already exists/)
    expect((win.el.querySelector('.fe-status') as HTMLElement).classList.contains('fe-status--error')).toBe(
      true,
    )
  })

  it('Ctrl+X then navigate + Ctrl+V moves the file to the new folder', () => {
    vfsTouch(`${FS_HOME}/movable.txt`)
    const { win } = mount()
    rowNamed(win, 'movable.txt')!.click()
    press(win, { key: 'x', ctrlKey: true })
    expect(status(win)).toMatch(/Cut → choose folder/)
    win.navigateTo(`${FS_HOME}/Documents`)
    press(win, { key: 'v', ctrlKey: true })
    expect(status(win)).toMatch(/Moved into/)
    const src = vfsListEntries(FS_HOME)
    const dst = vfsListEntries(`${FS_HOME}/Documents`)
    expect(src.ok && src.entries.some(e => e.name === 'movable.txt')).toBe(false)
    expect(dst.ok && dst.entries.some(e => e.name === 'movable.txt')).toBe(true)
  })

  it('F2 renames the selected file via the prompt', async () => {
    vfsTouch(`${FS_HOME}/old.txt`)
    const { win } = mount()
    mockPrompt('new.txt')
    rowNamed(win, 'old.txt')!.click()
    press(win, { key: 'F2' })
    expect(status(win)).toBe('Renamed → new.txt')
    expect(rowNamed(win, 'new.txt')).toBeTruthy()
    expect(rowNamed(win, 'old.txt')).toBeUndefined()
    // Flush the queueMicrotask(focusRowNamed) so nothing dangles at teardown.
    await Promise.resolve()
  })

  it('a cancelled rename prompt leaves the name unchanged', async () => {
    vfsTouch(`${FS_HOME}/stable.txt`)
    const { win } = mount()
    mockPrompt(null)
    rowNamed(win, 'stable.txt')!.click()
    press(win, { key: 'F2' })
    expect(rowNamed(win, 'stable.txt')).toBeTruthy()
    await Promise.resolve()
  })

  // ── new file / folder ────────────────────────────────────────────────────────
  it('New file… creates the file and selects it', async () => {
    const { win } = mount()
    mockPrompt('todo.md')
    btn(win, 'New file…').click()
    expect(status(win)).toBe('Created todo.md')
    expect(rowNamed(win, 'todo.md')).toBeTruthy()
    await Promise.resolve()
  })

  it('New folder… creates the folder', async () => {
    const { win } = mount()
    mockPrompt('proj')
    btn(win, 'New folder…').click()
    expect(status(win)).toBe('Created folder proj')
    expect(rowNamed(win, 'proj')!.querySelector('.fe-row-kind')?.textContent).toBe('folder')
    await Promise.resolve()
  })

  it('New file… surfaces a VFS error when the name already exists in a bad parent', () => {
    const { win } = mount({ initialPath: '/nope' })
    mockPrompt('x.txt')
    btn(win, 'New file…').click()
    expect((win.el.querySelector('.fe-status') as HTMLElement).classList.contains('fe-status--error')).toBe(
      true,
    )
  })

  it('New file… with an empty/cancelled prompt creates nothing', () => {
    const { win } = mount()
    const before = rows(win).length
    mockPrompt(null)
    btn(win, 'New file…').click()
    expect(rows(win).length).toBe(before)
    mockPrompt('   ') // whitespace trims to empty -> no-op
    btn(win, 'New file…').click()
    expect(rows(win).length).toBe(before)
  })

  it('New folder… with a cancelled prompt creates nothing', () => {
    const { win } = mount()
    const before = rows(win).length
    mockPrompt(null)
    btn(win, 'New folder…').click()
    expect(rows(win).length).toBe(before)
  })

  it('New folder… surfaces a VFS error on a name collision', () => {
    const { win } = mount()
    mockPrompt('Documents') // already exists in home
    btn(win, 'New folder…').click()
    expect(status(win)).toMatch(/File exists/)
    expect((win.el.querySelector('.fe-status') as HTMLElement).classList.contains('fe-status--error')).toBe(
      true,
    )
  })

  // ── toolbar operation buttons (mirror the keyboard paths) ────────────────────
  it('the Refresh button re-reads the directory', () => {
    const { win } = mount()
    // Mutate the VFS behind the window, then refresh to pick it up.
    vfsTouch(`${FS_HOME}/late.txt`)
    expect(rowNamed(win, 'late.txt')).toBeUndefined()
    btn(win, 'Refresh').click()
    expect(rowNamed(win, 'late.txt')).toBeTruthy()
  })

  it('the toolbar Delete button removes the selected folder after confirmation', () => {
    vfsMkdir(`${FS_HOME}/junk`)
    const { win } = mount()
    mockConfirm(true)
    rowNamed(win, 'junk')!.click()
    btn(win, 'Delete (Del)').click()
    expect(rowNamed(win, 'junk')).toBeUndefined()
    expect(status(win)).toBe('Removed junk')
  })

  it('the toolbar Rename button renames via prompt and the renamed row becomes active', async () => {
    vfsTouch(`${FS_HOME}/before.txt`)
    const { win } = mount()
    mockPrompt('after.txt')
    rowNamed(win, 'before.txt')!.click()
    btn(win, 'Rename (F2)').click()
    expect(rowNamed(win, 'after.txt')).toBeTruthy()
    // focusRowNamed runs on a microtask and marks the row active.
    await Promise.resolve()
    expect(rowNamed(win, 'after.txt')!.classList.contains('fe-row--active')).toBe(true)
  })

  it('rename to a colliding name surfaces an error and keeps the original', () => {
    vfsTouch(`${FS_HOME}/a.txt`)
    vfsTouch(`${FS_HOME}/b.txt`)
    const { win } = mount()
    mockPrompt('b.txt')
    rowNamed(win, 'a.txt')!.click()
    btn(win, 'Rename (F2)').click()
    expect(status(win)).toMatch(/already exists/)
    expect(rowNamed(win, 'a.txt')).toBeTruthy()
  })

  it('the toolbar Cut button arms the clipboard and the status flash settles to a Cut line', () => {
    vfsTouch(`${FS_HOME}/move-me.txt`)
    const { win } = mount()
    rowNamed(win, 'move-me.txt')!.click()
    btn(win, 'Cut (Ctrl+X)').click()
    expect(btn(win, 'Paste (Ctrl+V)').disabled).toBe(false)
    vi.advanceTimersByTime(3400) // clear the flash -> clipboardStatus with a clip
    expect(status(win)).toMatch(/· Cut · /)
  })

  it('the toolbar Copy button arms the clipboard and the flash settles to a Copied line', () => {
    const { win } = mount()
    rowNamed(win, 'notes.txt')!.click()
    btn(win, 'Copy (Ctrl+C)').click()
    vi.advanceTimersByTime(3400)
    expect(status(win)).toMatch(/· Copied · /)
  })

  it('paste into a vanished destination reports the directory error', () => {
    vfsTouch(`${FS_HOME}/orphan.txt`)
    const { win } = mount()
    rowNamed(win, 'orphan.txt')!.click()
    btn(win, 'Cut (Ctrl+X)').click()
    win.navigateTo('/no/such/dir')
    btn(win, 'Paste (Ctrl+V)').click()
    expect((win.el.querySelector('.fe-status') as HTMLElement).classList.contains('fe-status--error')).toBe(
      true,
    )
  })

  // ── view + sort branches ─────────────────────────────────────────────────────
  it('List view button is a no-op when already in list view but switches back from grid', () => {
    const { win } = mount()
    // Default is list — clicking List view again is the early-return path.
    btn(win, 'List view').click()
    expect(body(win).classList.contains('fe-view-list')).toBe(true)
    // Go to grid, then back to list to run the setViewMode body for 'list'.
    btn(win, 'Grid / icon view').click()
    expect(body(win).classList.contains('fe-view-grid')).toBe(true)
    btn(win, 'List view').click()
    expect(body(win).classList.contains('fe-view-list')).toBe(true)
    expect(btn(win, 'List view').getAttribute('aria-pressed')).toBe('true')
  })

  it('folders-desc sort keeps folders first but reverses names within each group', () => {
    const { win } = mount()
    const sel = win.el.querySelector('.fe-sort-select') as HTMLSelectElement
    sel.value = 'folders-desc'
    sel.dispatchEvent(new Event('change'))
    const kinds = rows(win).map(r => r.querySelector('.fe-row-kind')?.textContent)
    // All folder rows come before the first file row.
    const firstFile = kinds.indexOf('file')
    expect(kinds.slice(0, firstFile).every(k => k === 'folder')).toBe(true)
    const folderNames = rows(win)
      .filter(r => r.querySelector('.fe-row-kind')?.textContent === 'folder')
      .map(r => r.querySelector('.fe-row-name')?.textContent ?? '')
    const desc = [...folderNames].sort((a, b) =>
      b.localeCompare(a, undefined, { sensitivity: 'base' }),
    )
    expect(folderNames).toEqual(desc)
  })

  it('renders clickable mid-path breadcrumbs for a nested folder', () => {
    vfsMkdir(`${FS_HOME}/a`)
    vfsMkdir(`${FS_HOME}/a/b`)
    const { win } = mount({ initialPath: `${FS_HOME}/a/b` })
    // The middle segment "a" is a clickable crumb button (not the current span).
    const aCrumb = [...win.el.querySelectorAll<HTMLButtonElement>('.fe-crumb')].find(
      c => c.textContent === 'a',
    )!
    expect(aCrumb).toBeTruthy()
    aCrumb.click()
    expect(win.getAbsPath()).toBe(`${FS_HOME}/a`)
  })

  // ── keyboard no-op guards ────────────────────────────────────────────────────
  it('Enter with nothing selected does nothing', () => {
    const { win, o } = mount()
    press(win, { key: 'Enter' })
    expect(o.onOpenInEditor).not.toHaveBeenCalled()
    expect(win.getAbsPath()).toBe(FS_HOME)
  })

  it('ArrowDown in an empty folder is a safe no-op', () => {
    vfsMkdir(`${FS_HOME}/void`)
    const { win } = mount({ initialPath: `${FS_HOME}/void` })
    expect(() => press(win, { key: 'ArrowDown' })).not.toThrow()
    expect(win.el.querySelector('.fe-row--active')).toBeNull()
  })

  it('uses the singular "1 item" in the status for a one-entry folder', () => {
    vfsMkdir(`${FS_HOME}/solo`)
    vfsTouch(`${FS_HOME}/solo/only.txt`)
    const { win } = mount({ initialPath: `${FS_HOME}/solo` })
    expect(rows(win)).toHaveLength(1)
    vi.advanceTimersByTime(3400)
    expect(status(win)).toBe('1 item · Clipboard empty.')
  })

  it('ArrowUp from no focus lands on the last row', () => {
    const { win } = mount()
    press(win, { key: 'ArrowUp' })
    const last = rows(win)[rows(win).length - 1]!
    expect(last.classList.contains('fe-row--active')).toBe(true)
  })

  // ── sort + view modes (prefs persistence) ───────────────────────────────────
  it('changing the sort select to mixed-desc reorders rows and persists the pref', () => {
    const { win } = mount()
    const sel = win.el.querySelector('.fe-sort-select') as HTMLSelectElement
    sel.value = 'mixed-desc'
    sel.dispatchEvent(new Event('change'))
    const names = rows(win).map(r => r.querySelector('.fe-row-name')?.textContent)
    const sorted = [...names].sort((a, b) =>
      String(b).localeCompare(String(a), undefined, { sensitivity: 'base' }),
    )
    expect(names).toEqual(sorted)
    expect(JSON.parse(localStorage.getItem(FE_PREFS_KEY)!).sort).toBe('mixed-desc')
  })

  it('switching to grid view toggles the body class and persists the pref', () => {
    const { win } = mount()
    btn(win, 'Grid / icon view').click()
    expect(body(win).classList.contains('fe-view-grid')).toBe(true)
    expect(body(win).classList.contains('fe-view-list')).toBe(false)
    expect(JSON.parse(localStorage.getItem(FE_PREFS_KEY)!).view).toBe('grid')
    expect(btn(win, 'Grid / icon view').getAttribute('aria-pressed')).toBe('true')
  })

  it('persisted prefs are restored on the next mount', () => {
    localStorage.setItem(FE_PREFS_KEY, JSON.stringify({ sort: 'mixed-asc', view: 'grid' }))
    const { win } = mount()
    expect((win.el.querySelector('.fe-sort-select') as HTMLSelectElement).value).toBe('mixed-asc')
    expect(body(win).classList.contains('fe-view-grid')).toBe(true)
  })

  it('corrupt prefs JSON falls back to defaults without throwing', () => {
    localStorage.setItem(FE_PREFS_KEY, '{not json')
    const { win } = mount()
    expect((win.el.querySelector('.fe-sort-select') as HTMLSelectElement).value).toBe('folders-asc')
    expect(body(win).classList.contains('fe-view-list')).toBe(true)
  })

  // ── window lifecycle helpers ────────────────────────────────────────────────
  it('chrome buttons forward close / minimize / maximize and focus', () => {
    const { win, o } = mount()
    ;(win.el.querySelector('.dot-close') as HTMLElement).click()
    ;(win.el.querySelector('.dot-min') as HTMLElement).click()
    ;(win.el.querySelector('.dot-max') as HTMLElement).click()
    expect(o.onClose).toHaveBeenCalledOnce()
    expect(o.onMinimize).toHaveBeenCalledOnce()
    expect(o.onMaximize).toHaveBeenCalledOnce()
  })

  it('setActive / setMinimized / isMaximized reflect classes', () => {
    const { win } = mount()
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
  })

  it('focusPanel focuses the body and shows the clipboard status when idle', () => {
    const { win } = mount()
    vi.advanceTimersByTime(3400) // let the boot flash clear so focusPanel writes status
    const spy = vi.spyOn(body(win), 'focus')
    win.focusPanel()
    expect(spy).toHaveBeenCalledOnce()
    expect(status(win)).toMatch(/items · Clipboard empty\./)
  })

  it('scrollBy delegates to the list body with smooth behavior', () => {
    const { win } = mount()
    const spy = vi.fn()
    ;(body(win) as unknown as { scrollBy: unknown }).scrollBy = spy
    win.scrollBy(48)
    expect(spy).toHaveBeenCalledWith({ top: 48, behavior: 'smooth' })
  })

  it('pathMatches compares the normalized absolute path', () => {
    const { win } = mount({ initialPath: `${FS_HOME}/Documents` })
    expect(win.pathMatches(`${FS_HOME}/Documents`)).toBe(true)
    expect(win.pathMatches(`${FS_HOME}/Documents/.`)).toBe(true)
    expect(win.pathMatches(FS_HOME)).toBe(false)
  })
})
