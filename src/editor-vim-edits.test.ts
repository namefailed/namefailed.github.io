import { describe, it, expect } from 'vitest'
import {
  applyReplaceRunsText,
  deleteCharBackwardText,
  deleteCharForwardText,
  deleteLineBlockText,
  deleteThroughEOLText,
  indentLinesText,
  joinLinesText,
  openLineAboveText,
  openLineBelowText,
  pasteYankText,
  substituteCharsText,
  toggleCaseRunText,
  unindentLinesText,
  yankLineBlockText,
  yankToEOLText,
} from './editor-vim-edits'
import { appendLineEndPos } from './editor-vim-motions'

describe('deleteLineBlockText', () => {
  it('removes lines and leaves caret at block start', () => {
    const text = 'one\ntwo\nthree'
    const result = deleteLineBlockText(text, 2, 2)
    expect(result).toEqual({ text: 'one\n', pos: 4 })
  })
})

describe('yankLineBlockText', () => {
  it('includes trailing newline in register', () => {
    const result = yankLineBlockText('a\nb\nc', 2, 1)
    expect(result?.yank).toBe('b\n')
    expect(result?.lineCount).toBe(1)
  })
})

describe('joinLinesText', () => {
  it('merges consecutive lines', () => {
    const result = joinLinesText('aa\nbb\ncc', 1, 2)
    expect(result).toEqual({ text: 'aabbcc', pos: 4 })
  })
})

describe('applyReplaceRunsText', () => {
  it('replaces run and positions caret on last replaced char', () => {
    const result = applyReplaceRunsText('hello', 1, 2, 'X')
    expect(result).toEqual({ text: 'hXXlo', pos: 2 })
  })
})

describe('pasteYankText', () => {
  it('pastes after line when p', () => {
    const result = pasteYankText('a\nb', 0, 'Y\n', true)
    expect(result?.text).toBe('a\nY\nb')
  })

  it('pastes before line when P', () => {
    const result = pasteYankText('a\nb', 2, 'Y\n', false)
    expect(result?.text).toBe('a\nY\nb')
  })

  it('opens a new line below when p lands on the last, newline-less line', () => {
    const result = pasteYankText('a\nb', 2, 'Y\n', true)
    expect(result?.text).toBe('a\nb\nY')
    expect(result?.pos).toBe(4)
  })
})

describe('indentLinesText', () => {
  it('indents from caret line and shifts caret right', () => {
    const result = indentLinesText('  foo\nbar', 2, 1)
    expect(result).toEqual({ text: '    foo\nbar', pos: 4 })
  })

  it('indents multiple lines from caret line', () => {
    const result = indentLinesText('a\nb\nc', 2, 2)
    expect(result?.text).toBe('a\n  b\n  c')
  })
})

describe('unindentLinesText', () => {
  it('removes two-space indent and shifts caret left', () => {
    const result = unindentLinesText('  hello', 4, 1)
    expect(result).toEqual({ text: 'hello', pos: 2 })
  })

  it('removes single space or tab', () => {
    expect(unindentLinesText(' hello', 1, 1)?.text).toBe('hello')
    expect(unindentLinesText('\tworld', 1, 1)?.text).toBe('world')
  })
})

describe('toggleCaseRunText', () => {
  it('toggles case on next n characters', () => {
    expect(toggleCaseRunText('hello', 0, 2)).toEqual({ text: 'HEllo', pos: 2 })
  })

  it('skips newlines without counting toward n', () => {
    expect(toggleCaseRunText('a\nb', 0, 2)).toEqual({ text: 'A\nB', pos: 3 })
  })

  it('returns null when nothing toggled', () => {
    expect(toggleCaseRunText('123', 0, 1)).toBeNull()
  })
})

describe('substituteCharsText', () => {
  it('deletes n chars under cursor', () => {
    expect(substituteCharsText('hello', 1, 2)).toEqual({ text: 'hlo', pos: 1 })
  })
})

describe('deleteCharForwardText', () => {
  it('deletes forward (x)', () => {
    expect(deleteCharForwardText('abcd', 1, 2)).toEqual({ text: 'ad', pos: 1 })
  })
})

describe('deleteCharBackwardText', () => {
  it('deletes backward (X)', () => {
    expect(deleteCharBackwardText('abcd', 2, 1)).toEqual({ text: 'acd', pos: 1 })
  })
})

describe('yankToEOLText', () => {
  it('yanks through line end without newline', () => {
    expect(yankToEOLText('hello\nworld', 1)).toBe('ello')
  })
})

describe('appendLineEndPos', () => {
  it('returns index of last char on line', () => {
    expect(appendLineEndPos('hello\nworld', 0)).toBe(5)
    expect(appendLineEndPos('hello', 0)).toBe(5)
  })
})

describe('openLineBelowText / openLineAboveText', () => {
  it('opens line below (o)', () => {
    expect(openLineBelowText('ab\ncd', 1)).toEqual({ text: 'ab\n\ncd', pos: 3 })
  })

  it('opens line above (O)', () => {
    expect(openLineAboveText('ab\ncd', 3)).toEqual({ text: 'ab\n\ncd', pos: 3 })
  })
})

describe('deleteThroughEOLText', () => {
  it('deletes from caret through end of line', () => {
    expect(deleteThroughEOLText('hello\nworld', 1)).toEqual({ text: 'h\nworld', pos: 1 })
  })
})

describe('vim edit scenarios', () => {
  it('yank-delete-paste round trip restores buffer', () => {
    const original = 'line1\nline2\nline3'
    const yanked = yankLineBlockText(original, 2, 1)
    expect(yanked?.yank).toBe('line2\n')

    const deleted = deleteLineBlockText(original, 2, 1)
    expect(deleted?.text).toBe('line1\nline3')

    const pasted = pasteYankText(deleted!.text, 0, yanked!.yank, true)
    expect(pasted?.text).toBe(original)
  })
})
