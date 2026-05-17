/**
 * Pluggable tiling-layout contract for the right pane.
 *
 * Each implementation manages its own DOM inside `#right-pane` — it places
 * content-window elements into whatever container structure it needs, wires
 * its own splitters, and tears down cleanly so another layout can take over.
 *
 * Desktop calls:
 *   layout.mount(el, windows.length)   — before windows.push()
 *   layout.rebuild(windows.map(w=>w.el)) — after any remove / restore
 *   layout.destroy()                   — on layout switch (future)
 *
 * Adding a new layout
 * ───────────────────
 * 1. Create `src/<name>-layout.ts` implementing `WindowLayout`.
 * 2. Add a factory case in `Desktop.createLayout()` (desktop.ts).
 * 3. Expose switching via a terminal command, settings toggle, or keybind.
 */

export interface WindowLayout {
  /** Stable identifier used for settings persistence and terminal commands. */
  readonly name: string

  /**
   * Upper bound on simultaneously visible tiled windows before the oldest
   * non-focused window is bumped to the minimized dock.
   */
  readonly maxVisible: number

  /**
   * Place `el` in the layout.
   * `alreadyTiled` is `windows.length` *before* `windows.push()` — the
   * position the new window will occupy (0-based).
   * The implementation must NOT push animations; Desktop handles those.
   */
  mount(el: HTMLElement, alreadyTiled: number): void

  /**
   * Rebuild internal splitters / containers after a window was removed or
   * a minimized window was restored.
   * `tiledEls` is the live, ordered list of currently visible window elements
   * after the change has been applied.
   */
  rebuild(tiledEls: readonly HTMLElement[]): void

  /**
   * Remove all layout-owned DOM from the right pane so another layout can
   * take over.  The caller guarantees that all window elements have already
   * been removed from the DOM before `destroy()` is called.
   */
  destroy(): void
}
