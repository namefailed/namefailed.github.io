/** Single-line vim-like input for the shell prompt (modes, operators, f/F/t/T, visuals with ANSI spans). */

export type VimMode = 'insert' | 'normal' | 'visual'

type PendingOp     = 'd' | 'c' | 'y'
type PendingMotion = 'f' | 'F' | 't' | 'T' | 'r'

export type InputAction =
  | { type: 'none'      }
  | { type: 'rendered'  }
  | { type: 'submit';   value: string }
  | { type: 'history';  dir: 'up' | 'down' }
  | { type: 'complete'  }
  | { type: 'interrupt' }
  | { type: 'clear'     }

// ─────────────────────────────────────────────────────────────────────────────

export class VimInput {
  mode: VimMode = 'insert'

  private buf:           string = ''
  private cur:           number = 0   // cursor index; in insert mode can equal buf.length
  private pendingOp:     PendingOp     | null = null
  private pendingMotion: PendingMotion | null = null
  private lastFT:        { type: PendingMotion; ch: string } | null = null
  private yank:          string = ''
  private visualAnchor:  number = 0
  private undoStack:     Array<{ buf: string; cur: number }> = []

  private readonly onModeChange: (mode: VimMode) => void

  constructor(onModeChange: (mode: VimMode) => void) {
    this.onModeChange = onModeChange
  }

  // ── public API ─────────────────────────────────────────────────────────────

  getValue(): string { return this.buf }

  /** Set buffer + keep current mode, position cursor at end. Used for history. */
  setBuffer(text: string): void {
    this.buf = text
    this.cur = this.mode === 'insert'
      ? text.length
      : Math.max(0, text.length - 1)
  }

  /** Set buffer + complete/autocomplete — stays in insert mode, cursor at end. */
  setBufferInsert(text: string): void {
    this.buf = text
    this.cur = text.length
    if (this.mode !== 'insert') this.setMode('insert')
  }

  /** Called on Enter / Ctrl+C. Resets to empty insert-mode state. */
  clear(): void {
    this.buf           = ''
    this.cur           = 0
    this.pendingOp     = null
    this.pendingMotion = null
    this.mode          = 'insert'
    this.onModeChange('insert')
  }

  /**
   * Render the buffer to an ANSI-escaped string ready to write to the terminal.
   * In insert/normal mode the string is plain (xterm cursor does the work).
   * In visual mode the selection is wrapped in reverse-video ANSI.
   */
  render(): string {
    if (this.mode !== 'visual') return this.buf

    if (this.buf.length === 0) return ''
    const [lo, hi] = this.visualRange()
    return (
      this.buf.slice(0, lo) +
      '\x1b[7m' + this.buf.slice(lo, hi + 1) + '\x1b[27m' +
      this.buf.slice(hi + 1)
    )
  }

  /**
   * Number of columns to move the xterm cursor LEFT after writing render().
   * After writing PROMPT + render() + \x1b[K, the xterm cursor is at column
   * PROMPT_LEN + buf.length.  Moving back (buf.length − cur) puts it at cur.
   */
  cursorBack(): number {
    return this.buf.length - this.cur
  }

  /** Main entry point — call from xterm onKey handler. */
  handleKey(ev: KeyboardEvent): InputAction {
    // ── global shortcuts (all modes) ────────────────────────────────────────
    if (ev.ctrlKey && ev.key === 'c')  return { type: 'interrupt' }
    if (ev.ctrlKey && ev.key === 'l')  return { type: 'clear' }
    if (ev.key === 'Tab')              { ev.preventDefault(); return { type: 'complete' } }
    if (ev.key === 'Enter')            {
      const value = this.buf
      return { type: 'submit', value }
    }

    // ── Escape ───────────────────────────────────────────────────────────────
    if (ev.key === 'Escape') {
      this.pendingOp     = null
      this.pendingMotion = null
      if (this.mode === 'insert') {
        this.cur = Math.max(0, this.cur - 1)   // vim: Esc backs cursor up 1
        this.setMode('normal')
        return { type: 'rendered' }
      }
      if (this.mode === 'visual') {
        this.setMode('normal')
        return { type: 'rendered' }
      }
      return { type: 'rendered' }
    }

    if (this.mode === 'insert') return this.handleInsert(ev)
    if (this.mode === 'visual') return this.handleVisual(ev)
    return this.handleNormal(ev)
  }

  // ── private ────────────────────────────────────────────────────────────────

  private setMode(m: VimMode): void {
    this.mode = m
    this.onModeChange(m)
  }

