// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EditorWindow } from './editor-window'

function chromeOpts() {
  return {
    onClose: vi.fn(),
    onMinimize: vi.fn(),
    onMaximize: vi.fn(),
    onFocus: vi.fn(),
  }
}

describe('EditorWindow', () => {
  beforeEach(() => {
    document.body.replaceChildren()
  })

  it('mounts editor chrome with textarea seeded from VFS', () => {
    const win = new EditorWindow({
      initialPath: 'notes.txt',
      ...chromeOpts(),
    })
    document.body.appendChild(win.el)

    expect(win.el.classList.contains('editor-app')).toBe(true)
    const ta = win.el.querySelector('textarea.editor-textarea') as HTMLTextAreaElement | null
    expect(ta).not.toBeNull()
    expect(ta!.value.length).toBeGreaterThan(0)
    expect(win.el.querySelector('.editor-status')).not.toBeNull()
  })

  it('removes selectionchange listener on dispose', () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener')
    const win = new EditorWindow({
      initialPath: 'notes.txt',
      ...chromeOpts(),
    })
    win.dispose()
    expect(removeSpy).toHaveBeenCalledWith('selectionchange', expect.any(Function))
    removeSpy.mockRestore()
  })

  it('toggles minimized class', () => {
    const win = new EditorWindow({
      initialPath: 'notes.txt',
      ...chromeOpts(),
    })
    win.setMinimized(true)
    expect(win.el.classList.contains('minimized')).toBe(true)
  })
})
