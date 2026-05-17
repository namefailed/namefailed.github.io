/**
 * Populated desktop with two zones (Portfolio · Tools & Fun).
 * Tiles are draggable, snap-to-grid; positions persist to localStorage.
 * Game tiles (paint, snake, pong, cube, p5) live inside a "Games" folder tile.
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
  { cmd: 'browse',   label: 'Browser',  glyph: 'w',  zone: ZONE_TOOLS },
  { cmd: 'paint',    label: 'Paint',    glyph: '◐',  zone: ZONE_TOOLS, accent: 'fun' },
  { cmd: 'snake',    label: 'Snake',    glyph: '≈',  zone: ZONE_TOOLS, accent: 'fun' },
  { cmd: 'pong',     label: 'Pong',     glyph: '◎',  zone: ZONE_TOOLS, accent: 'fun' },
  { cmd: 'p5',       label: 'p5.js',    glyph: 'p5', zone: ZONE_TOOLS, accent: 'fun' },
]

/** Portfolio content tiles (résumé, projects, about, contact). */
export const PORTFOLIO_CMDS: ReadonlySet<string> = new Set(['resume', 'projects', 'whoami', 'links'])

/** Games/fun tiles that live inside the Apps folder. */
export const GAME_CMDS: ReadonlySet<string> = new Set(['paint', 'snake', 'pong', 'p5'])

/** All 12 tile definitions — used for persistence / tests. */
export function visibleDesktopTiles(): readonly DesktopTile[] {
  return TILES
}

/** All tiles live in folders — no standalone desktop icons. */
export function standaloneDesktopTiles(): readonly DesktopTile[] {
  return []
}

/** Tiles inside the Portfolio folder (résumé, projects, about, contact). */
export function portfolioFolderTiles(): readonly DesktopTile[] {
  return TILES.filter(t => PORTFOLIO_CMDS.has(t.cmd))
}

/** Tiles inside the Apps folder (tools + games — everything non-portfolio). */
export function appsFolderTiles(): readonly DesktopTile[] {
  return TILES.filter(t => !PORTFOLIO_CMDS.has(t.cmd))
}

