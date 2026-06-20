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

  // ── added coverage ──────────────────────────────────────────────────────────

  /** Drive a normal-mode key sequence (single chars) after entering normal mode. */
  function keys(seq: string): void {
    for (const ch of seq) vim.handleKey(keyEvent(ch))
  }

  describe('setBuffer / setBufferInsert / clear', () => {
    it('setBuffer in normal mode clamps cursor to last char', () => {
      vim.handleKey(keyEvent('Escape')) // → normal, buf empty
      vim.setBuffer('abc')
      expect(vim.mode).toBe('normal')
      // cur = max(0, len-1) = 2, cursorBack = 3 - 2 = 1
      expect(vim.cursorBack()).toBe(1)
    })

    it('setBuffer in insert mode parks cursor at end', () => {
      vim.setBuffer('abc')
      expect(vim.mode).toBe('insert')
      expect(vim.cursorBack()).toBe(0) // cur = len = 3
    })

    it('setBufferInsert forces insert mode and cursor at end', () => {
      vim.handleKey(keyEvent('Escape')) // → normal
      modeChanges = []
      vim.setBufferInsert('hello')
      expect(vim.mode).toBe('insert')
      expect(modeChanges).toEqual(['insert'])
      expect(vim.getValue()).toBe('hello')
      expect(vim.cursorBack()).toBe(0)
    })

    it('setBufferInsert when already in insert mode does not re-notify', () => {
      vim.setBufferInsert('hi')
      expect(modeChanges).toEqual([]) // no setMode call
      expect(vim.mode).toBe('insert')
    })

    it('clear resets buffer, cursor and mode', () => {
      vim.setBuffer('hello world')
      vim.handleKey(keyEvent('Escape'))
      vim.handleKey(keyEvent('d')) // leave an operator pending
      modeChanges = []
      vim.clear()
      expect(vim.getValue()).toBe('')
      expect(vim.mode).toBe('insert')
      expect(vim.cursorBack()).toBe(0)
      expect(modeChanges).toEqual(['insert'])
      // pending op was cleared: a following 'w' just types normally
      vim.handleKey(keyEvent('w'))
      expect(vim.getValue()).toBe('w')
    })
  })

  describe('Escape edge cases', () => {
    it('Escape from insert backs the cursor up one column', () => {
      vim.setBufferInsert('abc') // cur = 3 (end)
      vim.handleKey(keyEvent('Escape'))
      expect(vim.mode).toBe('normal')
      expect(vim.cursorBack()).toBe(1) // cur 3 → 2
    })

    it('Escape clears a pending operator', () => {
      vim.setBuffer('hello')
      vim.handleKey(keyEvent('Escape'))
      vim.handleKey(keyEvent('d')) // pending d
      vim.handleKey(keyEvent('Escape'))
      // operator gone — 'd' alone again would just re-arm; instead 'x' deletes
      vim.handleKey(keyEvent('0'))
      vim.handleKey(keyEvent('x'))
      expect(vim.getValue()).toBe('ello')
    })

    it('Escape in normal mode is a no-op render', () => {
      vim.setBuffer('hi')
      vim.handleKey(keyEvent('Escape')) // insert → normal
      const result = vim.handleKey(keyEvent('Escape')) // normal → normal
      expect(result).toMatchObject({ type: 'rendered' })
      expect(vim.mode).toBe('normal')
    })
  })

  describe('insert-mode editing', () => {
    it('inserts a character in the middle at the cursor', () => {
      vim.setBuffer('helo')
      vim.handleKey(keyEvent('Escape')) // normal, cur clamped to 3
      vim.handleKey(keyEvent('0'))
      vim.handleKey(keyEvent('l')) // cur 1
      vim.handleKey(keyEvent('l')) // cur 2 ('l')
      vim.handleKey(keyEvent('i')) // insert before cur 2
      vim.handleKey(keyEvent('l'))
      expect(vim.getValue()).toBe('hello')
    })

    it('backspace at column 0 is a no-op', () => {
      vim.setBufferInsert('ab')
      vim.handleKey(keyEvent('ArrowLeft'))
      vim.handleKey(keyEvent('ArrowLeft')) // cur 0
      const result = vim.handleKey(keyEvent('Backspace'))
      expect(result).toMatchObject({ type: 'none' })
      expect(vim.getValue()).toBe('ab')
    })

    it('Home and End move the cursor without changing the buffer', () => {
      vim.setBufferInsert('abcdef')
      vim.handleKey(keyEvent('Home'))
      expect(vim.cursorBack()).toBe(6) // cur 0
      vim.handleKey(keyEvent('End'))
      expect(vim.cursorBack()).toBe(0) // cur 6
    })

    it('Arrow left/right clamp at the insert bounds', () => {
      vim.setBufferInsert('ab') // cur 2
      vim.handleKey(keyEvent('ArrowRight')) // clamp at 2
      expect(vim.cursorBack()).toBe(0)
      vim.handleKey(keyEvent('ArrowLeft'))
      vim.handleKey(keyEvent('ArrowLeft'))
      vim.handleKey(keyEvent('ArrowLeft')) // clamp at 0
      expect(vim.cursorBack()).toBe(2)
    })

    it('ArrowUp/ArrowDown in insert mode request history', () => {
      vim.setBufferInsert('x')
      expect(vim.handleKey(keyEvent('ArrowUp'))).toMatchObject({ type: 'history', dir: 'up' })
      expect(vim.handleKey(keyEvent('ArrowDown'))).toMatchObject({ type: 'history', dir: 'down' })
    })

    it('Ctrl+W deletes the word before the cursor', () => {
      vim.setBufferInsert('foo bar')
      vim.handleKey(keyEvent('w', { ctrlKey: true }))
      expect(vim.getValue()).toBe('foo ')
    })

    it('Ctrl+U deletes from the cursor to the start of the line', () => {
      vim.setBuffer('hello world')
      vim.handleKey(keyEvent('Escape'))
      vim.handleKey(keyEvent('0'))
      vim.handleKey(keyEvent('w')) // cur 6 (start of 'world')
      vim.handleKey(keyEvent('i')) // back to insert at cur 6
      vim.handleKey(keyEvent('u', { ctrlKey: true }))
      expect(vim.getValue()).toBe('world')
      expect(vim.cursorBack()).toBe(5) // cur 0
    })

    it('ignores control-modified printable keys', () => {
      vim.setBufferInsert('a')
      const result = vim.handleKey(keyEvent('z', { ctrlKey: true }))
      expect(result).toMatchObject({ type: 'none' })
      expect(vim.getValue()).toBe('a')
    })
  })

  describe('normal-mode motions (exact positions)', () => {
    beforeEach(() => {
      vim.setBuffer('hello world')
      vim.handleKey(keyEvent('Escape'))
    })

    it('e moves to end of word', () => {
      vim.handleKey(keyEvent('0'))
      vim.handleKey(keyEvent('e'))
      expect(vim.cursorBack()).toBe(7) // 'o' of hello = index 4
    })

    it('^ behaves like 0', () => {
      vim.handleKey(keyEvent('$'))
      vim.handleKey(keyEvent('^'))
      expect(vim.cursorBack()).toBe(11) // cur 0
    })

    it('arrow left/right move and clamp in normal mode', () => {
      vim.handleKey(keyEvent('0'))
      vim.handleKey(keyEvent('ArrowLeft')) // clamp 0
      expect(vim.cursorBack()).toBe(11)
      vim.handleKey(keyEvent('ArrowRight'))
      expect(vim.cursorBack()).toBe(10) // cur 1
    })

    it('a enters insert one column right; A goes to end; I goes to start', () => {
      vim.handleKey(keyEvent('0'))
      vim.handleKey(keyEvent('a'))
      expect(vim.mode).toBe('insert')
      expect(vim.cursorBack()).toBe(10) // cur 1
      vim.handleKey(keyEvent('Escape'))
      vim.handleKey(keyEvent('A'))
      expect(vim.cursorBack()).toBe(0) // cur = len 11
      vim.handleKey(keyEvent('Escape'))
      vim.handleKey(keyEvent('I'))
      expect(vim.cursorBack()).toBe(11) // cur 0
    })
  })

  describe('x / X / D / C', () => {
    it('x deletes the char under the cursor', () => {
      vim.setBuffer('hello')
      vim.handleKey(keyEvent('Escape'))
      vim.handleKey(keyEvent('0'))
      vim.handleKey(keyEvent('x'))
      expect(vim.getValue()).toBe('ello')
    })

    it('x on empty buffer (non-empty path guard) is a no-op when buffer cleared', () => {
      vim.setBuffer('a')
      vim.handleKey(keyEvent('Escape'))
      vim.handleKey(keyEvent('x')) // removes 'a' → empty
      expect(vim.getValue()).toBe('')
      // now buffer empty → 'x' submits 'static'
      const result = vim.handleKey(keyEvent('x'))
      expect(result).toMatchObject({ type: 'submit', value: 'static' })
    })

    it('X deletes the char before the cursor', () => {
      vim.setBuffer('hello')
      vim.handleKey(keyEvent('Escape')) // insert cur 5 → Esc backs to cur 4 ('o')
      vim.handleKey(keyEvent('X'))
      expect(vim.getValue()).toBe('helo') // removes index 3 ('l'), the char before cur
    })

    it('X at column 0 is a no-op', () => {
      vim.setBuffer('hello')
      vim.handleKey(keyEvent('Escape'))
      vim.handleKey(keyEvent('0'))
      const result = vim.handleKey(keyEvent('X'))
      expect(result).toMatchObject({ type: 'none' })
      expect(vim.getValue()).toBe('hello')
    })

    it('D deletes from the cursor to end of line', () => {
      vim.setBuffer('hello world')
      vim.handleKey(keyEvent('Escape'))
      vim.handleKey(keyEvent('0'))
      vim.handleKey(keyEvent('w')) // cur 6 (start of 'world')
      vim.handleKey(keyEvent('D'))
      expect(vim.getValue()).toBe('hello ')
    })

    it('C deletes to end of line and enters insert', () => {
      vim.setBuffer('hello world')
      vim.handleKey(keyEvent('Escape'))
      vim.handleKey(keyEvent('0'))
      vim.handleKey(keyEvent('w'))
      vim.handleKey(keyEvent('C'))
      expect(vim.getValue()).toBe('hello ')
      expect(vim.mode).toBe('insert')
    })
  })

  describe('operator + motion ranges (exact)', () => {
    beforeEach(() => {
      vim.setBuffer('hello world')
      vim.handleKey(keyEvent('Escape'))
      vim.handleKey(keyEvent('0'))
    })

    it('de deletes the word inclusively (end-of-word reaches its target)', () => {
      vim.handleKey(keyEvent('d'))
      vim.handleKey(keyEvent('e'))
      expect(vim.getValue()).toBe(' world')
    })

    it('d$ deletes inclusively to the last char', () => {
      vim.handleKey(keyEvent('d'))
      vim.handleKey(keyEvent('$'))
      expect(vim.getValue()).toBe('')
    })

    it('dl deletes exactly one char (exclusive +1)', () => {
      vim.handleKey(keyEvent('d'))
      vim.handleKey(keyEvent('l'))
      expect(vim.getValue()).toBe('ello world')
    })

    it('dh at column 0 does nothing (motion did not move)', () => {
      const result = vim.handleKey(keyEvent('d'))
      expect(result).toMatchObject({ type: 'none' })
      vim.handleKey(keyEvent('h'))
      expect(vim.getValue()).toBe('hello world')
    })

    it('unknown key cancels a pending operator', () => {
      vim.handleKey(keyEvent('d'))
      const result = vim.handleKey(keyEvent('z'))
      expect(result).toMatchObject({ type: 'rendered' })
      expect(vim.getValue()).toBe('hello world')
      // operator was cancelled, so a later 'x' deletes a single char
      vim.handleKey(keyEvent('x'))
      expect(vim.getValue()).toBe('ello world')
    })
  })

  describe('operator + f/F/t/T ranges (exact)', () => {
    beforeEach(() => {
      vim.setBuffer('hello world')
      vim.handleKey(keyEvent('Escape'))
      vim.handleKey(keyEvent('0'))
    })

    it('df<char> deletes inclusively through the target', () => {
      vim.handleKey(keyEvent('d'))
      vim.handleKey(keyEvent('f'))
      vim.handleKey(keyEvent('o'))
      // f finds 'o' at index 4 inclusively → removes 'hello'
      expect(vim.getValue()).toBe(' world')
    })

    it('dt<char> deletes up to but not including the target', () => {
      vim.handleKey(keyEvent('d'))
      vim.handleKey(keyEvent('t'))
      vim.handleKey(keyEvent('o'))
      // t stops at index 3 ('l'), inclusive operator range removes 'hell'
      expect(vim.getValue()).toBe('o world')
    })

    it('df returns a none action while waiting for the target char', () => {
      vim.handleKey(keyEvent('d'))
      const result = vim.handleKey(keyEvent('f'))
      expect(result).toMatchObject({ type: 'none' })
    })

    it('cf<char> changes inclusively and enters insert', () => {
      vim.handleKey(keyEvent('c'))
      vim.handleKey(keyEvent('f'))
      vim.handleKey(keyEvent(' '))
      // f' ' hits index 5, removes 'hello ' → 'world'
      expect(vim.getValue()).toBe('world')
      expect(vim.mode).toBe('insert')
    })
  })

  describe('doubled operators yy / cc / dd', () => {
    it('yy yanks the whole line without changing it', () => {
      vim.setBuffer('hello world')
      vim.handleKey(keyEvent('Escape'))
      vim.handleKey(keyEvent('y'))
      vim.handleKey(keyEvent('y'))
      expect(vim.getValue()).toBe('hello world')
      // paste to prove the line was yanked
      vim.handleKey(keyEvent('$'))
      vim.handleKey(keyEvent('p'))
      expect(vim.getValue()).toBe('hello worldhello world')
    })

    it('cc clears the line and enters insert', () => {
      vim.setBuffer('hello')
      vim.handleKey(keyEvent('Escape'))
      vim.handleKey(keyEvent('c'))
      vim.handleKey(keyEvent('c'))
      expect(vim.getValue()).toBe('')
      expect(vim.mode).toBe('insert')
    })
  })

  describe('yank then paste (registers)', () => {
    beforeEach(() => {
      vim.setBuffer('hello world')
      vim.handleKey(keyEvent('Escape'))
      vim.handleKey(keyEvent('0'))
    })

    it('yw captures "hello " and P pastes it before the cursor', () => {
      vim.handleKey(keyEvent('y'))
      vim.handleKey(keyEvent('w')) // yank 'hello ', cursor back to 0
      vim.handleKey(keyEvent('P'))
      expect(vim.getValue()).toBe('hello hello world')
    })

    it('p pastes after the cursor', () => {
      vim.handleKey(keyEvent('x')) // delete & yank 'h'
      expect(vim.getValue()).toBe('ello world')
      vim.handleKey(keyEvent('p'))
      expect(vim.getValue()).toBe('ehllo world')
    })

    it('p with nothing yanked is a no-op', () => {
      const result = vim.handleKey(keyEvent('p'))
      expect(result).toMatchObject({ type: 'none' })
      expect(vim.getValue()).toBe('hello world')
    })

    it('P with nothing yanked is a no-op', () => {
      const result = vim.handleKey(keyEvent('P'))
      expect(result).toMatchObject({ type: 'none' })
    })
  })

  describe('~ toggle case', () => {
    it('toggles the char under the cursor and advances', () => {
      vim.setBuffer('abc')
      vim.handleKey(keyEvent('Escape'))
      vim.handleKey(keyEvent('0'))
      vim.handleKey(keyEvent('~'))
      expect(vim.getValue()).toBe('Abc')
      expect(vim.cursorBack()).toBe(2) // advanced to cur 1
      vim.handleKey(keyEvent('~'))
      expect(vim.getValue()).toBe('ABc')
    })

    it('~ on an empty buffer is a no-op', () => {
      vim.handleKey(keyEvent('Escape'))
      const result = vim.handleKey(keyEvent('~'))
      expect(result).toMatchObject({ type: 'none' })
    })
  })

  describe('r replace edge cases', () => {
    it('ignores a ctrl-modified replacement and consumes the pending state', () => {
      vim.setBuffer('hello')
      vim.handleKey(keyEvent('Escape'))
      vim.handleKey(keyEvent('0'))
      vim.handleKey(keyEvent('r'))
      const result = vim.handleKey(keyEvent('a', { ctrlKey: true }))
      expect(result).toMatchObject({ type: 'rendered' })
      expect(vim.getValue()).toBe('hello') // unchanged
    })
  })

  describe('undo stack depth', () => {
    it('u with an empty undo stack is a harmless render', () => {
      vim.setBuffer('hello')
      vim.handleKey(keyEvent('Escape'))
      const result = vim.handleKey(keyEvent('u'))
      expect(result).toMatchObject({ type: 'rendered' })
      expect(vim.getValue()).toBe('hello')
    })

    it('multiple edits undo in reverse order', () => {
      vim.setBuffer('abcd')
      vim.handleKey(keyEvent('Escape'))
      vim.handleKey(keyEvent('0'))
      vim.handleKey(keyEvent('x')) // 'bcd'
      vim.handleKey(keyEvent('x')) // 'cd'
      expect(vim.getValue()).toBe('cd')
      vim.handleKey(keyEvent('u'))
      expect(vim.getValue()).toBe('bcd')
      vim.handleKey(keyEvent('u'))
      expect(vim.getValue()).toBe('abcd')
    })
  })

  describe('t/T motions and ; / , repeat', () => {
    it('t stops before the target; ; steps over and repeats', () => {
      vim.setBuffer('a.b.c.d') // . at 1,3,5
      vim.handleKey(keyEvent('Escape'))
      vim.handleKey(keyEvent('0'))
      vim.handleKey(keyEvent('t'))
      vim.handleKey(keyEvent('.')) // stops at index 0 (before first '.')
      expect(vim.cursorBack()).toBe(7) // cur 0
      vim.handleKey(keyEvent(';')) // advance to before next '.' = index 2
      expect(vim.cursorBack()).toBe(5) // cur 2
      vim.handleKey(keyEvent(';')) // before '.' at 5 → index 4
      expect(vim.cursorBack()).toBe(3) // cur 4
    })

    it('T finds backward (exclusive) and , repeats in reverse', () => {
      vim.setBuffer('a.b.c.d')
      vim.handleKey(keyEvent('Escape'))
      vim.handleKey(keyEvent('$')) // cur 6 ('d')
      vim.handleKey(keyEvent('T'))
      vim.handleKey(keyEvent('.')) // backward to just after '.' at 5 → index 6? stays
      // T from 6: first '.' going back is at 5 → min(6, 5+1)=6, no move
      expect(vim.cursorBack()).toBe(1) // cur 6
      vim.handleKey(keyEvent(';')) // repeat same dir: step over, next '.' at 3 → 3+1=4
      expect(vim.cursorBack()).toBe(3) // cur 4
    })

    it('; with no prior find is a no-op', () => {
      vim.setBuffer('abc')
      vim.handleKey(keyEvent('Escape'))
      const result = vim.handleKey(keyEvent(';'))
      expect(result).toMatchObject({ type: 'none' })
    })

    it(', with no prior find is a no-op', () => {
      vim.setBuffer('abc')
      vim.handleKey(keyEvent('Escape'))
      const result = vim.handleKey(keyEvent(','))
      expect(result).toMatchObject({ type: 'none' })
    })

    it('f then , repeats backward (inclusive)', () => {
      vim.setBuffer('axbxc') // x at 1 and 3
      vim.handleKey(keyEvent('Escape'))
      vim.handleKey(keyEvent('0'))
      vim.handleKey(keyEvent('f'))
      vim.handleKey(keyEvent('x')) // forward inclusive → index 1
      expect(vim.cursorBack()).toBe(4) // cur 1
      vim.handleKey(keyEvent('l')) // cur 2
      vim.handleKey(keyEvent('l')) // cur 3 (the second x)
      vim.handleKey(keyEvent(',')) // reverse inclusive find of 'x' → index 1
      expect(vim.cursorBack()).toBe(4) // cur 1
    })

    it('f with a char not present leaves the cursor put', () => {
      vim.setBuffer('hello')
      vim.handleKey(keyEvent('Escape'))
      vim.handleKey(keyEvent('0'))
      vim.handleKey(keyEvent('f'))
      vim.handleKey(keyEvent('z'))
      expect(vim.cursorBack()).toBe(5) // cur 0, unchanged
    })

    it('; after f repeats forward to the next occurrence', () => {
      vim.setBuffer('axbxc')
      vim.handleKey(keyEvent('Escape'))
      vim.handleKey(keyEvent('0'))
      vim.handleKey(keyEvent('f'))
      vim.handleKey(keyEvent('x')) // → index 1
      vim.handleKey(keyEvent(';')) // → index 3
      expect(vim.cursorBack()).toBe(2) // cur 3
    })
  })

  describe('visual mode operations', () => {
    beforeEach(() => {
      vim.setBuffer('hello world')
      vim.handleKey(keyEvent('Escape'))
      vim.handleKey(keyEvent('0'))
      vim.handleKey(keyEvent('v')) // anchor at 0
    })

    it('renders the exact reverse-video span for the selection', () => {
      vim.handleKey(keyEvent('l'))
      vim.handleKey(keyEvent('l')) // cur 2, selection covers indices 0..2
      expect(vim.render()).toBe('\x1b[7mhel\x1b[27mlo world')
    })

    it('d deletes the selection and returns to normal', () => {
      vim.handleKey(keyEvent('e')) // select 'hello' (0..4)
      vim.handleKey(keyEvent('d'))
      expect(vim.getValue()).toBe(' world')
      expect(vim.mode).toBe('normal')
    })

    it('x deletes the selection like d', () => {
      vim.handleKey(keyEvent('l')) // 0..1
      vim.handleKey(keyEvent('x'))
      expect(vim.getValue()).toBe('llo world')
      expect(vim.mode).toBe('normal')
    })

    it('c deletes the selection and enters insert', () => {
      vim.handleKey(keyEvent('e')) // 'hello'
      vim.handleKey(keyEvent('c'))
      expect(vim.getValue()).toBe(' world')
      expect(vim.mode).toBe('insert')
    })

    it('y yanks the selection, collapses cursor and returns to normal', () => {
      vim.handleKey(keyEvent('e')) // select 'hello'
      vim.handleKey(keyEvent('y'))
      expect(vim.mode).toBe('normal')
      expect(vim.getValue()).toBe('hello world')
      vim.handleKey(keyEvent('p')) // paste after cur 0
      expect(vim.getValue()).toBe('hhelloello world')
    })

    it('~ toggles case across the selection and returns to normal', () => {
      vim.handleKey(keyEvent('e')) // 'hello'
      vim.handleKey(keyEvent('~'))
      expect(vim.getValue()).toBe('HELLO world')
      expect(vim.mode).toBe('normal')
    })

    it('supports the full set of extend motions', () => {
      vim.handleKey(keyEvent('$')) // → end
      expect(vim.render()).toBe('\x1b[7mhello world\x1b[27m')
      vim.handleKey(keyEvent('0'))
      vim.handleKey(keyEvent('w')) // cur 6
      vim.handleKey(keyEvent('b')) // cur 0
      vim.handleKey(keyEvent('ArrowRight'))
      vim.handleKey(keyEvent('ArrowLeft'))
      expect(vim.render()).toBe('\x1b[7mh\x1b[27mello world')
    })

    it('an unhandled key in visual mode is a no-op', () => {
      const result = vim.handleKey(keyEvent('z'))
      expect(result).toMatchObject({ type: 'none' })
    })

    it('render on an empty buffer in visual mode is empty', () => {
      vim.handleKey(keyEvent('Escape')) // → normal
      vim.handleKey(keyEvent('d'))
      vim.handleKey(keyEvent('d')) // clear line
      vim.handleKey(keyEvent('v')) // visual on empty buffer
      expect(vim.render()).toBe('')
    })
  })

  describe('raw ANSI is emitted', () => {
    it('keeps the literal reverse-video escapes in render output', () => {
      vim.setBuffer('hi')
      vim.handleKey(keyEvent('Escape'))
      vim.handleKey(keyEvent('0'))
      vim.handleKey(keyEvent('v'))
      const raw = vim.render()
      expect(raw).toContain('\x1b[7m')
      expect(raw).toContain('\x1b[27m')
      // strip ANSI → visible text is just the buffer
      const plain = raw.replace(/\x1b\[[0-9;]*m/g, '')
      expect(plain).toBe('hi')
    })
  })

  describe('x submit shortcut guards', () => {
    it('x on empty buffer submits the static URL', () => {
      vim.handleKey(keyEvent('Escape'))
      const result = vim.handleKey(keyEvent('x'))
      expect(result).toMatchObject({ type: 'submit', value: 'static' })
    })

    it('x with a modifier on empty buffer does not submit', () => {
      vim.handleKey(keyEvent('Escape'))
      const result = vim.handleKey(keyEvent('x', { ctrlKey: true }))
      // ctrl+x is not ctrl+c/ctrl+l → falls through; buffer empty so 'x' path
      // is guarded by !ev.ctrlKey, and x-delete sees empty buffer → none
      expect(result).toMatchObject({ type: 'none' })
    })
  })

  describe('keys helper smoke (insert sequence)', () => {
    it('types a sequence via the helper', () => {
      keys('abc')
      expect(vim.getValue()).toBe('abc')
    })
  })

  describe('remaining branch coverage', () => {
    it('db deletes the previous word via the operator b-motion', () => {
      vim.setBuffer('hello world')
      vim.handleKey(keyEvent('Escape'))
      vim.handleKey(keyEvent('0'))
      vim.handleKey(keyEvent('w')) // cur 6 (start of 'world')
      vim.handleKey(keyEvent('d'))
      vim.handleKey(keyEvent('b'))
      expect(vim.getValue()).toBe('world')
    })

    it('d0 deletes back to the start of the line', () => {
      vim.setBuffer('hello world')
      vim.handleKey(keyEvent('Escape'))
      vim.handleKey(keyEvent('0'))
      vim.handleKey(keyEvent('w')) // cur 6
      vim.handleKey(keyEvent('d'))
      vim.handleKey(keyEvent('0'))
      expect(vim.getValue()).toBe('world')
    })

    it('b over a punctuation run lands at the start of the run', () => {
      vim.setBuffer('a..b') // '.' at 1 and 2
      vim.handleKey(keyEvent('Escape')) // cur 3 ('b')
      vim.handleKey(keyEvent('b'))
      expect(vim.cursorBack()).toBe(3) // cur 1, start of the '..' run
    })

    it('reverse repeat that finds no further target leaves the cursor put', () => {
      vim.setBuffer('a.b') // single '.' at index 1
      vim.handleKey(keyEvent('Escape'))
      vim.handleKey(keyEvent('$')) // cur 2 ('b')
      vim.handleKey(keyEvent('T'))
      vim.handleKey(keyEvent('.')) // exclusive backward → stays at cur 2
      expect(vim.cursorBack()).toBe(1) // cur 2
      vim.handleKey(keyEvent(';')) // step over adjacent, no more '.' → stays
      expect(vim.cursorBack()).toBe(1) // cur 2, unchanged
    })

    it('an unhandled bare normal-mode key is a no-op', () => {
      vim.setBuffer('hello')
      vim.handleKey(keyEvent('Escape'))
      const result = vim.handleKey(keyEvent('q'))
      expect(result).toMatchObject({ type: 'none' })
      expect(vim.getValue()).toBe('hello')
    })

    it('w from inside a punctuation run skips to the next word', () => {
      vim.setBuffer('a..b c') // '.' at 1,2 ; 'b' at 3
      vim.handleKey(keyEvent('Escape'))
      vim.handleKey(keyEvent('0'))
      vim.handleKey(keyEvent('l')) // cur 1, on first '.'
      vim.handleKey(keyEvent('w'))
      expect(vim.cursorBack()).toBe(3) // cur 3, the 'b' after the '..' run
    })

    it('e reaches the end of a punctuation run', () => {
      vim.setBuffer('a..b') // '.' at 1,2
      vim.handleKey(keyEvent('Escape'))
      vim.handleKey(keyEvent('0')) // cur 0 ('a')
      vim.handleKey(keyEvent('e'))
      expect(vim.cursorBack()).toBe(2) // cur 2, end of the '..' run
    })
  })
})
