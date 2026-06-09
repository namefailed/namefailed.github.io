import { describe, it, expect } from 'vitest'
import {
  applyReplaceRunsText,
  deleteLineBlockText,
  findNextOnLine,
  joinLinesText,
  lineEndCaretPos,
  moveHorizPos,
  pasteYankText,
  reverseFindKind,
  wordBackPos,
  wordEndForwardPos,
  wordForwardPos,
  yankLineBlockText,
} from './editor-vim-ops'
import { insertModeKeyAction, tryAppendCountDigit } from './editor-vim-keys'
import {
  consumeCountDigits,
  getLineCol,
  gotoLinePos,
  lineBounds,
  lineCountTotal,
  moveVertPos,
} from './editor-vim-ops'

describe('lineCountTotal', () => {
  it('returns 1 for empty buffer', () => {
    expect(lineCountTotal('')).toBe(1)
  })

  it('counts newline-separated lines', () => {
    expect(lineCountTotal('a\nb\nc')).toBe(3)
  })
})

describe('getLineCol', () => {
  it('reports 1-based line and column', () => {
    expect(getLineCol('ab\ncd', 4)).toEqual({ line: 2, col: 2 })
  })
})

describe('lineBounds', () => {
  it('returns start/end without trailing newline', () => {
    expect(lineBounds('aa\nbb', 3)).toEqual({ start: 3, end: 5 })
  })
})

describe('gotoLinePos', () => {
  it('jumps to first char of requested line', () => {
    expect(gotoLinePos('one\ntwo\nthree', 2)).toBe(4)
  })
})

describe('consumeCountDigits', () => {
  it('defaults when empty', () => {
    expect(consumeCountDigits('')).toBe(1)
    expect(consumeCountDigits('3')).toBe(3)
  })
})

describe('moveVertPos', () => {
  it('moves down preserving 0-based column offset (clamped to line length)', () => {
    const text = 'ab\nc\nde'
    expect(moveVertPos(text, 1, 1)).toBe(4)
    expect(moveVertPos(text, 0, 1)).toBe(3)
  })
})

describe('moveHorizPos', () => {
  it('steps left and right with clamping', () => {
    expect(moveHorizPos('abc', 1, -1, 2)).toBe(0)
    expect(moveHorizPos('abc', 1, 1, 2)).toBe(3)
  })
})

describe('lineEndCaretPos', () => {
  it('lands on last character before newline', () => {
    expect(lineEndCaretPos('hello\nworld', 2)).toBe(4)
  })
})

describe('word motions', () => {
  const text = 'foo bar baz'

  it('wordForwardPos skips token and punctuation', () => {
    expect(wordForwardPos(text, 0)).toBe(3)
    expect(wordForwardPos(text, 4)).toBe(7)
    expect(wordForwardPos(text, 8)).toBe(11)
  })

  it('wordBackPos finds previous token start', () => {
    expect(wordBackPos(text, 11)).toBe(8)
    expect(wordBackPos(text, 8)).toBe(4)
  })

  it('wordEndForwardPos finds end of current/next token', () => {
    expect(wordEndForwardPos(text, 0)).toBe(2)
    expect(wordEndForwardPos(text, 8)).toBe(10)
  })
})

describe('findNextOnLine', () => {
  const line = 'alpha beta gamma'

  it('finds forward character', () => {
    expect(findNextOnLine(line, 'f', 'b', 0)).toBe(6)
  })

  it('finds backward character', () => {
    expect(findNextOnLine(line, 'F', 'b', 12)).toBe(6)
  })

  it('reverseFindKind swaps directions', () => {
    expect(reverseFindKind('f')).toBe('F')
    expect(reverseFindKind('t')).toBe('T')
  })
})

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
})

describe('vim editing scenarios', () => {
  it('yank-delete-paste round trip restores buffer', () => {
    const original = 'line1\nline2\nline3'
    const yanked = yankLineBlockText(original, 2, 1)
    expect(yanked?.yank).toBe('line2\n')

    const deleted = deleteLineBlockText(original, 2, 1)
    expect(deleted?.text).toBe('line1\nline3')

    const pasted = pasteYankText(deleted!.text, 0, yanked!.yank, true)
    expect(pasted?.text).toBe(original)
  })

  it('insert mode Esc is detected before normal-mode count keys', () => {
    expect(insertModeKeyAction('Escape', { ctrlKey: false, metaKey: false })).toBe('leave-normal')
    expect(tryAppendCountDigit('', '3')).toBe('3')
  })

  it('find motion chains forward on repeated f', () => {
    const text = 'ab ab ab'
    const first = findNextOnLine(text, 'f', 'a', 0)
    expect(first).toBe(3)
    const second = findNextOnLine(text, 'f', 'a', first!)
    expect(second).toBe(6)
  })
})
