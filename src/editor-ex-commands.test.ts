import { describe, it, expect } from 'vitest'
import { parseEditorExCommand } from './editor-ex-commands'

describe('parseEditorExCommand', () => {
  it('parses write variants', () => {
    expect(parseEditorExCommand(':w')).toEqual({ type: 'write' })
    expect(parseEditorExCommand('write')).toEqual({ type: 'write' })
  })

  it('parses quit variants', () => {
    expect(parseEditorExCommand(':q')).toEqual({ type: 'quit' })
    expect(parseEditorExCommand(':q!')).toEqual({ type: 'quit-force' })
    expect(parseEditorExCommand(':wq')).toEqual({ type: 'write-quit' })
    expect(parseEditorExCommand('x')).toEqual({ type: 'write-quit' })
  })

  it('parses run and edit', () => {
    expect(parseEditorExCommand(':run')).toEqual({ type: 'run-p5' })
    expect(parseEditorExCommand(':e notes.txt')).toEqual({ type: 'edit', path: 'notes.txt' })
    expect(parseEditorExCommand(':edit ~/docs/a.md')).toEqual({ type: 'edit', path: '~/docs/a.md' })
  })

  it('returns help for empty or help', () => {
    expect(parseEditorExCommand(':')).toEqual({ type: 'help' })
    expect(parseEditorExCommand(':help')).toEqual({ type: 'help' })
  })

  it('returns unknown for unrecognized commands', () => {
    expect(parseEditorExCommand(':foo')).toEqual({ type: 'unknown', line: 'foo' })
  })
})
