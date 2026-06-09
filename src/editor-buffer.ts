/**
 * Shared buffer-apply layer between pure vim edits and the editor tile.
 *
 * Contract: `applyBufferEditToState` writes text + selection and sets `dirty`.
 * Undo snapshots and DOM updates remain the caller's responsibility.
 */

import type { BufferEditResult } from './editor-vim-edits'
import { indentLinesText } from './editor-vim-edits'

export type { BufferEditResult }

export interface EditorBufferState {
  text: string
  selectionStart: number
  selectionEnd: number
  savedText: string
  dirty: boolean
}

/** Minimal textarea surface used by integration tests and EditorWindow. */
export interface TextareaLike {
  value: string
  selectionStart: number
  selectionEnd: number
}

export function bufferStateFromTextarea(
  textarea: TextareaLike,
  savedText: string,
  dirty: boolean,
): EditorBufferState {
  return {
    text: textarea.value,
    selectionStart: textarea.selectionStart,
    selectionEnd: textarea.selectionEnd,
    savedText,
    dirty,
  }
}

export function applyStateToTextarea(textarea: TextareaLike, state: EditorBufferState): void {
  textarea.value = state.text
  textarea.selectionStart = state.selectionStart
  textarea.selectionEnd = state.selectionEnd
}

/** Apply a pure edit result; returns false when `result` is null/undefined. */
export function applyBufferEditToState(
  state: EditorBufferState,
  result: BufferEditResult | null | undefined,
): boolean {
  if (!result) return false
  state.text = result.text
  state.selectionStart = result.pos
  state.selectionEnd = result.pos
  state.dirty = result.text !== state.savedText
  return true
}

/** `>>` pipeline: indent N lines from caret — used by handlers and integration tests. */
export function runIndentBufferEdit(state: EditorBufferState, nLines: number): boolean {
  return applyBufferEditToState(
    state,
    indentLinesText(state.text, state.selectionStart, nLines),
  )
}
