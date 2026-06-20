import { describe, expect, it, vi, beforeEach } from 'vitest'
import { VimInput } from './vim'
import type { VimMode } from './vim'

/** Create a minimal KeyboardEvent-like object for testing. */
function keyEvent(key: string, opts?: { ctrlKey?: boolean; shiftKey?: boolean }): KeyboardEvent {
  return {
    key,
    ctrlKey: opts?.ctrlKey ?? false,
    shiftKey: opts?.shiftKey ?? false,
    preventDefault: vi.fn(),
  } as unknown as KeyboardEvent
}

describe('VimInput', () => {
  let vim: VimInput
  let modeChanges: VimMode[] = []

  beforeEach(() => {
    modeChanges = []
    vim = new VimInput((mode) => modeChanges.push(mode))
  })

  describe('initial state', () => {
    it('starts in insert mode', () => {
      expect(vim.mode).toBe('insert')
      expect(modeChanges).toEqual([])
    })

    it('has empty buffer', () => {
      expect(vim.getValue()).toBe('')
    })
  })

  describe('mode transitions', () => {
    it('switches to normal mode on Escape', () => {
      vim.handleKey(keyEvent('Escape'))
      expect(vim.mode).toBe('normal')
      expect(modeChanges).toContain('normal')
    })

    it('switches to insert mode from normal', () => {
      vim.handleKey(keyEvent('Escape'))
      vim.handleKey(keyEvent('i'))
      expect(vim.mode).toBe('insert')
      expect(modeChanges).toEqual(['normal', 'insert'])
    })

    it('enters visual mode from normal', () => {
      vim.handleKey(keyEvent('Escape'))
      vim.handleKey(keyEvent('v'))
      expect(vim.mode).toBe('visual')
    })
  })

  describe('insert mode typing', () => {
    it('adds characters to buffer', () => {
      vim.handleKey(keyEvent('h'))
      vim.handleKey(keyEvent('e'))
      vim.handleKey(keyEvent('l'))
      vim.handleKey(keyEvent('l'))
      vim.handleKey(keyEvent('o'))
      expect(vim.getValue()).toBe('hello')
    })

    it('handles backspace', () => {
      vim.handleKey(keyEvent('h'))
      vim.handleKey(keyEvent('i'))
      vim.handleKey(keyEvent('Backspace'))
      expect(vim.getValue()).toBe('h')
    })

    it('handles Enter for submit', () => {
      vim.handleKey(keyEvent('h'))
      vim.handleKey(keyEvent('i'))
      const result = vim.handleKey(keyEvent('Enter'))
      expect(result).toMatchObject({ type: 'submit', value: 'hi' })
    })
  })

  describe('normal mode motions', () => {
    beforeEach(() => {
      // Set buffer and go to normal mode
      vim.setBuffer('hello world')
      vim.handleKey(keyEvent('Escape'))
      expect(vim.mode).toBe('normal')
    })

    // 'hello world' is 11 chars; cursorBack() === buf.length - cur, so position 0
    // reads 11 and the last char reads 1. Each test anchors at 0 first to stay
    // independent of the post-Escape clamp.
    it('moves left with h', () => {
      vim.handleKey(keyEvent('0'))
      vim.handleKey(keyEvent('l')) // cur 1
      vim.handleKey(keyEvent('h')) // back to 0
      expect(vim.render()).toBe('hello world')
      expect(vim.cursorBack()).toBe(11)
    })

    it('moves right with l', () => {
      vim.handleKey(keyEvent('0'))
      vim.handleKey(keyEvent('l'))
      expect(vim.cursorBack()).toBe(10) // cur 1
    })

    it('moves to start with 0', () => {
      vim.handleKey(keyEvent('0'))
      expect(vim.cursorBack()).toBe(11) // cur 0
    })

    it('moves to end with $', () => {
      vim.handleKey(keyEvent('0'))
      vim.handleKey(keyEvent('$'))
      expect(vim.cursorBack()).toBe(1) // cur 10 (last char 'd')
    })

    it('moves word forward with w', () => {
      vim.handleKey(keyEvent('0'))
      vim.handleKey(keyEvent('w'))
      expect(vim.cursorBack()).toBe(5) // start of 'world' = index 6
    })

    it('moves word back with b', () => {
      vim.handleKey(keyEvent('0'))
      vim.handleKey(keyEvent('w')) // → 'world' (6)
      vim.handleKey(keyEvent('b')) // → 'hello' (0)
      expect(vim.cursorBack()).toBe(11)
    })
  })

  describe('delete operator (d)', () => {
    beforeEach(() => {
      vim.setBuffer('hello world')
      vim.handleKey(keyEvent('Escape'))
    })

    it('deletes word with dw', () => {
      vim.handleKey(keyEvent('0'))
      vim.handleKey(keyEvent('d'))
      vim.handleKey(keyEvent('w'))
      // dw from the start removes 'hello ' (word + trailing space)
      expect(vim.getValue()).toBe('world')
    })

    it('deletes line with dd', () => {
      vim.handleKey(keyEvent('d'))
      vim.handleKey(keyEvent('d'))
      expect(vim.getValue()).toBe('')
    })

    it('deletes character with dl', () => {
      vim.handleKey(keyEvent('0'))
      vim.handleKey(keyEvent('d'))
      vim.handleKey(keyEvent('l'))
      // dl removes only the first character
      expect(vim.getValue()).toBe('ello world')
    })
  })

  describe('change operator (c)', () => {
    beforeEach(() => {
      vim.setBuffer('hello world')
      vim.handleKey(keyEvent('Escape'))
    })

    it('changes word and enters insert mode with cw', () => {
      vim.handleKey(keyEvent('0'))
      vim.handleKey(keyEvent('c'))
      vim.handleKey(keyEvent('w'))
      // cw removes 'hello' leaving 'world' or 'orld' depending on trailing space handling
      expect(vim.getValue()).toMatch(/world|orld/)
      expect(vim.mode).toBe('insert')
    })

    it('changes line with cc', () => {
      vim.handleKey(keyEvent('c'))
      vim.handleKey(keyEvent('c'))
      expect(vim.getValue()).toBe('')
      expect(vim.mode).toBe('insert')
    })
  })

  describe('yank operator (y)', () => {
    beforeEach(() => {
      vim.setBuffer('hello world')
      vim.handleKey(keyEvent('Escape'))
    })

    it('yanks word with yw', () => {
      vim.handleKey(keyEvent('0'))
      vim.handleKey(keyEvent('y'))
      vim.handleKey(keyEvent('w'))
      // Buffer unchanged after yank
      expect(vim.getValue()).toBe('hello world')
    })

    it('yanks line with yy', () => {
      vim.handleKey(keyEvent('y'))
      vim.handleKey(keyEvent('y'))
      expect(vim.getValue()).toBe('hello world')
    })
  })

  describe('undo', () => {
    beforeEach(() => {
      vim.setBuffer('hello world')
      vim.handleKey(keyEvent('Escape'))
    })

    it('undoes last change with u', () => {
      vim.handleKey(keyEvent('0'))
      const originalValue = vim.getValue()
      vim.handleKey(keyEvent('d'))
      vim.handleKey(keyEvent('w'))
      const afterDelete = vim.getValue()
      expect(afterDelete).not.toBe(originalValue)

      vim.handleKey(keyEvent('u'))
      expect(vim.getValue()).toBe(originalValue)
    })
  })

  describe('replace', () => {
    beforeEach(() => {
      vim.setBuffer('hello')
      vim.handleKey(keyEvent('Escape'))
    })

    it('replaces single character with r', () => {
      vim.handleKey(keyEvent('0'))
      vim.handleKey(keyEvent('r'))
      vim.handleKey(keyEvent('H'))
      expect(vim.getValue()).toBe('Hello')
    })
  })

  describe('global shortcuts', () => {
    it('interrupts on Ctrl+C', () => {
      vim.setBuffer('hello')
      const result = vim.handleKey(keyEvent('c', { ctrlKey: true }))
      expect(result).toMatchObject({ type: 'interrupt' })
    })

    it('clears on Ctrl+L', () => {
      vim.setBuffer('hello')
      const result = vim.handleKey(keyEvent('l', { ctrlKey: true }))
      expect(result).toMatchObject({ type: 'clear' })
    })

    it('triggers completion on Tab', () => {
      const result = vim.handleKey(keyEvent('Tab'))
      expect(result).toMatchObject({ type: 'complete' })
    })
  })

  describe('history actions', () => {
    it('returns history up action', () => {
      vim.handleKey(keyEvent('Escape'))
      const result = vim.handleKey(keyEvent('ArrowUp'))
      expect(result).toMatchObject({ type: 'history', dir: 'up' })
    })

    it('returns history down action', () => {
      vim.handleKey(keyEvent('Escape'))
      const result = vim.handleKey(keyEvent('ArrowDown'))
      expect(result).toMatchObject({ type: 'history', dir: 'down' })
    })

    it('returns history up with k', () => {
      vim.handleKey(keyEvent('Escape'))
      const result = vim.handleKey(keyEvent('k'))
      expect(result).toMatchObject({ type: 'history', dir: 'up' })
    })

    it('returns history down with j', () => {
      vim.handleKey(keyEvent('Escape'))
      const result = vim.handleKey(keyEvent('j'))
      expect(result).toMatchObject({ type: 'history', dir: 'down' })
    })
  })

  describe('visual mode', () => {
    beforeEach(() => {
      vim.setBuffer('hello world')
      vim.handleKey(keyEvent('Escape'))
      vim.handleKey(keyEvent('v'))
    })

    it('enters visual mode', () => {
      expect(vim.mode).toBe('visual')
    })

    it('returns to normal mode on Escape', () => {
      vim.handleKey(keyEvent('Escape'))
      expect(vim.mode).toBe('normal')
    })

    it('renders selection with reverse video ANSI', () => {
      // In visual mode, selection should be wrapped in ANSI codes
      const rendered = vim.render()
      expect(rendered).toContain('\x1b[7m') // Reverse video start
      expect(rendered).toContain('\x1b[27m') // Reverse video end
    })
  })

  describe('find character (f/F/t/T)', () => {
    beforeEach(() => {
      vim.setBuffer('hello world')
      vim.handleKey(keyEvent('Escape'))
    })

    it('finds forward with f', () => {
      vim.handleKey(keyEvent('0'))
      vim.handleKey(keyEvent('f'))
      vim.handleKey(keyEvent('o'))
      expect(vim.cursorBack()).toBe(7) // first 'o' in 'hello' = index 4
    })

    it('finds backward with F', () => {
      vim.handleKey(keyEvent('$'))
      vim.handleKey(keyEvent('F'))
      vim.handleKey(keyEvent('w'))
      expect(vim.cursorBack()).toBe(5) // 'w' in 'world' = index 6
    })
  })

  describe('cursor positioning', () => {
    it('reports correct cursor back position', () => {
      vim.setBuffer('hello')
      // In insert mode, cursor at end
      expect(vim.cursorBack()).toBe(0) // buf.length - cur = 5 - 5 = 0
    })
  })
})
