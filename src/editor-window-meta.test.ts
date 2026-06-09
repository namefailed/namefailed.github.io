import { describe, it, expect } from 'vitest'
import { editorPathsEqual, editorWindowTitle } from './editor-window-meta'
import { FS_HOME, vfsNormalize } from './os-fs'

describe('editorPathsEqual', () => {
  it('normalizes user path against stored abs path', () => {
    const abs = vfsNormalize('notes.txt')
    expect(editorPathsEqual(abs, 'notes.txt')).toBe(true)
    expect(editorPathsEqual(`${FS_HOME}/a.txt`, `${FS_HOME}/b.txt`)).toBe(false)
  })
})

describe('editorWindowTitle', () => {
  it('shows dirty marker when buffer changed', () => {
    expect(editorWindowTitle('/home/namefailed/notes.txt', true)).toContain('+')
    expect(editorWindowTitle('/home/namefailed/notes.txt', false)).not.toContain('+')
  })
})
