import { describe, it, expect } from 'vitest'
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
    // caret on 'b' (index 1) → same column on "c" clamps to index 4 (after sole char)
    expect(moveVertPos(text, 1, 1)).toBe(4)
    expect(moveVertPos(text, 0, 1)).toBe(3)
  })
})
