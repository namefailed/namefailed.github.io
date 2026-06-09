/**
 * Barrel re-export for editor vim helpers.
 *
 * - `editor-vim-motions.ts` — caret positions, no buffer mutation
 * - `editor-vim-edits.ts` — `{ text, pos }` buffer mutations
 */

export * from './editor-vim-motions'
export * from './editor-vim-edits'
