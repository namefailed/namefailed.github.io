/**
 * Binary-space-partition tiling layout.
 *
 * Two-column layout.  Windows alternate left → right → left … and stack
 * vertically within each column (up to three per side):
 *
 *   W1 → left   W2 → right   W3 → left   W4 → right   W5 → left   W6 → right
 *
 * Visually for six windows:
 *
 *   ┌─────────┬─────────┐
 *   │   W1    │   W2    │
 *   ├─────────┼─────────┤
 *   │   W3    │   W4    │
 *   ├─────────┼─────────┤
 *   │   W5    │   W6    │
 *   └─────────┴─────────┘
 *
 * Within-column windows are separated by a drag handle that lets the user
 * adjust the vertical split ratio.
 *
 * All splitter minimum constraints are derived from live container dimensions
 * at the time each Splitter is constructed, so the layout scales naturally
 * from compact laptop screens to ultra-wide monitors.
 *
 * Windows are never moved in the DOM after placement so iframe-backed windows
 * (p5, browse) never reload.
 */

import { Splitter } from './splitter'
import type { WindowLayout } from './window-layout'

/** Max stacked windows per column (3 tall × 2 wide). */
export const BSP_MAX_PER_COLUMN = 3

export class BspLayout implements WindowLayout {
  /** Stable identifier consumed by settings persistence and terminal commands. */
  readonly name = 'bsp'

  /**
   * At most 6 windows are simultaneously visible (3 per column).
   * Desktop bumps the oldest window to the minimized dock once this cap is reached.
   */
  readonly maxVisible = BSP_MAX_PER_COLUMN * 2

  private rightPane:   HTMLElement
  private colA:        HTMLElement | null = null
  private colB:        HTMLElement | null = null
  private colSplitter: HTMLElement | null = null

  constructor(rightPane: HTMLElement) {
    this.rightPane = rightPane
  }

  // ── WindowLayout contract ──────────────────────────────────────────────────

  /**
   * Place `el` in the correct BSP column.
   *
   * `alreadyTiled` is `windows.length` **before** the caller pushes the new
   * window.  Column routing uses strict open-index alternation (left/right)
   * with spillover when a column hits {@link BSP_MAX_PER_COLUMN}.
   * A within-column drag handle is inserted between the existing window and
   * the new one when the column already contains a window.
   */
  mount(el: HTMLElement, alreadyTiled: number): void {
    const colEl = this.resolveCol(alreadyTiled)
    const existing = [...colEl.querySelectorAll<HTMLElement>(':scope > .content-window')]

    if (existing.length > 0) {
      // Insert a vertical drag handle between the existing window and the new one
      const hSplitter = document.createElement('div')
      hSplitter.className = 'splitter splitter-bsp-h'
      colEl.appendChild(hSplitter)
      const target = existing[existing.length - 1]
      const minPx  = this.minRowPx(colEl)
      new Splitter({
        el:          hSplitter,
        orientation: 'v',
        target,
        container:   colEl,
        min:         minPx,
        max:         () => Math.max(minPx, colEl.clientHeight - minPx),
      })
    }

    colEl.appendChild(el)
  }

