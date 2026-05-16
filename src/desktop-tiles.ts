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
