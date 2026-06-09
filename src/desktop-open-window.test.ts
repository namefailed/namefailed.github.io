import { describe, it, expect } from 'vitest'
import {
  editWindowSpecFromPath,
  explorerFileOpenSpec,
  isMiniGameCommand,
  p5WindowSpecFromPath,
  resolveBrowserUrl,
  resolveEditorPath,
  resolveExplorerPath,
} from './desktop-open-window'
import type { WindowSpec } from './appwindow'

describe('isMiniGameCommand', () => {
  it('recognizes paint/snake/pong/cube', () => {
    expect(isMiniGameCommand('paint')).toBe(true)
    expect(isMiniGameCommand('cube')).toBe(true)
    expect(isMiniGameCommand('resume')).toBe(false)
  })
})

describe('resolveEditorPath', () => {
  it('defaults to notes.txt', () => {
    expect(resolveEditorPath({ command: 'edit', title: 'edit', content: [] })).toBe('notes.txt')
  })

  it('uses editorPath when provided', () => {
    expect(
      resolveEditorPath({
        command: 'edit',
        title: 'edit',
        content: [],
        editorPath: '~/docs/readme.md',
      }),
    ).toBe('~/docs/readme.md')
  })
})

describe('resolveExplorerPath', () => {
  it('normalizes explorer path with home default', () => {
    expect(resolveExplorerPath({ command: 'explorer', title: 'explorer', content: [] })).toBe(
      '/home/namefailed',
    )
  })
})

describe('resolveBrowserUrl', () => {
  it('normalizes default browser URL', () => {
    const url = resolveBrowserUrl({ command: 'browse', title: 'browse', content: [] })
    expect(url.startsWith('https://')).toBe(true)
  })
})

describe('p5WindowSpecFromPath', () => {
  it('uses basename as title', () => {
    expect(p5WindowSpecFromPath('/home/sketches/demo.js')).toEqual({
      command: 'p5',
      title: 'demo.js',
      content: [],
      p5SketchPath: '/home/sketches/demo.js',
    })
  })
})

describe('explorerFileOpenSpec', () => {
  it('routes .js files to p5 viewer', () => {
    expect(explorerFileOpenSpec('/home/sketches/a.js')).toEqual(
      p5WindowSpecFromPath('/home/sketches/a.js'),
    )
  })

  it('routes other files to editor', () => {
    expect(explorerFileOpenSpec('/home/notes.txt')).toEqual(
      editWindowSpecFromPath('/home/notes.txt'),
    )
  })
})

describe('editWindowSpecFromPath', () => {
  it('builds editor spec with path in title', () => {
    const spec: WindowSpec = editWindowSpecFromPath('/home/notes.txt')
    expect(spec.command).toBe('edit')
    expect(spec.editorPath).toBe('/home/notes.txt')
    expect(spec.title).toContain('notes.txt')
  })
})