/** Games subset of the Apps folder (paint, snake, pong, p5). */
export function gameFolderTiles(): readonly DesktopTile[] {
  return TILES.filter(t => GAME_CMDS.has(t.cmd))
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

/** Default desktop arrangement — two folders side by side, top-left anchored. */
export function defaultTileLayout(): TileLayout {
  const STEP     = GRID_CELL + 16   // 96 px per tile
  const YASB_H   = 42
  const MARGIN_X = 40               // gap from left edge
  const MARGIN_Y = YASB_H + 20     // gap below YASB bar

  return {
    'portfolio-folder': { x: MARGIN_X,          y: MARGIN_Y },
    'apps-folder':      { x: MARGIN_X + STEP,   y: MARGIN_Y },
  }
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

export interface MountTilesOptions {
  /** Where to mount tiles — should be a `position: relative` container (e.g. #desktop-workspace). */
  host: HTMLElement
  /** Called when a tile (or a game inside the folder popup) is activated. */
  onActivate: (cmd: string) => void
}

const DRAG_THRESHOLD_PX = 4

/** Render tiles into `host`, wire drag + snap, persist on drop. */
export function mountDesktopTiles(opts: MountTilesOptions): void {
  const layout = loadTileLayout()

  const folderDefs: FolderDef[] = [
    { cmd: 'portfolio-folder', label: 'Portfolio', modifier: 'portfolio', tiles: portfolioFolderTiles() },
    { cmd: 'apps-folder',      label: 'Apps',      modifier: 'fun',       tiles: appsFolderTiles()      },
  ]

  const folderEls: HTMLButtonElement[] = []
  for (const def of folderDefs) {
    const pos = layout[def.cmd] ?? defaultTileLayout()[def.cmd]!
    const el  = createFolderTile(pos, def)
    attachTileDrag(el, def.cmd, () => toggleFolderPopup(el, def, opts.onActivate))
    opts.host.appendChild(el)
    folderEls.push(el)
  }

  // Close popup when clicking outside any folder tile
  document.addEventListener('pointerdown', (e) => {
    const popup = document.body.querySelector<HTMLElement>('.games-folder-popup')
    if (!popup) return
    const inFolder = folderEls.some(f => f.contains(e.target as Node))
    if (!inFolder && !popup.contains(e.target as Node)) popup.remove()
  }, { capture: true })
}

// ── Tile DOM helpers ─────────────────────────────────────────────────────────

interface FolderDef {
  cmd:      string
  label:    string
  modifier: string              // CSS modifier: 'portfolio' | 'fun' etc.
  tiles:    readonly DesktopTile[]
}

function createFolderTile(pos: TilePosition, def: FolderDef): HTMLButtonElement {
  const el = document.createElement('button')
  el.type = 'button'
  el.className = `desktop-tile desktop-tile--folder desktop-tile--${def.modifier}`
  el.dataset.cmd = def.cmd
  el.style.left = `${pos.x}px`
  el.style.top = `${pos.y}px`
  el.title = def.label

  // 2×2 mini-grid preview of up to 4 icons
  const grid = document.createElement('div')
  grid.className = 'folder-tile-grid'
  for (const g of def.tiles.slice(0, 4)) {
    const mini = document.createElement('div')
    mini.className = 'folder-tile-mini'
    mini.textContent = g.glyph
    grid.appendChild(mini)
  }
  el.appendChild(grid)
  el.appendChild(document.createTextNode(def.label))

  return el
}

function toggleFolderPopup(
  anchor: HTMLElement,
  def: FolderDef,
  onActivate: (cmd: string) => void,
): void {
  const existing = document.body.querySelector<HTMLElement>('.games-folder-popup')
  if (existing) {
    const sameFolder = existing.dataset.openedBy === def.cmd
    existing.remove()
    if (sameFolder) return   // clicking the same folder again → just close
  }

  const popup = document.createElement('div')
  popup.className = 'games-folder-popup'
  popup.dataset.openedBy = def.cmd
  popup.setAttribute('role', 'dialog')
  popup.setAttribute('aria-label', def.label)

  const title = document.createElement('div')
  title.className = 'games-folder-popup-title'
  title.textContent = def.label
  popup.appendChild(title)

  const grid = document.createElement('div')
  grid.className = 'games-folder-popup-grid'

  for (const tile of def.tiles) {
    const item = document.createElement('button')
    item.type = 'button'
    item.className = 'games-folder-popup-item'

    const glyph = document.createElement('span')
    glyph.className = 'games-folder-popup-item-glyph'
    glyph.textContent = tile.glyph
    item.appendChild(glyph)

    const lbl = document.createElement('span')
    lbl.className = 'games-folder-popup-item-label'
    lbl.textContent = tile.label
    item.appendChild(lbl)

    item.addEventListener('click', () => {
      popup.remove()
      onActivate(tile.cmd)
    })
    grid.appendChild(item)
  }

  popup.appendChild(grid)

  // Position popup above the anchor tile using fixed coords (avoids scroll offset issues)
  document.body.appendChild(popup)
  const rect = anchor.getBoundingClientRect()
  const pw = popup.offsetWidth || 220
  const ph = popup.offsetHeight || 180
  let left = rect.left + rect.width / 2 - pw / 2
  let top  = rect.top - ph - 10
  // Keep within viewport
  if (left < 8) left = 8
  if (left + pw > window.innerWidth - 8) left = window.innerWidth - pw - 8
  if (top < 8) top = rect.bottom + 10
  popup.style.left = `${left}px`
  popup.style.top  = `${top}px`

  // Keyboard close
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') { popup.remove(); document.removeEventListener('keydown', onKey) }
  }
  document.addEventListener('keydown', onKey)
}

// ── Drag logic ───────────────────────────────────────────────────────────────

function attachTileDrag(
  el: HTMLElement,
  cmd: string,
  onActivate: () => void,
): void {
  let startX = 0, startY = 0
  let origLeft = 0, origTop = 0
  let dragging = false
  let moved = false

  const onMove = (e: PointerEvent): void => {
    const dx = e.clientX - startX
    const dy = e.clientY - startY
    if (!moved && Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX) {
      moved = true
      el.classList.add('desktop-tile--dragging')
    }
    if (moved) {
      el.style.left = `${origLeft + dx}px`
      el.style.top = `${origTop + dy}px`
    }
  }

  const onUp = (e: PointerEvent): void => {
    el.releasePointerCapture(e.pointerId)
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    if (!dragging) return
    dragging = false

    if (moved) {
      const x = snapToGrid(parseFloat(el.style.left))
      const y = snapToGrid(parseFloat(el.style.top))
      el.style.left = `${x}px`
      el.style.top = `${y}px`
      el.classList.remove('desktop-tile--dragging')
      const layout = loadTileLayout()
      layout[cmd] = { x, y }
      saveTileLayout(layout)
    } else {
      onActivate()
    }
    moved = false
  }

  el.addEventListener('pointerdown', e => {
    if (e.button !== 0) return
    dragging = true
    startX = e.clientX
    startY = e.clientY
    origLeft = parseFloat(el.style.left) || 0
    origTop = parseFloat(el.style.top) || 0
    el.setPointerCapture(e.pointerId)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  })
}
