/**
 * Binary-space-partition tiling layout.
 *
 * Two-column layout.  Windows fill columns using a "shorter column first,
 * prefer right on tie" rule so that the open sequence is:
 *
 *   W1 → left   W2 → right   W3 → right   W4 → left   W5 → right   W6 → left …
 *
 * Visually for four windows:
 *
 *   ┌─────────┬─────────┐
 *   │   W1    │   W2    │
 *   ├─────────┼─────────┤
 *   │   W4    │   W3    │
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

export class BspLayout implements WindowLayout {
  /** Stable identifier consumed by settings persistence and terminal commands. */
  readonly name = 'bsp'

  /**
   * At most 4 windows are simultaneously visible (2 per column).
   * Desktop bumps older windows to the minimized dock once this cap is reached.
   */
  readonly maxVisible = 4

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
   * window.  Column routing is delegated to `resolveCol` which uses a
   * "shorter column first, prefer right on tie" rule.
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
   * Route the incoming window to the correct column using a
   * "shorter column first, prefer col-b on tie" rule.
   *
   * This produces the open sequence L R R L R L … so that:
   *  - The first window anchors the left column.
   *  - Each subsequent window fills whichever column is shorter.
   *  - When both columns are equal length the right column is preferred,
   *    so new rows fill right-first then left (matching the user's expectation).
   */
  private resolveCol(alreadyTiled: number): HTMLElement {
    // First window always anchors the left column.
    if (alreadyTiled === 0) {
      if (!this.colA) {
        this.colA = document.createElement('div')
        this.colA.className = 'bsp-col'
        this.rightPane.prepend(this.colA)
      }
      return this.colA
    }

    // Count live content windows in each column.
    const aCount = this.colA
      ? this.colA.querySelectorAll<HTMLElement>(':scope > .content-window').length
      : 0
    const bCount = this.colB
      ? this.colB.querySelectorAll<HTMLElement>(':scope > .content-window').length
      : 0

    // Left column wins only when it is strictly shorter.
    // Equal or right-shorter → right column (col-b wins ties).
    if (aCount < bCount) {
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

    if (!this.colB) this.createColB()
    return this.colB!
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
