import { describe, it, expect } from 'vitest'
import {
  EDITOR_NORMAL_HANDLERS,
  dispatchEditorNormalKey,
  type EditorNormalCtx,
} from './editor-normal-handlers'
import type { BufferEditResult } from './editor-vim-edits'

/**
 * Minimal recording fake of `EditorNormalCtx`. The buffer text and caret are
 * held in mutable fields so handlers can read them via `text()` / `cur()`, and
 * every side-effecting call is logged so tests can assert exact effects.
 */
interface AppliedEdit {
  result: BufferEditResult | null | undefined
  opts?: { enterInsert?: boolean }
}

class FakeCtx implements EditorNormalCtx {
  key = ''
  private _text: string
  private _cur: number
  /** Queue of values returned by successive consumeCount calls. */
  private countQueue: number[]
  /** Queue of values returned by successive consumeOptionalNat calls. */
  private natQueue: (number | null)[]

  prevented = 0
  setCurCalls: number[] = []
  consumeCountCalls: (number | undefined)[] = []
  consumeOptionalNatCalls = 0
  appliedEdits: AppliedEdit[] = []
  enterInsertCalls = 0
  enterInsertAtCalls: number[] = []
  gotoLineCalls: number[] = []
  gotoLastLineCalls = 0
  deleteThroughEOLCalls = 0
  joinBelowCalls = 0
  yankRegister = ''
  flashCalls: string[] = []
  armReplaceCalls: number[] = []
  undoCalls = 0
  pasteCalls: { times: number; afterLine: boolean }[] = []

  constructor(opts: {
    text?: string
    cur?: number
    counts?: number[]
    nats?: (number | null)[]
  } = {}) {
    this._text = opts.text ?? ''
    this._cur = opts.cur ?? 0
    this.countQueue = opts.counts ? [...opts.counts] : []
    this.natQueue = opts.nats ? [...opts.nats] : []
  }

  prevent(): void {
    this.prevented++
  }
  cur(): number {
    return this._cur
  }
  setCur(pos: number): void {
    this.setCurCalls.push(pos)
    this._cur = pos
  }
  text(): string {
    return this._text
  }
  consumeCount(defaultN?: number): number {
    this.consumeCountCalls.push(defaultN)
    if (this.countQueue.length) return this.countQueue.shift()!
    return defaultN ?? 1
  }
  consumeOptionalNat(): number | null {
    this.consumeOptionalNatCalls++
    if (this.natQueue.length) return this.natQueue.shift()!
    return null
  }
  applyEdit(
    result: BufferEditResult | null | undefined,
    opts?: { enterInsert?: boolean },
  ): boolean {
    this.appliedEdits.push({ result, opts })
    if (result) {
      this._text = result.text
      this._cur = result.pos
    }
    return !!result
  }
  enterInsert(): void {
    this.enterInsertCalls++
  }
  enterInsertAt(pos: number): void {
    this.enterInsertAtCalls.push(pos)
  }
  gotoLine(oneBased: number): void {
    this.gotoLineCalls.push(oneBased)
  }
  gotoLastLine(): void {
    this.gotoLastLineCalls++
  }
  deleteThroughEOL(): void {
    this.deleteThroughEOLCalls++
  }
  joinBelow(): void {
    this.joinBelowCalls++
  }
  flash(msg: string): void {
    this.flashCalls.push(msg)
  }
  armReplace(nRuns: number): void {
    this.armReplaceCalls.push(nRuns)
  }
  undo(): void {
    this.undoCalls++
  }
  paste(times: number, afterLine: boolean): void {
    this.pasteCalls.push({ times, afterLine })
  }
}

function run(key: string, ctx: FakeCtx): boolean {
  ctx.key = key
  return dispatchEditorNormalKey(ctx)
}

