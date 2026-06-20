// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EditorWindow } from './editor-window'
import { vfsWrite, vfsReadRaw, vfsNormalize } from './os-fs'

function chromeOpts() {
  return {
    onClose: vi.fn(),
    onMinimize: vi.fn(),
    onMaximize: vi.fn(),
    onFocus: vi.fn(),
  }
}

/** Build an EditorWindow over a known-content file, mounted in the document. */
function mountEditor(
  path: string,
  body: string,
  extra: Partial<Parameters<typeof EditorWindow.prototype.constructor>[0]> = {},
) {
  vfsWrite(path, body)
  const win = new EditorWindow({ initialPath: path, ...chromeOpts(), ...extra })
  document.body.appendChild(win.el)
  return win
}

function textarea(win: EditorWindow): HTMLTextAreaElement {
  return win.el.querySelector('textarea.editor-textarea') as HTMLTextAreaElement
}
function cmdInput(win: EditorWindow): HTMLInputElement {
  return win.el.querySelector('input.editor-cmdline') as HTMLInputElement
}
function statusEl(win: EditorWindow): HTMLElement {
  return win.el.querySelector('.editor-status') as HTMLElement
}
function titleEl(win: EditorWindow): HTMLElement {
  return win.el.querySelector('.win-title') as HTMLElement
}

/** Fire a keydown on the textarea and return the event (for preventDefault assertions). */
function keydownTextarea(win: EditorWindow, init: KeyboardEventInit): KeyboardEvent {
  const e = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
  textarea(win).dispatchEvent(e)
  return e
}

function caret(win: EditorWindow, pos: number): void {
  textarea(win).setSelectionRange(pos, pos)
}

