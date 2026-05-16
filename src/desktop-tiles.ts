/**
 * Populated desktop with two zones (Portfolio · Tools & Fun).
 * Tiles are draggable, snap-to-grid; positions persist to localStorage.
 */

export const ZONE_PORTFOLIO = 'portfolio' as const
export const ZONE_TOOLS = 'tools' as const
export type TileZone = typeof ZONE_PORTFOLIO | typeof ZONE_TOOLS

export interface DesktopTile {
  cmd: string
  label: string
  glyph: string
  zone: TileZone
  /** Optional accent class: 'fun' uses teal glyph */
  accent?: 'fun'
}

const TILES: DesktopTile[] = [
  // Portfolio (top zone)
  { cmd: 'resume',   label: 'Resume',   glyph: 'R',  zone: ZONE_PORTFOLIO },
  { cmd: 'projects', label: 'Projects', glyph: '{}', zone: ZONE_PORTFOLIO },
  { cmd: 'whoami',   label: 'About',    glyph: '☺',  zone: ZONE_PORTFOLIO },
  { cmd: 'links',    label: 'Contact',  glyph: '✉',  zone: ZONE_PORTFOLIO },
  // Tools & Fun (bottom zone)
  { cmd: 'terminal', label: 'Terminal', glyph: '~',  zone: ZONE_TOOLS },
  { cmd: 'explorer', label: 'Files',    glyph: '▣',  zone: ZONE_TOOLS },
  { cmd: 'edit',     label: 'Editor',   glyph: 'E',  zone: ZONE_TOOLS },
  { cmd: 'paint',    label: 'Paint',    glyph: '◐',  zone: ZONE_TOOLS, accent: 'fun' },
  { cmd: 'snake',    label: 'Snake',    glyph: '≈',  zone: ZONE_TOOLS, accent: 'fun' },
]

/** Returns the tiles that should render on the desktop. */
export function visibleDesktopTiles(): readonly DesktopTile[] {
  return TILES
}

export const GRID_CELL = 80

export function snapToGrid(coord: number): number {
  if (coord <= 0) return 0
  return Math.round(coord / GRID_CELL) * GRID_CELL
}

export interface TilePosition {
  x: number
  y: number
}

export type TileLayout = Record<string, TilePosition>

/** Default desktop arrangement on first visit. */
export function defaultTileLayout(): TileLayout {
  const PAD_X = GRID_CELL          // 80px from left
  const PORTFOLIO_Y = GRID_CELL    // 80px from top (under YASB bar)
  const TOOLS_Y = GRID_CELL * 3    // 240px — leaves gap for "zone label" feel
  const STEP = GRID_CELL + 16

  const out: TileLayout = {}
  const tiles = visibleDesktopTiles()

  let pi = 0, ti = 0
  for (const tile of tiles) {
    if (tile.zone === ZONE_PORTFOLIO) {
      out[tile.cmd] = { x: PAD_X + pi * STEP, y: PORTFOLIO_Y }
      pi++
    } else {
      out[tile.cmd] = { x: PAD_X + ti * STEP, y: TOOLS_Y }
      ti++
    }
  }
  return out
}

export const TILE_POSITIONS_KEY = 'mrgrey-desktop-tile-positions'

export function loadTileLayout(): TileLayout {
  const defaults = defaultTileLayout()
  const raw = window.localStorage.getItem(TILE_POSITIONS_KEY)
  if (!raw) return defaults
  try {
    const parsed = JSON.parse(raw) as Record<string, TilePosition>
    const merged: TileLayout = {}
    for (const key of Object.keys(defaults)) {
      merged[key] = parsed[key] ?? defaults[key]
    }
    return merged
  } catch {
    return defaults
  }
}

export function saveTileLayout(layout: TileLayout): void {
  window.localStorage.setItem(TILE_POSITIONS_KEY, JSON.stringify(layout))
}

export function resetTileLayout(): void {
  window.localStorage.removeItem(TILE_POSITIONS_KEY)
}
