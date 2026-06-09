/**
 * Pure editor path/title helpers — shared by editor-window and tests.
 */

import { vfsFormatPath, vfsNormalize } from './os-fs'

export function editorPathsEqual(absPath: string, userPath: string): boolean {
  return absPath === vfsNormalize(userPath)
}

export function editorWindowTitle(absPath: string, dirty: boolean): string {
  const path = vfsFormatPath(absPath)
  return `edit — ${path}${dirty ? ' +' : ''}`
}