  private clampNormal(n: number): number {
    return Math.max(0, Math.min(this.buf.length - 1, n))
  }

  private clampInsert(n: number): number {
    return Math.max(0, Math.min(this.buf.length, n))
  }

  private saveUndo(): void {
    this.undoStack.push({ buf: this.buf, cur: this.cur })
    if (this.undoStack.length > 50) this.undoStack.shift()
  }

  private visualRange(): [number, number] {
    const lo = Math.min(this.visualAnchor, this.cur)
    const hi = Math.max(this.visualAnchor, this.cur)
    return [lo, hi]
  }

  // ── motion helpers ─────────────────────────────────────────────────────────

  private wordForward(): number {
    let i = this.cur
    if (/\w/.test(this.buf[i] ?? '')) {
      while (i < this.buf.length && /\w/.test(this.buf[i])) i++
    } else {
      while (i < this.buf.length && /\S/.test(this.buf[i]) && !/\w/.test(this.buf[i])) i++
    }
    while (i < this.buf.length && /\s/.test(this.buf[i])) i++
    return this.clampNormal(i)
  }

  private wordEnd(): number {
    let i = this.cur + 1
    // skip whitespace
    while (i < this.buf.length && /\s/.test(this.buf[i])) i++
    if (/\w/.test(this.buf[i] ?? '')) {
      while (i + 1 < this.buf.length && /\w/.test(this.buf[i + 1])) i++
    } else {
      while (i + 1 < this.buf.length && /\S/.test(this.buf[i + 1]) && !/\w/.test(this.buf[i + 1])) i++
    }
    return this.clampNormal(i)
  }

  private wordBack(): number {
    let i = this.cur - 1
    // skip whitespace
    while (i > 0 && /\s/.test(this.buf[i])) i--
    if (/\w/.test(this.buf[i] ?? '')) {
      while (i > 0 && /\w/.test(this.buf[i - 1])) i--
    } else {
      while (i > 0 && /\S/.test(this.buf[i - 1]) && !/\w/.test(this.buf[i - 1])) i--
    }
    return Math.max(0, i)
  }

  private applyMotion(k: string): number {
    switch (k) {
      case 'h':          return this.clampNormal(this.cur - 1)
      case 'l':          return this.clampNormal(this.cur + 1)
      case '0': case '^':return 0
      case '$':          return Math.max(0, this.buf.length - 1)
      case 'w':          return this.wordForward()
      case 'b':          return this.wordBack()
      case 'e':          return this.wordEnd()
      default:           return this.cur
    }
  }

  private findChar(ch: string, forward: boolean, inclusive: boolean): number {
    if (forward) {
      for (let i = this.cur + 1; i < this.buf.length; i++) {
        if (this.buf[i] === ch) return inclusive ? i : Math.max(this.cur, i - 1)
      }
    } else {
      for (let i = this.cur - 1; i >= 0; i--) {
        if (this.buf[i] === ch) return inclusive ? i : Math.min(this.cur, i + 1)
      }
    }
    return this.cur   // not found — don't move
  }

  /**
   * Repeat an f/F/t/T motion for `;` / `,`. f/F just re-run findChar, but t/T
   * leave the caret right next to the previous target, so a naive repeat finds
   * that same char and never advances — step over the adjacent hit first.
   */
  private repeatFind(ch: string, forward: boolean, inclusive: boolean): number {
    if (inclusive) return this.findChar(ch, forward, inclusive)
    if (forward) {
      let i = this.cur + 1
      if (this.buf[i] === ch) i++
      for (; i < this.buf.length; i++) {
        if (this.buf[i] === ch) return i - 1
      }
    } else {
      let i = this.cur - 1
      if (this.buf[i] === ch) i--
      for (; i >= 0; i--) {
        if (this.buf[i] === ch) return i + 1
      }
    }
    return this.cur
  }

  // ── operator execution ─────────────────────────────────────────────────────

  private execOp(op: PendingOp, lo: number, hi: number): void {
    this.saveUndo()
    this.yank = this.buf.slice(lo, hi + 1)
    this.buf  = this.buf.slice(0, lo) + this.buf.slice(hi + 1)
    this.cur  = this.clampNormal(lo)
    if (op === 'c') {
      this.cur = lo   // cursor at start of gap in insert mode
      this.setMode('insert')
    }
  }

  // ── normal mode ────────────────────────────────────────────────────────────

