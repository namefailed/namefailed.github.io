/**
 * NORMAL-mode single-key dispatch for the modal editor.
 *
 * Multi-key chords (`gg`, `>>`, `dd`, count prefixes, find-await) stay in
 * `editor-window.ts`. This map handles stable one-stroke bindings.
 */

import type { BufferEditResult } from './editor-vim-edits'
import {
  deleteCharBackwardText,
  deleteCharForwardText,
  deleteThroughEOLText,
  openLineAboveText,
  openLineBelowText,
  substituteCharsText,
  toggleCaseRunText,
  yankToEOLText,
} from './editor-vim-edits'
import {
  appendLineEndPos,
  firstNonBlankOnLine,
  lineBounds,
  lineEndCaretPos,
  moveHorizPos,
  moveVertRepeat,
  wordBackRepeat,
  wordEndForwardRepeat,
  wordForwardRepeat,
} from './editor-vim-motions'

export interface EditorNormalCtx {
  readonly key: string
  prevent(): void
  cur(): number
  setCur(pos: number): void
  text(): string
  consumeCount(defaultN?: number): number
  consumeOptionalNat(): number | null
  applyEdit(result: BufferEditResult | null | undefined, opts?: { enterInsert?: boolean }): boolean
  enterInsert(): void
  enterInsertAt(pos: number): void
  gotoLine(oneBased: number): void
  gotoLastLine(): void
  deleteThroughEOL(): void
  joinBelow(): void
  yankRegister: string
  flash(msg: string): void
  armReplace(nRuns: number): void
  undo(): void
  paste(times: number, afterLine: boolean): void
}

export type EditorNormalHandler = (ctx: EditorNormalCtx) => void

function motion(ctx: EditorNormalCtx, pos: number): void {
  ctx.prevent()
  ctx.setCur(pos)
}

function edit(
  ctx: EditorNormalCtx,
  result: BufferEditResult | null | undefined,
  opts?: { enterInsert?: boolean },
): void {
  ctx.prevent()
  ctx.applyEdit(result, opts)
}

export const EDITOR_NORMAL_HANDLERS: Readonly<Record<string, EditorNormalHandler>> = {
  '0': ctx => {
    ctx.prevent()
    ctx.consumeCount(1)
    ctx.setCur(lineBounds(ctx.text(), ctx.cur()).start)
  },
  '^': ctx => {
    ctx.prevent()
    ctx.consumeCount(1)
    ctx.setCur(firstNonBlankOnLine(ctx.text(), ctx.cur()))
  },
  $: ctx => {
    ctx.prevent()
    ctx.consumeCount(1)
    ctx.setCur(lineEndCaretPos(ctx.text(), ctx.cur()))
  },
  G: ctx => {
    ctx.prevent()
    const n = ctx.consumeOptionalNat()
    if (n == null) ctx.gotoLastLine()
    else ctx.gotoLine(n)
  },
  D: ctx => {
    ctx.prevent()
    ctx.consumeCount(1)
    ctx.deleteThroughEOL()
  },
  C: ctx => {
    ctx.prevent()
    ctx.consumeCount(1)
    edit(ctx, deleteThroughEOLText(ctx.text(), ctx.cur()), { enterInsert: true })
  },
  s: ctx => {
    ctx.prevent()
    edit(ctx, substituteCharsText(ctx.text(), ctx.cur(), ctx.consumeCount(1)), { enterInsert: true })
  },
  '~': ctx => {
    ctx.prevent()
    edit(ctx, toggleCaseRunText(ctx.text(), ctx.cur(), ctx.consumeCount(1)))
  },
  Y: ctx => {
    ctx.prevent()
    ctx.consumeCount(1)
    ctx.yankRegister = yankToEOLText(ctx.text(), ctx.cur())
    ctx.flash('Yanked to end of line')
  },
  J: ctx => {
    ctx.prevent()
    ctx.joinBelow()
  },
  r: ctx => {
    ctx.prevent()
    ctx.armReplace(ctx.consumeCount(1))
  },
  X: ctx => {
    ctx.prevent()
    edit(ctx, deleteCharBackwardText(ctx.text(), ctx.cur(), ctx.consumeCount(1)))
  },
  x: ctx => {
    ctx.prevent()
    edit(ctx, deleteCharForwardText(ctx.text(), ctx.cur(), ctx.consumeCount(1)))
  },
  w: ctx => motion(ctx, wordForwardRepeat(ctx.text(), ctx.cur(), ctx.consumeCount(1))),
  b: ctx => motion(ctx, wordBackRepeat(ctx.text(), ctx.cur(), ctx.consumeCount(1))),
  e: ctx => motion(ctx, wordEndForwardRepeat(ctx.text(), ctx.cur(), ctx.consumeCount(1))),
  h: ctx => motion(ctx, moveHorizPos(ctx.text(), ctx.cur(), -1, ctx.consumeCount(1))),
  l: ctx => motion(ctx, moveHorizPos(ctx.text(), ctx.cur(), 1, ctx.consumeCount(1))),
  j: ctx => motion(ctx, moveVertRepeat(ctx.text(), ctx.cur(), 1, ctx.consumeCount(1))),
  k: ctx => motion(ctx, moveVertRepeat(ctx.text(), ctx.cur(), -1, ctx.consumeCount(1))),
  i: ctx => {
    ctx.prevent()
    ctx.consumeCount(1)
    ctx.enterInsert()
  },
  a: ctx => {
    ctx.prevent()
    ctx.consumeCount(1)
    ctx.enterInsertAt(ctx.cur() + 1)
  },
  A: ctx => {
    ctx.prevent()
    ctx.consumeCount(1)
    ctx.enterInsertAt(appendLineEndPos(ctx.text(), ctx.cur()))
  },
  I: ctx => {
    ctx.prevent()
    ctx.consumeCount(1)
    ctx.enterInsertAt(firstNonBlankOnLine(ctx.text(), ctx.cur()))
  },
  o: ctx => {
    ctx.prevent()
    ctx.consumeCount(1)
    edit(ctx, openLineBelowText(ctx.text(), ctx.cur()), { enterInsert: true })
  },
  O: ctx => {
    ctx.prevent()
    ctx.consumeCount(1)
    edit(ctx, openLineAboveText(ctx.text(), ctx.cur()), { enterInsert: true })
  },
  u: ctx => {
    ctx.prevent()
    ctx.undo()
  },
  p: ctx => {
    ctx.prevent()
    ctx.paste(ctx.consumeCount(1), true)
  },
  P: ctx => {
    ctx.prevent()
    ctx.paste(ctx.consumeCount(1), false)
  },
}

/** Returns true when a handler consumed the key. */
export function dispatchEditorNormalKey(ctx: EditorNormalCtx): boolean {
  const handler = EDITOR_NORMAL_HANDLERS[ctx.key]
  if (!handler) return false
  handler(ctx)
  return true
}