describe('dispatchEditorNormalKey', () => {
  it('returns false and runs nothing for an unbound key', () => {
    const ctx = new FakeCtx({ text: 'hello' })
    expect(run('Z', ctx)).toBe(false)
    expect(ctx.prevented).toBe(0)
    expect(ctx.setCurCalls).toEqual([])
  })

  it('returns true and invokes the handler for a bound key', () => {
    const ctx = new FakeCtx({ text: 'hello', cur: 0 })
    expect(run('l', ctx)).toBe(true)
    expect(ctx.prevented).toBe(1)
  })

  it('exposes every documented handler key', () => {
    const keys = Object.keys(EDITOR_NORMAL_HANDLERS).sort()
    expect(keys).toEqual(
      [
        '0', '^', '$', 'G', 'D', 'C', 's', '~', 'Y', 'J', 'r', 'X', 'x',
        'w', 'b', 'e', 'h', 'l', 'j', 'k', 'i', 'a', 'A', 'I', 'o', 'O',
        'u', 'p', 'P',
      ].sort(),
    )
  })
})

describe('motion handlers', () => {
  it("'0' moves to line start, consuming a default count of 1", () => {
    const ctx = new FakeCtx({ text: 'abc\ndef', cur: 6 }) // on the second line
    run('0', ctx)
    expect(ctx.prevented).toBe(1)
    expect(ctx.consumeCountCalls).toEqual([1])
    expect(ctx.setCurCalls).toEqual([4]) // start of 'def'
  })

  it("'^' moves to first non-blank on the line", () => {
    const ctx = new FakeCtx({ text: '   xy', cur: 4 })
    run('^', ctx)
    expect(ctx.setCurCalls).toEqual([3])
    expect(ctx.consumeCountCalls).toEqual([1])
  })

  it("'$' moves to last char of the line (not past newline)", () => {
    const ctx = new FakeCtx({ text: 'abc\ndef', cur: 0 })
    run('$', ctx)
    expect(ctx.setCurCalls).toEqual([2]) // 'c'
  })

  it("'w' advances by word with the consumed count", () => {
    const ctx = new FakeCtx({ text: 'foo bar baz', cur: 0, counts: [2] })
    run('w', ctx)
    expect(ctx.consumeCountCalls).toEqual([1])
    // 2w: foo -> bar (4) -> baz (8), each hop landing on the next word start
    expect(ctx.setCurCalls).toEqual([8])
  })

  it("'w' with count 1 moves to the next word start", () => {
    const ctx = new FakeCtx({ text: 'foo bar', cur: 0 })
    run('w', ctx)
    expect(ctx.setCurCalls).toEqual([4]) // start of 'bar', not the trailing space
  })

  it("'w' from whitespace moves to the start of the following word", () => {
    // 'a bc d': from the space at 1, skip the space to land on 'bc' (2)
    const ctx = new FakeCtx({ text: 'a bc d', cur: 1 })
    run('w', ctx)
    expect(ctx.setCurCalls).toEqual([2])
  })

  it("'b' moves back a word", () => {
    const ctx = new FakeCtx({ text: 'foo bar', cur: 6 })
    run('b', ctx)
    expect(ctx.setCurCalls).toEqual([4]) // start of 'bar'
  })

  it("'e' moves to end of next word", () => {
    const ctx = new FakeCtx({ text: 'foo bar', cur: 0 })
    run('e', ctx)
    expect(ctx.setCurCalls).toEqual([2]) // 'o' end of 'foo'
  })

  it("'h' moves left and 'l' moves right by count", () => {
    const left = new FakeCtx({ text: 'abcde', cur: 4, counts: [2] })
    run('h', left)
    expect(left.setCurCalls).toEqual([2])

    const right = new FakeCtx({ text: 'abcde', cur: 0, counts: [3] })
    run('l', right)
    expect(right.setCurCalls).toEqual([3])
  })

  it("'j' moves down and 'k' moves up preserving column", () => {
    const down = new FakeCtx({ text: 'abc\ndef\nghi', cur: 1 }) // col 1, line 1
    run('j', down)
    expect(down.setCurCalls).toEqual([5]) // 'e' on line 2

    const up = new FakeCtx({ text: 'abc\ndef\nghi', cur: 9 }) // col 1, line 3
    run('k', up)
    expect(up.setCurCalls).toEqual([5]) // 'e' on line 2
  })
})