  private handleNormal(ev: KeyboardEvent): InputAction {
    const k = ev.key

    // ── pending motion char (f/F/t/T waiting for target char, or r for replace)

    if (this.pendingMotion) {
      const motion = this.pendingMotion
      this.pendingMotion = null

      if (motion === 'r') {
        if (k.length === 1 && !ev.ctrlKey) {
          this.saveUndo()
          this.buf = this.buf.slice(0, this.cur) + k + this.buf.slice(this.cur + 1)
        }
        return { type: 'rendered' }
      }

      // f / F / t / T
      if (k.length === 1) {
        const forward   = motion === 'f' || motion === 't'
        const inclusive = motion === 'f' || motion === 'F'
        this.lastFT = { type: motion, ch: k }
        const dest = this.findChar(k, forward, inclusive)

        if (this.pendingOp) {
          const op = this.pendingOp; this.pendingOp = null
          const lo = Math.min(this.cur, dest)
          const hi = Math.max(this.cur, dest)
          this.execOp(op, lo, hi)
        } else {
          this.cur = dest
        }
      }
      return { type: 'rendered' }
    }

    // ── pending operator (d/c/y waiting for a motion or doubled key) ──────────

    if (this.pendingOp) {
      const op = this.pendingOp

      // Doubled operator = whole line
      if (
        (op === 'd' && k === 'd') ||
        (op === 'c' && k === 'c') ||
        (op === 'y' && k === 'y')
      ) {
        this.pendingOp = null
        if (op === 'y') {
          this.yank = this.buf
          return { type: 'rendered' }
        }
        this.saveUndo()
        this.yank = this.buf
        this.buf  = ''
        this.cur  = 0
        if (op === 'c') this.setMode('insert')
        return { type: 'rendered' }
      }

      // Motion-based
      const MOTIONS = ['h', 'l', '0', '^', '$', 'w', 'b', 'e']
      if (MOTIONS.includes(k)) {
        this.pendingOp = null
        const dest = this.applyMotion(k)
        const lo   = Math.min(this.cur, dest)
        let hi     = Math.max(this.cur, dest)
        // h/l/0/^/w/b are exclusive — the char at the destination is not part of
        // the range; only e and $ reach inclusively to their target.
        if (k !== 'e' && k !== '$') hi -= 1
        if (hi < lo) return { type: 'rendered' } // motion didn't move; nothing to do
        if (op !== 'y') {
          this.execOp(op, lo, hi)
        } else {
          this.yank = this.buf.slice(lo, hi + 1)
          this.cur  = lo
        }
        return { type: 'rendered' }
      }

      // f/F/t/T as operator motion
      if (k === 'f' || k === 'F' || k === 't' || k === 'T') {
        this.pendingMotion = k as PendingMotion
        return { type: 'none' }
      }

      // Unknown key — cancel operator
      this.pendingOp = null
      return { type: 'rendered' }
    }

    // ── bare normal-mode keys ─────────────────────────────────────────────────

    // Single `x` on an empty line submits `static` (plain portfolio URL) — otherwise vim `x` is delete-char and does nothing with an empty buffer.
    if (
      !this.pendingOp &&
      !this.pendingMotion &&
      this.buf === '' &&
      ev.key === 'x' &&
      ev.key.length === 1 &&
      !ev.ctrlKey &&
      !ev.altKey &&
      !ev.metaKey
    ) {
      return { type: 'submit', value: 'static' }
    }

    // History (j/k — single-line context)
    if (k === 'k') return { type: 'history', dir: 'up' }
    if (k === 'j') return { type: 'history', dir: 'down' }

    // Arrow keys (also do history for up/down)
    if (k === 'ArrowUp')    return { type: 'history', dir: 'up' }
    if (k === 'ArrowDown')  return { type: 'history', dir: 'down' }
    if (k === 'ArrowLeft')  { this.cur = this.clampNormal(this.cur - 1); return { type: 'rendered' } }
    if (k === 'ArrowRight') { this.cur = this.clampNormal(this.cur + 1); return { type: 'rendered' } }

    // Basic motions
    if (k === 'h')           { this.cur = this.clampNormal(this.cur - 1);      return { type: 'rendered' } }
    if (k === 'l')           { this.cur = this.clampNormal(this.cur + 1);      return { type: 'rendered' } }
    if (k === '0' || k === '^') { this.cur = 0;                               return { type: 'rendered' } }
    if (k === '$')           { this.cur = Math.max(0, this.buf.length - 1);    return { type: 'rendered' } }
    if (k === 'w')           { this.cur = this.wordForward();                  return { type: 'rendered' } }
    if (k === 'b')           { this.cur = this.wordBack();                     return { type: 'rendered' } }
    if (k === 'e')           { this.cur = this.wordEnd();                      return { type: 'rendered' } }

    // Insert-mode entry points
    if (k === 'i') { this.setMode('insert');                                   return { type: 'rendered' } }
    if (k === 'a') { this.cur = this.clampInsert(this.cur + 1); this.setMode('insert'); return { type: 'rendered' } }
    if (k === 'A') { this.cur = this.buf.length;  this.setMode('insert');      return { type: 'rendered' } }
    if (k === 'I') { this.cur = 0;                this.setMode('insert');      return { type: 'rendered' } }

    // x / X — delete char
    if (k === 'x') {
      if (!this.buf.length) return { type: 'none' }
      this.saveUndo()
      this.yank = this.buf[this.cur]
      this.buf  = this.buf.slice(0, this.cur) + this.buf.slice(this.cur + 1)
      this.cur  = this.clampNormal(this.cur)
      return { type: 'rendered' }
    }
    if (k === 'X') {
      if (this.cur === 0) return { type: 'none' }
      this.saveUndo()
      this.yank = this.buf[this.cur - 1]
      this.buf  = this.buf.slice(0, this.cur - 1) + this.buf.slice(this.cur)
      this.cur  = this.clampNormal(this.cur - 1)
      return { type: 'rendered' }
    }

    // D / C — delete / change to end of line
    if (k === 'D') {
      this.saveUndo()
      this.yank = this.buf.slice(this.cur)
      this.buf  = this.buf.slice(0, this.cur)
      this.cur  = this.clampNormal(this.cur - 1)
      return { type: 'rendered' }
    }
    if (k === 'C') {
      this.saveUndo()
      this.yank = this.buf.slice(this.cur)
      this.buf  = this.buf.slice(0, this.cur)
      this.setMode('insert')
      return { type: 'rendered' }
    }

    // Operators (start pending)
    if (k === 'd') { this.pendingOp = 'd'; return { type: 'none' } }
    if (k === 'c') { this.pendingOp = 'c'; return { type: 'none' } }
    if (k === 'y') { this.pendingOp = 'y'; return { type: 'none' } }

    // p / P — paste after / before
    if (k === 'p') {
      if (!this.yank) return { type: 'none' }
      this.saveUndo()
      const at  = Math.min(this.cur + 1, this.buf.length)
      this.buf  = this.buf.slice(0, at) + this.yank + this.buf.slice(at)
      this.cur  = this.clampNormal(at + this.yank.length - 1)
      return { type: 'rendered' }
    }
    if (k === 'P') {
      if (!this.yank) return { type: 'none' }
      this.saveUndo()
      this.buf  = this.buf.slice(0, this.cur) + this.yank + this.buf.slice(this.cur)
      this.cur  = this.clampNormal(this.cur + this.yank.length - 1)
      return { type: 'rendered' }
    }

    // r — replace single char (waits for next keypress)
    if (k === 'r') { this.pendingMotion = 'r'; return { type: 'none' } }

    // ~ — toggle case of char at cursor, advance
    if (k === '~') {
      if (!this.buf.length) return { type: 'none' }
      this.saveUndo()
      const ch      = this.buf[this.cur]
      const toggled = ch === ch.toUpperCase() ? ch.toLowerCase() : ch.toUpperCase()
      this.buf = this.buf.slice(0, this.cur) + toggled + this.buf.slice(this.cur + 1)
      this.cur = this.clampNormal(this.cur + 1)
      return { type: 'rendered' }
    }

    // u — undo
    if (k === 'u') {
      const state = this.undoStack.pop()
      if (state) { this.buf = state.buf; this.cur = this.clampNormal(state.cur) }
      return { type: 'rendered' }
    }

    // v — enter visual mode
    if (k === 'v') {
      this.visualAnchor = this.cur
      this.setMode('visual')
      return { type: 'rendered' }
    }

    // f / F / t / T — char-find motions (wait for target char)
    if (k === 'f' || k === 'F' || k === 't' || k === 'T') {
      this.pendingMotion = k as PendingMotion
      return { type: 'none' }
    }

    // ; — repeat last f/F/t/T
    if (k === ';') {
      if (!this.lastFT) return { type: 'none' }
      const { type, ch } = this.lastFT
      const forward   = type === 'f' || type === 't'
      const inclusive = type === 'f' || type === 'F'
      this.cur = this.repeatFind(ch, forward, inclusive)
      return { type: 'rendered' }
    }

    // , — repeat last f/F/t/T in reverse direction
    if (k === ',') {
      if (!this.lastFT) return { type: 'none' }
      const { type, ch } = this.lastFT
      const forward   = type === 'F' || type === 'T'   // reversed
      const inclusive = type === 'f' || type === 'F'
      this.cur = this.repeatFind(ch, forward, inclusive)
      return { type: 'rendered' }
    }

    return { type: 'none' }
  }