  /**
   * Rebuild within-column drag handles from the current live DOM state.
   *
   * Called after a window is closed, minimized, or restored so splitters stay
   * in sync with the actual column contents.  Empty columns are pruned and the
   * inter-column splitter is removed when only one column remains.
   *
   * `tiledEls` is the ordered list supplied by Desktop — accepted per the
   * interface contract but unused here since the DOM already encodes which
   * elements belong to which column.
   */
  rebuild(_tiledEls: readonly HTMLElement[]): void {
    for (const side of ['a', 'b'] as const) {
      const colEl = side === 'a' ? this.colA : this.colB
      if (!colEl) continue

      // Tear out stale drag handles before rebuilding
      colEl.querySelectorAll('.splitter-bsp-h').forEach(el => el.remove())

      const wins = [
        ...colEl.querySelectorAll<HTMLElement>(':scope > .content-window'),
      ]

      if (wins.length === 0) {
        // Prune the empty column and, if applicable, the inter-column splitter
        this.colSplitter?.remove()
        this.colSplitter = null
        colEl.remove()
        if (side === 'a') this.colA = null
        else              this.colB = null
        continue
      }

      if (wins.length === 1) {
        // Single window fills the column — clear any leftover inline sizing
        wins[0].style.height = ''
        wins[0].style.flex   = ''
        continue
      }

      // Wire a drag handle between each consecutive pair
      const minPx = this.minRowPx(colEl)
      for (let i = 0; i < wins.length - 1; i++) {
        const hSplitter = document.createElement('div')
        hSplitter.className = 'splitter splitter-bsp-h'
        wins[i].insertAdjacentElement('afterend', hSplitter)
        new Splitter({
          el:          hSplitter,
          orientation: 'v',
          target:      wins[i],
          container:   colEl,
          min:         minPx,
          max:         () => Math.max(minPx, colEl.clientHeight - minPx),
        })
      }
    }
  }

  /**
   * Remove all layout-owned DOM from the right pane.
   * Desktop guarantees all window elements are already removed before calling this.
   */
  destroy(): void {
    this.colSplitter?.remove()
    this.colA?.remove()
    this.colB?.remove()
    this.colSplitter = null
    this.colA        = null
    this.colB        = null
  }

  // ── private helpers ────────────────────────────────────────────────────────

  /**
   * Minimum window height for within-column splitter drags.
   * 15 % of current column height, floored at 60 px.
   */
  private minRowPx(colEl: HTMLElement): number {
    return Math.max(60, colEl.clientHeight * 0.15)
  }

  /**
   * Minimum column width for the inter-column splitter.
   * 20 % of right-pane width, floored at 160 px.
   */
  private minColPx(): number {
    return Math.max(160, this.rightPane.clientWidth * 0.2)
  }

  /**
   * Route the incoming window to a column by strict open-order alternation
   * (even index → left, odd → right), stacking vertically under prior windows
   * in that column.  If the preferred column already holds {@link BSP_MAX_PER_COLUMN}
   * windows, the spill column is used when it has room.
   */
  private resolveCol(alreadyTiled: number): HTMLElement {
    const preferA = alreadyTiled % 2 === 0
    const aCount = this.colWindowCount(this.colA)
    const bCount = this.colWindowCount(this.colB)

    const pickA = (): HTMLElement => {
      if (!this.colA) {
        this.colA = document.createElement('div')
        this.colA.className = 'bsp-col'
        if (this.colSplitter) {
          this.rightPane.insertBefore(this.colA, this.colSplitter)
        } else {
          this.rightPane.prepend(this.colA)
        }
      }
      return this.colA
    }

    if (preferA) {
      if (aCount < BSP_MAX_PER_COLUMN) return pickA()
      if (bCount < BSP_MAX_PER_COLUMN) {
        if (!this.colB) this.createColB()
        return this.colB!
      }
      return pickA()
    }

    if (bCount < BSP_MAX_PER_COLUMN) {
      if (!this.colB) this.createColB()
      return this.colB!
    }
    if (aCount < BSP_MAX_PER_COLUMN) return pickA()
    if (!this.colB) this.createColB()
    return this.colB!
  }

  private colWindowCount(col: HTMLElement | null): number {
    if (!col) return 0
    return col.querySelectorAll<HTMLElement>(':scope > .content-window').length
  }

  /** Create col-b and the inter-column vertical drag handle. */
  private createColB(): void {
    this.colSplitter = document.createElement('div')
    this.colSplitter.className = 'splitter splitter-v'
    this.rightPane.appendChild(this.colSplitter)

    this.colB = document.createElement('div')
    this.colB.className = 'bsp-col'
    this.rightPane.appendChild(this.colB)

    const minPx = this.minColPx()
    new Splitter({
      el:          this.colSplitter,
      orientation: 'h',
      target:      this.colA!,
      container:   this.rightPane,
      min:         minPx,
      max:         () => Math.max(minPx, this.rightPane.clientWidth - minPx),
    })
  }
}
