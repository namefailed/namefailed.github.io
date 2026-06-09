import { describe, it, expect } from 'vitest'
import {
  applyBufferEditToState,
  applyStateToTextarea,
  bufferStateFromTextarea,
  runIndentBufferEdit,
  type EditorBufferState,
  type TextareaLike,
} from './editor-buffer'

function fakeTextarea(value: string, pos: number): TextareaLike {
  return { value, selectionStart: pos, selectionEnd: pos }
}

describe('editor-buffer integration', () => {
  it('>> indents from caret line through apply pipeline', () => {
    const textarea = fakeTextarea('  foo\nbar', 2)
    const savedText = '  foo\nbar'
    const state = bufferStateFromTextarea(textarea, savedText, false)

    expect(runIndentBufferEdit(state, 1)).toBe(true)
    expect(state.text).toBe('    foo\nbar')
    expect(state.selectionStart).toBe(4)
    expect(state.dirty).toBe(true)

    applyStateToTextarea(textarea, state)
    expect(textarea.value).toBe('    foo\nbar')
    expect(textarea.selectionStart).toBe(4)
  })

  it('applyBufferEditToState is a no-op for null edits', () => {
    const state: EditorBufferState = {
      text: 'hello',
      selectionStart: 0,
      selectionEnd: 0,
      savedText: 'hello',
      dirty: false,
    }
    expect(applyBufferEditToState(state, null)).toBe(false)
    expect(state.text).toBe('hello')
  })

  it('2>> indents multiple lines from caret', () => {
    const textarea = fakeTextarea('a\nb\nc', 2)
    const state = bufferStateFromTextarea(textarea, 'a\nb\nc', false)

    expect(runIndentBufferEdit(state, 2)).toBe(true)
    expect(state.text).toBe('a\n  b\n  c')
    applyStateToTextarea(textarea, state)
    expect(textarea.value).toBe('a\n  b\n  c')
  })
})
