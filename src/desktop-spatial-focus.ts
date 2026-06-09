/** Vim-style spatial focus between tiled windows (bounding-rect geometry). */

export type SpatialDirection = 'h' | 'j' | 'k' | 'l'

export interface SpatialWindowRect {
  id: string
  rect: { left: number; top: number; width: number; height: number }
}

export type SpatialFocusAction =
  | { type: 'focus'; id: string }
  | { type: 'open-terminal' }
  | { type: 'noop' }

/**
 * Pick the next focus target for Ctrl+H/J/K/L navigation.
 * `focusedId` is the command id of the currently focused tiled window, if any.
 */
export function pickSpatialFocusAction(
  windows: readonly SpatialWindowRect[],
  focusedId: string | null,
  dir: SpatialDirection,
): SpatialFocusAction {
  const focusedWin = focusedId ? windows.find(w => w.id === focusedId) : undefined

  if (!focusedWin) {
    if (dir === 'l' || dir === 'j') {
      const first = windows[0]
      return first ? { type: 'focus', id: first.id } : { type: 'noop' }
    }
    if (dir === 'h') return { type: 'open-terminal' }
    return { type: 'noop' }
  }

  const cr = focusedWin.rect
  const cx = cr.left + cr.width / 2
  const cy = cr.top + cr.height / 2

  let best: SpatialWindowRect | null = null
  let bestDist = Infinity

  for (const win of windows) {
    if (win.id === focusedWin.id) continue
    const r = win.rect
    const wx = r.left + r.width / 2
    const wy = r.top + r.height / 2
    const dx = wx - cx
    const dy = wy - cy

    const valid =
      (dir === 'h' && dx < -20) ||
      (dir === 'l' && dx > 20) ||
      (dir === 'k' && dy < -20) ||
      (dir === 'j' && dy > 20)
    if (!valid) continue

    const dist = Math.hypot(dx, dy)
    if (dist < bestDist) {
      bestDist = dist
      best = win
    }
  }

  if (best) return { type: 'focus', id: best.id }
  if (dir === 'h' && focusedId !== 'terminal') return { type: 'open-terminal' }
  return { type: 'noop' }
}
