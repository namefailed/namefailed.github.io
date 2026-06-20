/**
 * Ex-mode command parsing for the modal editor (`:w`, `:q`, `:e`, …).
 */

export type EditorExAction =
  | { type: 'write' }
  | { type: 'quit' }
  | { type: 'quit-force' }
  | { type: 'write-quit' }
  | { type: 'run-p5' }
  | { type: 'edit'; path: string; force?: true }
  | { type: 'help' }
  | { type: 'unknown'; line: string }

/** Parse a raw ex input line (with or without leading `:`). */
export function parseEditorExCommand(raw: string): EditorExAction {
  let line = raw.trim()
  if (line.startsWith(':')) line = line.slice(1).trim()

  const lower = line.toLowerCase()
  if (lower === 'w' || lower === 'write') return { type: 'write' }
  if (lower === 'q' || lower === 'quit') return { type: 'quit' }
  if (lower === 'q!' || lower === 'quit!') return { type: 'quit-force' }
  if (lower === 'wq' || lower === 'x' || lower === 'xit') return { type: 'write-quit' }
  if (lower === 'run' || lower === 'p5') return { type: 'run-p5' }

  const em = /^e(?:dit)?(!)?\s+(.+)$/.exec(line)
  if (em) {
    const path = em[2]!.trim()
    return em[1] ? { type: 'edit', path, force: true } : { type: 'edit', path }
  }

  if (line === '' || lower === 'help') return { type: 'help' }

  return { type: 'unknown', line }
}