  // ── visual mode ────────────────────────────────────────────────────────────

  private handleVisual(ev: KeyboardEvent): InputAction {
    const k = ev.key

    // Extend selection with motions
    if (k === 'h')           { this.cur = this.clampNormal(this.cur - 1);   return { type: 'rendered' } }
    if (k === 'l')           { this.cur = this.clampNormal(this.cur + 1);   return { type: 'rendered' } }
    if (k === '0' || k === '^') { this.cur = 0;                             return { type: 'rendered' } }
    if (k === '$')           { this.cur = Math.max(0, this.buf.length - 1); return { type: 'rendered' } }
    if (k === 'w')           { this.cur = this.wordForward();                return { type: 'rendered' } }
    if (k === 'b')           { this.cur = this.wordBack();                   return { type: 'rendered' } }
    if (k === 'e')           { this.cur = this.wordEnd();                    return { type: 'rendered' } }
    if (k === 'ArrowLeft')   { this.cur = this.clampNormal(this.cur - 1);   return { type: 'rendered' } }
    if (k === 'ArrowRight')  { this.cur = this.clampNormal(this.cur + 1);   return { type: 'rendered' } }

    // Operators on selection
    if (k === 'd' || k === 'x') {
      const [lo, hi] = this.visualRange()
      this.execOp('d', lo, hi)
      this.setMode('normal')
      return { type: 'rendered' }
    }
    if (k === 'c') {
      const [lo, hi] = this.visualRange()
      this.execOp('c', lo, hi)   // sets mode to insert internally
      return { type: 'rendered' }
    }
    if (k === 'y') {
      const [lo, hi] = this.visualRange()
      this.yank = this.buf.slice(lo, hi + 1)
      this.cur  = lo
      this.setMode('normal')
      return { type: 'rendered' }
    }

    // ~ — toggle case of selection
    if (k === '~') {
      const [lo, hi] = this.visualRange()
      this.saveUndo()
      const toggled = this.buf.slice(lo, hi + 1)
        .split('')
        .map(ch => ch === ch.toUpperCase() ? ch.toLowerCase() : ch.toUpperCase())
        .join('')
      this.buf = this.buf.slice(0, lo) + toggled + this.buf.slice(hi + 1)
      this.cur = lo
      this.setMode('normal')
      return { type: 'rendered' }
    }

    return { type: 'none' }
  }