describe("'G' goto handlers", () => {
  it('jumps to the last line when no count is buffered', () => {
    const ctx = new FakeCtx({ text: 'a\nb\nc', nats: [null] })
    run('G', ctx)
    expect(ctx.consumeOptionalNatCalls).toBe(1)
    expect(ctx.gotoLastLineCalls).toBe(1)
    expect(ctx.gotoLineCalls).toEqual([])
  })

  it('jumps to a specific line when a count is buffered', () => {
    const ctx = new FakeCtx({ text: 'a\nb\nc', nats: [2] })
    run('G', ctx)
    expect(ctx.gotoLineCalls).toEqual([2])
    expect(ctx.gotoLastLineCalls).toBe(0)
  })
})

describe('delegating handlers', () => {
  it("'D' delegates to deleteThroughEOL after consuming count", () => {
    const ctx = new FakeCtx({ text: 'abc' })
    run('D', ctx)
    expect(ctx.consumeCountCalls).toEqual([1])
    expect(ctx.deleteThroughEOLCalls).toBe(1)
  })

  it("'J' delegates to joinBelow without consuming a count", () => {
    const ctx = new FakeCtx({ text: 'a\nb' })
    run('J', ctx)
    expect(ctx.joinBelowCalls).toBe(1)
    expect(ctx.consumeCountCalls).toEqual([])
  })

  it("'u' delegates to undo", () => {
    const ctx = new FakeCtx()
    run('u', ctx)
    expect(ctx.undoCalls).toBe(1)
    expect(ctx.prevented).toBe(1)
  })

  it("'r' arms replace with the consumed count", () => {
    const ctx = new FakeCtx({ text: 'abc', counts: [3] })
    run('r', ctx)
    expect(ctx.armReplaceCalls).toEqual([3])
  })
})

describe('edit handlers (applyEdit)', () => {
  it("'C' deletes through EOL and enters insert", () => {
    const ctx = new FakeCtx({ text: 'abcdef', cur: 2 })
    run('C', ctx)
    expect(ctx.consumeCountCalls).toEqual([1])
    expect(ctx.appliedEdits).toHaveLength(1)
    expect(ctx.appliedEdits[0]!.result).toEqual({ text: 'ab', pos: 2 })
    expect(ctx.appliedEdits[0]!.opts).toEqual({ enterInsert: true })
  })

  it("'s' substitutes count chars and enters insert", () => {
    const ctx = new FakeCtx({ text: 'abcdef', cur: 1, counts: [2] })
    run('s', ctx)
    expect(ctx.appliedEdits[0]!.result).toEqual({ text: 'adef', pos: 1 })
    expect(ctx.appliedEdits[0]!.opts).toEqual({ enterInsert: true })
  })

  it("'~' toggles case of count chars without entering insert", () => {
    const ctx = new FakeCtx({ text: 'abc', cur: 0, counts: [2] })
    run('~', ctx)
    expect(ctx.appliedEdits[0]!.result).toEqual({ text: 'ABc', pos: 2 })
    expect(ctx.appliedEdits[0]!.opts).toBeUndefined()
  })

  it("'x' deletes count chars forward", () => {
    const ctx = new FakeCtx({ text: 'abcdef', cur: 1, counts: [2] })
    run('x', ctx)
    expect(ctx.appliedEdits[0]!.result).toEqual({ text: 'adef', pos: 1 })
  })

  it("'X' deletes count chars backward", () => {
    const ctx = new FakeCtx({ text: 'abcdef', cur: 3, counts: [2] })
    run('X', ctx)
    expect(ctx.appliedEdits[0]!.result).toEqual({ text: 'adef', pos: 1 })
  })

  it("'x' at end of buffer yields a no-op edit (null result)", () => {
    const ctx = new FakeCtx({ text: 'abc', cur: 3 })
    run('x', ctx)
    expect(ctx.appliedEdits[0]!.result).toBeNull()
  })

  it("'o' opens a line below and enters insert", () => {
    const ctx = new FakeCtx({ text: 'abc\ndef', cur: 1 })
    run('o', ctx)
    expect(ctx.appliedEdits[0]!.result).toEqual({ text: 'abc\n\ndef', pos: 4 })
    expect(ctx.appliedEdits[0]!.opts).toEqual({ enterInsert: true })
  })

  it("'O' opens a line above and enters insert", () => {
    const ctx = new FakeCtx({ text: 'abc\ndef', cur: 5 })
    run('O', ctx)
    expect(ctx.appliedEdits[0]!.result).toEqual({ text: 'abc\n\ndef', pos: 4 })
    expect(ctx.appliedEdits[0]!.opts).toEqual({ enterInsert: true })
  })
})

