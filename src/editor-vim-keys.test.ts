import { describe, it, expect } from 'vitest'
import { insertModeKeyAction, tryAppendCountDigit } from './editor-vim-keys'

describe('insertModeKeyAction', () => {
  it('leaves insert on Escape', () => {
    expect(insertModeKeyAction('Escape', { ctrlKey: false, metaKey: false })).toBe('leave-normal')
  })

  it('leaves insert on Ctrl+[', () => {
    expect(insertModeKeyAction('[', { ctrlKey: true, metaKey: false })).toBe('leave-normal')
  })

  it('passes through ordinary keys', () => {
    expect(insertModeKeyAction('a', { ctrlKey: false, metaKey: false })).toBe('pass')
  })
})

describe('tryAppendCountDigit', () => {
  it('starts a count with 1-9', () => {
    expect(tryAppendCountDigit('', '3')).toBe('3')
  })

  it('appends 0 only when digits already buffered', () => {
    expect(tryAppendCountDigit('', '0')).toBeNull()
    expect(tryAppendCountDigit('12', '0')).toBe('120')
  })

  it('caps at six digits', () => {
    expect(tryAppendCountDigit('123456', '7')).toBe('123456')
  })
})