  // ── insert mode ────────────────────────────────────────────────────────────

  private handleInsert(ev: KeyboardEvent): InputAction {
    const k = ev.key

    if (k === 'Backspace') {
      if (this.cur === 0) return { type: 'none' }
      this.buf = this.buf.slice(0, this.cur - 1) + this.buf.slice(this.cur)
      this.cur--
      return { type: 'rendered' }
    }

    // Arrow navigation stays in insert mode
    if (k === 'ArrowLeft')  { this.cur = this.clampInsert(this.cur - 1);  return { type: 'rendered' } }
    if (k === 'ArrowRight') { this.cur = this.clampInsert(this.cur + 1);  return { type: 'rendered' } }
    if (k === 'ArrowUp')    return { type: 'history', dir: 'up' }
    if (k === 'ArrowDown')  return { type: 'history', dir: 'down' }
    if (k === 'Home')       { this.cur = 0;               return { type: 'rendered' } }
    if (k === 'End')        { this.cur = this.buf.length;  return { type: 'rendered' } }

    // Ctrl+W — delete word back
    if (ev.ctrlKey && k === 'w') {
      const dest = this.wordBack()
      this.buf = this.buf.slice(0, dest) + this.buf.slice(this.cur)
      this.cur = dest
      return { type: 'rendered' }
    }

    // Ctrl+U — delete to start of line
    if (ev.ctrlKey && k === 'u') {
      this.buf = this.buf.slice(this.cur)
      this.cur = 0
      return { type: 'rendered' }
    }

    // Printable character — insert at cursor
    if (k.length === 1 && !ev.ctrlKey && !ev.altKey && !ev.metaKey) {
      this.buf = this.buf.slice(0, this.cur) + k + this.buf.slice(this.cur)
      this.cur++
      return { type: 'rendered' }
    }

    return { type: 'none' }
  }
}