describe('yank and flash', () => {
  it("'Y' yanks through EOL into the register and flashes", () => {
    const ctx = new FakeCtx({ text: 'hello\nworld', cur: 2 })
    run('Y', ctx)
    expect(ctx.yankRegister).toBe('llo')
    expect(ctx.flashCalls).toEqual(['Yanked to end of line'])
    expect(ctx.consumeCountCalls).toEqual([1])
  })
})

describe('insert-entry handlers', () => {
  it("'i' enters insert in place", () => {
    const ctx = new FakeCtx({ text: 'abc', cur: 1 })
    run('i', ctx)
    expect(ctx.enterInsertCalls).toBe(1)
    expect(ctx.enterInsertAtCalls).toEqual([])
    expect(ctx.consumeCountCalls).toEqual([1])
  })

  it("'a' enters insert one char to the right", () => {
    const ctx = new FakeCtx({ text: 'abc', cur: 1 })
    run('a', ctx)
    expect(ctx.enterInsertAtCalls).toEqual([2])
  })

  it("'A' enters insert at end of the current line", () => {
    const ctx = new FakeCtx({ text: 'abc\ndef', cur: 1 })
    run('A', ctx)
    expect(ctx.enterInsertAtCalls).toEqual([3]) // end of first line
  })

  it("'I' enters insert at first non-blank on the line", () => {
    const ctx = new FakeCtx({ text: '  abc', cur: 4 })
    run('I', ctx)
    expect(ctx.enterInsertAtCalls).toEqual([2])
  })
})

describe('paste handlers', () => {
  it("'p' pastes after the current line with the consumed count", () => {
    const ctx = new FakeCtx({ counts: [3] })
    run('p', ctx)
    expect(ctx.pasteCalls).toEqual([{ times: 3, afterLine: true }])
  })

  it("'P' pastes before the current line with the consumed count", () => {
    const ctx = new FakeCtx({ counts: [2] })
    run('P', ctx)
    expect(ctx.pasteCalls).toEqual([{ times: 2, afterLine: false }])
  })
})

describe('every handler suppresses the default key action', () => {
  // Handlers that route through the `edit()` helper call prevent() twice
  // (once in the handler body, once inside `edit`). All others call it once.
  // Either way the key must never reach the browser's default handling.
  const doublePrevent = new Set(['C', 's', '~', 'X', 'x', 'o', 'O'])
  const sampleText = 'foo bar\nbaz qux'
  for (const key of Object.keys(EDITOR_NORMAL_HANDLERS)) {
    it(`'${key}' prevents default at least once`, () => {
      const ctx = new FakeCtx({ text: sampleText, cur: 2 })
      run(key, ctx)
      expect(ctx.prevented).toBe(doublePrevent.has(key) ? 2 : 1)
      expect(ctx.prevented).toBeGreaterThanOrEqual(1)
    })
  }
})