describe('EditorWindow', () => {
  beforeEach(() => {
    document.body.replaceChildren()
    // getContext is used by the block-caret text metrics; happy-dom can return
    // null, so stub a measureText that yields deterministic widths.
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      measureText: (s: string) => ({ width: s.length * 8 }),
      font: '',
    })) as unknown as typeof HTMLCanvasElement.prototype.getContext
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ── Construction / chrome ────────────────────────────────────────────────

  it('mounts editor chrome with textarea seeded from VFS', () => {
    const win = mountEditor('/tmp/seed.txt', 'hello world\nsecond line\n')
    expect(win.el.classList.contains('editor-app')).toBe(true)
    expect(textarea(win).value).toBe('hello world\nsecond line\n')
    expect(statusEl(win)).not.toBeNull()
    expect(win.command).toBe('edit')
  })

  it('sets the title to the formatted home-relative path with no dirty marker', () => {
    const win = mountEditor('/home/namefailed/title-test.txt', 'x')
    expect(titleEl(win).textContent).toBe('edit — ~/title-test.txt')
  })

  it('starts an empty buffer and flashes an error when the path does not exist', () => {
    const win = new EditorWindow({ initialPath: '/tmp/does-not-exist.txt', ...chromeOpts() })
    document.body.appendChild(win.el)
    expect(textarea(win).value).toBe('')
    expect(statusEl(win).classList.contains('editor-status--error')).toBe(true)
    expect(statusEl(win).textContent).toContain('empty buffer')
  })

  it('renders the NORMAL mode line by default', () => {
    const win = mountEditor('/tmp/mode.txt', 'abc')
    const s = statusEl(win)
    expect(s.classList.contains('mode-normal')).toBe(true)
    expect(s.querySelector('.vim-mode-text')!.textContent).toBe('NORMAL')
    expect(s.querySelector('.editor-mode-path')!.textContent).toBe('/tmp/mode.txt')
  })

  // ── Mode line meta (line/col/percent) ────────────────────────────────────

  it('reports L/C and percent in the mode meta', () => {
    const win = mountEditor('/tmp/meta.txt', 'line1\nline2\nline3\nline4')
    caret(win, 0)
    document.dispatchEvent(new Event('selectionchange'))
    // selectionchange only refreshes when textarea is the active element; force it
    textarea(win).focus()
    document.dispatchEvent(new Event('selectionchange'))
    const meta = win.el.querySelector('.editor-mode-meta') as HTMLElement
    expect(meta.textContent).toContain('L1 · C1')
  })

  // ── Insert mode ──────────────────────────────────────────────────────────

  it('enters INSERT mode on i and back to NORMAL on Escape', () => {
    const win = mountEditor('/tmp/ins.txt', 'abc')
    textarea(win).focus()
    caret(win, 0)
    keydownTextarea(win, { key: 'i' })
    expect(statusEl(win).querySelector('.vim-mode-text')!.textContent).toBe('INSERT')
    expect(textarea(win).classList.contains('editor-textarea--insert')).toBe(true)

    keydownTextarea(win, { key: 'Escape' })
    expect(statusEl(win).querySelector('.vim-mode-text')!.textContent).toBe('NORMAL')
    expect(textarea(win).classList.contains('editor-textarea--normal')).toBe(true)
  })

  it('Ctrl+[ also leaves INSERT mode', () => {
    const win = mountEditor('/tmp/ins2.txt', 'abc')
    textarea(win).focus()
    keydownTextarea(win, { key: 'i' })
    keydownTextarea(win, { key: '[', ctrlKey: true })
    expect(statusEl(win).querySelector('.vim-mode-text')!.textContent).toBe('NORMAL')
  })

  it('marks the buffer dirty when typing in INSERT mode', () => {
    const win = mountEditor('/home/namefailed/dirty.txt', 'abc')
    textarea(win).focus()
    keydownTextarea(win, { key: 'i' })
    textarea(win).value = 'abcd'
    textarea(win).dispatchEvent(new Event('input'))
    expect(titleEl(win).textContent).toBe('edit — ~/dirty.txt +')
  })

  it('blocks edits via beforeinput when not in INSERT mode', () => {
    const win = mountEditor('/tmp/block.txt', 'abc')
    const e = new Event('beforeinput', { cancelable: true })
    textarea(win).dispatchEvent(e)
    expect(e.defaultPrevented).toBe(true)
  })

  it('allows beforeinput while in INSERT mode', () => {
    const win = mountEditor('/tmp/allow.txt', 'abc')
    textarea(win).focus()
    keydownTextarea(win, { key: 'i' })
    const e = new Event('beforeinput', { cancelable: true })
    textarea(win).dispatchEvent(e)
    expect(e.defaultPrevented).toBe(false)
  })

  // ── Ex command line ──────────────────────────────────────────────────────

  it('opens the command line on : and keeps a leading colon', () => {
    const win = mountEditor('/tmp/cmd.txt', 'abc')
    textarea(win).focus()
    keydownTextarea(win, { key: ':' })
    expect(statusEl(win).querySelector('.vim-mode-text')!.textContent).toBe('COMMAND')
    expect(cmdInput(win).style.display).toBe('block')
    expect(cmdInput(win).value).toBe(':')

    // input handler forces the colon back if removed
    cmdInput(win).value = 'w'
    cmdInput(win).dispatchEvent(new Event('input'))
    expect(cmdInput(win).value).toBe(':w')
  })

  it('Escape in command line returns to NORMAL and hides the cmd input', () => {
    const win = mountEditor('/tmp/cmdesc.txt', 'abc')
    textarea(win).focus()
    keydownTextarea(win, { key: ':' })
    const e = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true })
    cmdInput(win).dispatchEvent(e)
    expect(e.defaultPrevented).toBe(true)
    expect(cmdInput(win).style.display).toBe('none')
    expect(statusEl(win).querySelector('.vim-mode-text')!.textContent).toBe('NORMAL')
  })

  it(':w writes the buffer to the VFS and clears dirty', () => {
    const win = mountEditor('/tmp/write.txt', 'orig')
    textarea(win).focus()
    // make a change in insert mode
    keydownTextarea(win, { key: 'i' })
    textarea(win).value = 'changed body'
    textarea(win).dispatchEvent(new Event('input'))
    keydownTextarea(win, { key: 'Escape' })

    keydownTextarea(win, { key: ':' })
    cmdInput(win).value = ':w'
    cmdInput(win).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }))

    const r = vfsReadRaw('/tmp/write.txt')
    expect(r.ok && r.body).toBe('changed body')
    expect(titleEl(win).textContent).toBe('edit — /tmp/write.txt')
    expect(statusEl(win).textContent).toContain('Written')
  })

  it(':q closes a clean buffer but warns on a dirty one', () => {
    const opts = chromeOpts()
    vfsWrite('/tmp/quit.txt', 'data')
    const win = new EditorWindow({ initialPath: '/tmp/quit.txt', ...opts })
    document.body.appendChild(win.el)
    textarea(win).focus()

    // dirty it
    keydownTextarea(win, { key: 'i' })
    textarea(win).value = 'data!'
    textarea(win).dispatchEvent(new Event('input'))
    keydownTextarea(win, { key: 'Escape' })

    keydownTextarea(win, { key: ':' })
    cmdInput(win).value = ':q'
    cmdInput(win).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }))
    expect(opts.onClose).not.toHaveBeenCalled()
    expect(statusEl(win).textContent).toContain('No write since last change')

    // q! force-closes regardless
    keydownTextarea(win, { key: ':' })
    cmdInput(win).value = ':q!'
    cmdInput(win).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }))
    expect(opts.onClose).toHaveBeenCalledTimes(1)
  })

  it(':wq saves then closes', () => {
    const opts = chromeOpts()
    vfsWrite('/tmp/wq.txt', 'a')
    const win = new EditorWindow({ initialPath: '/tmp/wq.txt', ...opts })
    document.body.appendChild(win.el)
    textarea(win).focus()
    keydownTextarea(win, { key: 'i' })
    textarea(win).value = 'saved-then-quit'
    textarea(win).dispatchEvent(new Event('input'))
    keydownTextarea(win, { key: 'Escape' })

    keydownTextarea(win, { key: ':' })
    cmdInput(win).value = ':wq'
    cmdInput(win).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }))

    expect(opts.onClose).toHaveBeenCalledTimes(1)
    const r = vfsReadRaw('/tmp/wq.txt')
    expect(r.ok && r.body).toBe('saved-then-quit')
  })

  it(':help flashes the keymap reference', () => {
    const win = mountEditor('/tmp/help.txt', 'a')
    textarea(win).focus()
    keydownTextarea(win, { key: ':' })
    cmdInput(win).value = ':help'
    cmdInput(win).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }))
    expect(statusEl(win).classList.contains('editor-status--msg')).toBe(true)
    expect(statusEl(win).textContent).toContain(':w :wq :q')
  })

  it('an unknown ex command reports an error', () => {
    const win = mountEditor('/tmp/unknown.txt', 'a')
    textarea(win).focus()
    keydownTextarea(win, { key: ':' })
    cmdInput(win).value = ':frobnicate'
    cmdInput(win).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }))
    expect(statusEl(win).classList.contains('editor-status--error')).toBe(true)
    expect(statusEl(win).textContent).toContain('Not an editor command: frobnicate')
  })

  it(':e loads a different file', () => {
    vfsWrite('/tmp/other.txt', 'other contents')
    const win = mountEditor('/tmp/first.txt', 'first contents')
    textarea(win).focus()
    keydownTextarea(win, { key: ':' })
    cmdInput(win).value = ':e /tmp/other.txt'
    cmdInput(win).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }))
    expect(textarea(win).value).toBe('other contents')
    expect(win.pathMatches('/tmp/other.txt')).toBe(true)
  })

  it(':e on a dirty buffer is blocked without force', () => {
    vfsWrite('/tmp/dest.txt', 'dest')
    const win = mountEditor('/tmp/src.txt', 'src')
    textarea(win).focus()
    keydownTextarea(win, { key: 'i' })
    textarea(win).value = 'src changed'
    textarea(win).dispatchEvent(new Event('input'))
    keydownTextarea(win, { key: 'Escape' })

    keydownTextarea(win, { key: ':' })
    cmdInput(win).value = ':e /tmp/dest.txt'
    cmdInput(win).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }))
    expect(textarea(win).value).toBe('src changed')
    expect(statusEl(win).textContent).toContain('No write since last change')

    // :e! forces the load, discarding changes
    keydownTextarea(win, { key: ':' })
    cmdInput(win).value = ':e! /tmp/dest.txt'
    cmdInput(win).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }))
    expect(textarea(win).value).toBe('dest')
  })

  // ── run-in-p5 ────────────────────────────────────────────────────────────

  it(':run saves and invokes onRunInP5 with the absolute path', () => {
    const onRunInP5 = vi.fn()
    const win = mountEditor('/tmp/sketch.js', 'function setup(){}', { onRunInP5 })
    textarea(win).focus()
    keydownTextarea(win, { key: ':' })
    cmdInput(win).value = ':run'
    cmdInput(win).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }))
    expect(onRunInP5).toHaveBeenCalledWith(vfsNormalize('/tmp/sketch.js'))
    expect(statusEl(win).textContent).toContain('Running in p5')
  })

  it('F5 triggers run-in-p5 from NORMAL mode', () => {
    const onRunInP5 = vi.fn()
    const win = mountEditor('/tmp/f5.js', 'noop', { onRunInP5 })
    textarea(win).focus()
    const e = keydownTextarea(win, { key: 'F5' })
    expect(e.defaultPrevented).toBe(true)
    expect(onRunInP5).toHaveBeenCalledTimes(1)
  })

  it(':run reports gracefully when onRunInP5 is not wired', () => {
    const win = mountEditor('/tmp/norun.js', 'noop')
    textarea(win).focus()
    keydownTextarea(win, { key: ':' })
    cmdInput(win).value = ':run'
    cmdInput(win).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }))
    expect(statusEl(win).textContent).toContain('Run-in-p5 not available')
  })

  // ── chrome close guard ───────────────────────────────────────────────────

  it('chrome close button blocks while dirty and closes when clean', () => {
    const opts = chromeOpts()
    vfsWrite('/tmp/chrome.txt', 'cc')
    const win = new EditorWindow({ initialPath: '/tmp/chrome.txt', ...opts })
    document.body.appendChild(win.el)
    textarea(win).focus()
    keydownTextarea(win, { key: 'i' })
    textarea(win).value = 'cc!'
    textarea(win).dispatchEvent(new Event('input'))
    keydownTextarea(win, { key: 'Escape' })

    const closeDot = win.el.querySelector('.dot-close') as HTMLElement
    closeDot.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(opts.onClose).not.toHaveBeenCalled()

    // save, then close succeeds
    keydownTextarea(win, { key: ':' })
    cmdInput(win).value = ':w'
    cmdInput(win).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }))
    closeDot.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(opts.onClose).toHaveBeenCalledTimes(1)
  })

  // ── NORMAL mode editing: dd / yy / p ─────────────────────────────────────

  it('dd deletes the current line', () => {
    const win = mountEditor('/tmp/dd.txt', 'one\ntwo\nthree')
    textarea(win).focus()
    caret(win, 0) // on line "one"
    keydownTextarea(win, { key: 'd' })
    keydownTextarea(win, { key: 'd' })
    expect(textarea(win).value).toBe('two\nthree')
  })

  it('3dd deletes three lines using a count prefix', () => {
    const win = mountEditor('/tmp/3dd.txt', 'a\nb\nc\nd\ne')
    textarea(win).focus()
    caret(win, 0)
    keydownTextarea(win, { key: '3' })
    keydownTextarea(win, { key: 'd' })
    keydownTextarea(win, { key: 'd' })
    expect(textarea(win).value).toBe('d\ne')
  })

  it('yy then p yanks and pastes a line', () => {
    const win = mountEditor('/tmp/yy.txt', 'alpha\nbeta')
    textarea(win).focus()
    caret(win, 0)
    keydownTextarea(win, { key: 'y' })
    keydownTextarea(win, { key: 'y' })
    expect(statusEl(win).textContent).toContain('Yanked 1 line')
    keydownTextarea(win, { key: 'p' })
    expect(textarea(win).value).toBe('alpha\nalpha\nbeta')
  })

  it('x deletes the character under the cursor', () => {
    const win = mountEditor('/tmp/x.txt', 'hello')
    textarea(win).focus()
    caret(win, 0)
    keydownTextarea(win, { key: 'x' })
    expect(textarea(win).value).toBe('ello')
  })

  // ── undo / redo ──────────────────────────────────────────────────────────

  it('u undoes a delete and Ctrl+r redoes it', () => {
    const win = mountEditor('/tmp/undo.txt', 'keepme\nbye')
    textarea(win).focus()
    caret(win, 0)
    keydownTextarea(win, { key: 'd' })
    keydownTextarea(win, { key: 'd' })
    expect(textarea(win).value).toBe('bye')

    keydownTextarea(win, { key: 'u' })
    expect(textarea(win).value).toBe('keepme\nbye')

    const e = keydownTextarea(win, { key: 'r', ctrlKey: true })
    expect(e.defaultPrevented).toBe(true)
    expect(textarea(win).value).toBe('bye')
  })

  it('Escape clears a pending count prefix so a later dd deletes one line', () => {
    const win = mountEditor('/tmp/esc.txt', 'a\nb\nc\nd\ne')
    textarea(win).focus()
    caret(win, 0)
    keydownTextarea(win, { key: '5' })
    const meta = win.el.querySelector('.editor-mode-meta') as HTMLElement
    expect(meta.textContent).toContain('#5')

    keydownTextarea(win, { key: 'Escape' })
    // The count was discarded — dd now deletes only the current line, not five.
    keydownTextarea(win, { key: 'd' })
    keydownTextarea(win, { key: 'd' })
    expect(textarea(win).value).toBe('b\nc\nd\ne')
  })

  // ── gg / G navigation ────────────────────────────────────────────────────

  it('gg jumps to the first line and G to the last', () => {
    const win = mountEditor('/tmp/gg.txt', 'l1\nl2\nl3\nl4')
    textarea(win).focus()
    caret(win, textarea(win).value.length) // last line

    keydownTextarea(win, { key: 'g' })
    keydownTextarea(win, { key: 'g' })
    expect(textarea(win).selectionStart).toBe(0)

    keydownTextarea(win, { key: 'G' })
    // last line begins after the final newline
    const lastLineStart = 'l1\nl2\nl3\n'.length
    expect(textarea(win).selectionStart).toBe(lastLineStart)
  })

  // ── find motion f<char> ──────────────────────────────────────────────────

  it('f<char> moves the cursor to the next matching character', () => {
    const win = mountEditor('/tmp/find.txt', 'abcdef')
    textarea(win).focus()
    caret(win, 0)
    keydownTextarea(win, { key: 'f' })
    // pending find shown in meta
    const meta = win.el.querySelector('.editor-mode-meta') as HTMLElement
    expect(meta.textContent).toContain('f_')
    keydownTextarea(win, { key: 'd' })
    expect(textarea(win).selectionStart).toBe(3) // index of 'd'
  })

  it('f<char> with no match flashes a not-found error', () => {
    const win = mountEditor('/tmp/nofind.txt', 'abc')
    textarea(win).focus()
    caret(win, 0)
    keydownTextarea(win, { key: 'f' })
    keydownTextarea(win, { key: 'z' })
    expect(statusEl(win).textContent).toContain('not found on this line')
  })

  // ── replace r<char> ──────────────────────────────────────────────────────

  it('r<char> replaces the character under the cursor', () => {
    const win = mountEditor('/tmp/replace.txt', 'cat')
    textarea(win).focus()
    caret(win, 0)
    keydownTextarea(win, { key: 'r' })
    keydownTextarea(win, { key: 'b' })
    expect(textarea(win).value).toBe('bat')
  })

  it('Escape cancels a pending r replace', () => {
    const win = mountEditor('/tmp/rcancel.txt', 'cat')
    textarea(win).focus()
    caret(win, 0)
    keydownTextarea(win, { key: 'r' })
    keydownTextarea(win, { key: 'Escape' })
    keydownTextarea(win, { key: 'b' }) // would normally do nothing useful, but no replace
    expect(textarea(win).value).toBe('cat')
  })

  // ── scrolling Ctrl-f / Ctrl-b ────────────────────────────────────────────

  it('Ctrl-f and Ctrl-b adjust scrollTop', () => {
    const win = mountEditor('/tmp/scroll.txt', 'x\n'.repeat(200))
    textarea(win).focus()
    Object.defineProperty(textarea(win), 'clientHeight', { value: 100, configurable: true })
    keydownTextarea(win, { key: 'f', ctrlKey: true })
    expect(textarea(win).scrollTop).toBeGreaterThan(0)
    const after = textarea(win).scrollTop
    keydownTextarea(win, { key: 'b', ctrlKey: true })
    expect(textarea(win).scrollTop).toBeLessThan(after)
  })

  // ── public WM API ────────────────────────────────────────────────────────

  it('setActive toggles the active class', () => {
    const win = mountEditor('/tmp/active.txt', 'a')
    win.setActive(true)
    expect(win.el.classList.contains('active')).toBe(true)
    win.setActive(false)
    expect(win.el.classList.contains('active')).toBe(false)
  })

  it('setMinimized toggles the minimized class', () => {
    const win = mountEditor('/tmp/min.txt', 'a')
    win.setMinimized(true)
    expect(win.el.classList.contains('minimized')).toBe(true)
  })

  it('isMaximized reflects the maximized class', () => {
    const win = mountEditor('/tmp/max.txt', 'a')
    expect(win.isMaximized()).toBe(false)
    win.el.classList.add('maximized')
    expect(win.isMaximized()).toBe(true)
  })

  it('focusEditor focuses the textarea in NORMAL mode', () => {
    const win = mountEditor('/tmp/focus.txt', 'a')
    win.focusEditor()
    expect(document.activeElement).toBe(textarea(win))
  })

  it('focusEditor focuses the cmd input while in command mode', () => {
    const win = mountEditor('/tmp/focuscmd.txt', 'a')
    textarea(win).focus()
    keydownTextarea(win, { key: ':' })
    win.focusEditor()
    expect(document.activeElement).toBe(cmdInput(win))
  })

  it('pathMatches compares against the normalized path', () => {
    const win = mountEditor('/tmp/sub/match.txt', 'a')
    expect(win.pathMatches('/tmp/sub/match.txt')).toBe(true)
    expect(win.pathMatches('/tmp/sub/../sub/match.txt')).toBe(true)
    expect(win.pathMatches('/tmp/elsewhere.txt')).toBe(false)
  })

  it('scrollBy delegates to the textarea', () => {
    const win = mountEditor('/tmp/scrollby.txt', 'a')
    const ta = textarea(win)
    const spy = vi.fn()
    ta.scrollBy = spy as unknown as HTMLTextAreaElement['scrollBy']
    win.scrollBy(40)
    expect(spy).toHaveBeenCalledWith({ top: 40, behavior: 'smooth' })
  })

  // ── loadFile ─────────────────────────────────────────────────────────────

  it('loadFile swaps content, resets dirty, and updates the title', () => {
    vfsWrite('/home/namefailed/swapped.txt', 'swapped body')
    const win = mountEditor('/home/namefailed/start.txt', 'start body')
    win.loadFile('/home/namefailed/swapped.txt')
    expect(textarea(win).value).toBe('swapped body')
    expect(titleEl(win).textContent).toBe('edit — ~/swapped.txt')
    expect(win.pathMatches('/home/namefailed/swapped.txt')).toBe(true)
  })

  it('loadFile on a missing path opens an empty buffer with a notice', () => {
    const win = mountEditor('/tmp/loadstart.txt', 'present')
    win.loadFile('/tmp/missing-load.txt')
    expect(textarea(win).value).toBe('')
    expect(statusEl(win).textContent).toContain('new file when you :w')
  })

  // ── indent / unindent ────────────────────────────────────────────────────

  it('>> indents the current line and << unindents it', () => {
    const win = mountEditor('/tmp/indent.txt', 'foo\nbar')
    textarea(win).focus()
    caret(win, 0)
    keydownTextarea(win, { key: '>' })
    keydownTextarea(win, { key: '>' })
    expect(textarea(win).value.startsWith('  foo')).toBe(true)

    keydownTextarea(win, { key: '<' })
    keydownTextarea(win, { key: '<' })
    expect(textarea(win).value.startsWith('foo')).toBe(true)
  })

  // ── repeat find ; and , ──────────────────────────────────────────────────

  it('; repeats the last find forward and , reverses it', () => {
    const win = mountEditor('/tmp/repeat.txt', 'a.b.c.d')
    textarea(win).focus()
    caret(win, 0)
    keydownTextarea(win, { key: 'f' })
    keydownTextarea(win, { key: '.' })
    expect(textarea(win).selectionStart).toBe(1) // first '.'

    keydownTextarea(win, { key: ';' })
    expect(textarea(win).selectionStart).toBe(3) // next '.'

    keydownTextarea(win, { key: ',' })
    expect(textarea(win).selectionStart).toBe(1) // back to first '.'
  })

  // ── J join, D delete-through-EOL ──────────────────────────────────────────

  it('J joins the next line onto the current one', () => {
    const win = mountEditor('/tmp/join.txt', 'hello\nworld')
    textarea(win).focus()
    caret(win, 0)
    keydownTextarea(win, { key: 'J' })
    expect(textarea(win).value).toBe('helloworld')
  })

  it('D deletes from the cursor through end of line', () => {
    const win = mountEditor('/tmp/delEOL.txt', 'keepDROP\nnext')
    textarea(win).focus()
    caret(win, 4) // just after "keep"
    keydownTextarea(win, { key: 'D' })
    expect(textarea(win).value).toBe('keep\nnext')
  })

  // ── open-line / append inserts ────────────────────────────────────────────

  it('o opens a new line below and enters INSERT', () => {
    const win = mountEditor('/tmp/open.txt', 'top')
    textarea(win).focus()
    caret(win, 0)
    keydownTextarea(win, { key: 'o' })
    expect(statusEl(win).querySelector('.vim-mode-text')!.textContent).toBe('INSERT')
    expect(textarea(win).value).toBe('top\n')
  })

  it('A appends at end of line and enters INSERT at the end', () => {
    const win = mountEditor('/tmp/append.txt', 'abc')
    textarea(win).focus()
    caret(win, 0)
    keydownTextarea(win, { key: 'A' })
    expect(statusEl(win).querySelector('.vim-mode-text')!.textContent).toBe('INSERT')
    expect(textarea(win).selectionStart).toBe(3)
  })

  // ── save error path ───────────────────────────────────────────────────────

  it(':w into a directory path flashes the write error and stays dirty', () => {
    // /tmp itself is a directory in the seeded VFS — writing to it must fail.
    const win = mountEditor('/home/namefailed/willfail.txt', 'body')
    // Re-point the editor at a directory by loading it, then attempt a write.
    // Simulate by making the buffer dirty then writing to a dir path via :e is
    // not possible; instead directly assert vfsWrite error surfaces through :w
    // by switching the absPath through loadFile onto a directory.
    win.loadFile('/home/namefailed') // a directory -> opens empty + notice
    textarea(win).focus()
    keydownTextarea(win, { key: 'i' })
    textarea(win).value = 'attempt'
    textarea(win).dispatchEvent(new Event('input'))
    keydownTextarea(win, { key: 'Escape' })

    keydownTextarea(win, { key: ':' })
    cmdInput(win).value = ':w'
    cmdInput(win).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }))
    expect(statusEl(win).classList.contains('editor-status--error')).toBe(true)
    expect(titleEl(win).textContent).toContain('+') // still dirty
  })

  // ── block caret rendering ─────────────────────────────────────────────────

  it('shows the block caret in NORMAL while the textarea is focused', () => {
    const win = mountEditor('/tmp/caret.txt', 'abc\ndef')
    const ta = textarea(win)
    Object.defineProperty(ta, 'clientHeight', { value: 200, configurable: true })
    ta.focus()
    caret(win, 1)
    document.dispatchEvent(new Event('selectionchange'))
    const bc = win.el.querySelector('.editor-block-caret') as HTMLElement
    expect(bc.hidden).toBe(false)
    expect(bc.style.width).not.toBe('')
  })

  // ── dispose ──────────────────────────────────────────────────────────────

  it('removes the selectionchange listener on dispose', () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener')
    const win = mountEditor('/tmp/dispose.txt', 'a')
    win.dispose()
    expect(removeSpy).toHaveBeenCalledWith('selectionchange', expect.any(Function))
  })

  it('dispose is idempotent and safe to call twice', () => {
    const win = mountEditor('/tmp/dispose2.txt', 'a')
    win.dispose()
    expect(() => win.dispose()).not.toThrow()
  })
})
