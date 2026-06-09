/**
 * Populated desktop with two zones (Portfolio · Tools & Fun).
 * Tiles are draggable, snap-to-grid; positions persist to localStorage.
 * Game tiles (paint, snake, pong, cube, p5) live inside a "Games" folder tile.
 */

import { storageGet, storageSet, storageRemove } from './storage'
import { computeFolderPopupPosition } from './folder-popup-layout'

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
  { cmd: 'cube',     label: 'Cube',     glyph: '⬡',  zone: ZONE_TOOLS, accent: 'fun' },
  { cmd: 'p5',       label: 'p5.js',    glyph: 'p5', zone: ZONE_TOOLS, accent: 'fun' },
]

/** Portfolio content tiles (résumé, projects, about, contact). */
export const PORTFOLIO_CMDS: ReadonlySet<string> = new Set(['resume', 'projects', 'whoami', 'links'])

/** Games/fun tiles that live inside the Apps folder. */
export const GAME_CMDS: ReadonlySet<string> = new Set(['paint', 'snake', 'pong', 'cube', 'p5'])

/** All 12 tile definitions — used for persistence / tests. */
export function visibleDesktopTiles(): readonly DesktopTile[] {
  return TILES
}

/** All tiles live in folders — no standalone desktop icons. */
export function standaloneDesktopTiles(): readonly DesktopTile[] {
  return []
}

/** Tiles inside the Portfolio folder (résumé, projects, about, contact) — sorted A→Z. */
export function portfolioFolderTiles(): readonly DesktopTile[] {
  return [...TILES.filter(t => PORTFOLIO_CMDS.has(t.cmd))].sort((a, b) =>
    a.label.localeCompare(b.label),
  )
}

/** Tiles inside the Apps folder (tools only — games have their own folder) — sorted A→Z. */
export function appsFolderTiles(): readonly DesktopTile[] {
  return [...TILES.filter(t => !PORTFOLIO_CMDS.has(t.cmd) && !GAME_CMDS.has(t.cmd))].sort(
    (a, b) => a.label.localeCompare(b.label),
  )
}

/** Games subset of the Apps folder (paint, snake, pong, p5) — sorted A→Z. */
export function gameFolderTiles(): readonly DesktopTile[] {
  return [...TILES.filter(t => GAME_CMDS.has(t.cmd))].sort((a, b) =>
    a.label.localeCompare(b.label),
  )
}

// GRID_CELL must equal the tile step (tile-width + gap) so that default positions
// are exact multiples of GRID_CELL.  Tile width = 76px, gap ≈ 20px → step = 96px.
export const GRID_CELL = 96

export function snapToGrid(coord: number): number {
  if (coord <= 0) return 0
  return Math.round(coord / GRID_CELL) * GRID_CELL
}

export interface TilePosition {
  x: number
  y: number
}

export type TileLayout = Record<string, TilePosition>

/** Default desktop arrangement — three folders on the first allowed row.
 *  All positions are exact multiples of GRID_CELL so they survive snap-to-grid. */
export function defaultTileLayout(): TileLayout {
  // x/y = 1 × GRID_CELL — the minimum allowed position after the outer-ring guard.
  return {
    'portfolio-folder': { x: GRID_CELL,     y: GRID_CELL },
    'apps-folder':      { x: GRID_CELL * 2, y: GRID_CELL },
    'games-folder':     { x: GRID_CELL * 3, y: GRID_CELL },
  }
}

// Key bumped to v6 so old saves don't override the updated default positions.
export const TILE_POSITIONS_KEY = 'mrgrey-desktop-tile-positions-v6'

export function loadTileLayout(): TileLayout {
  const defaults = defaultTileLayout()
  const raw = storageGet(TILE_POSITIONS_KEY)
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
  storageSet(TILE_POSITIONS_KEY, JSON.stringify(layout))
}

export function resetTileLayout(): void {
  storageRemove(TILE_POSITIONS_KEY)
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
    { cmd: 'games-folder',     label: 'Games',     modifier: 'games',     tiles: gameFolderTiles()      },
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
    const popup = document.body.querySelector<HTMLElement>('.folder-popup')
    if (!popup) return
    const inFolder = folderEls.some(f => f.contains(e.target as Node))
    if (!inFolder && !popup.contains(e.target as Node)) closeActivePopup()
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

// One popup is open at a time.  Track its keyboard-close controller so the
// listener is always removed regardless of which code path closes the popup.
let popupKeyController: AbortController | null = null

function closeActivePopup(): void {
  document.body.querySelector<HTMLElement>('.folder-popup')?.remove()
  popupKeyController?.abort()
  popupKeyController = null
}

/** Measure after mount, then place above/below based on free space on both sides. */
function positionFolderPopup(anchor: HTMLElement, popup: HTMLElement): void {
  const anchorRect = anchor.getBoundingClientRect()
  const popupRect = popup.getBoundingClientRect()
  const pos = computeFolderPopupPosition(
    {
      left: anchorRect.left,
      top: anchorRect.top,
      right: anchorRect.right,
      bottom: anchorRect.bottom,
      width: anchorRect.width,
      height: anchorRect.height,
    },
    {
      width: popupRect.width || popup.offsetWidth || 220,
      height: popupRect.height || popup.offsetHeight || 180,
    },
    { width: window.innerWidth, height: window.innerHeight },
  )
  popup.dataset.placement = pos.placement
  popup.style.left = `${pos.left}px`
  popup.style.top = `${pos.top}px`
}

function toggleFolderPopup(
  anchor: HTMLElement,
  def: FolderDef,
  onActivate: (cmd: string) => void,
): void {
  const existing = document.body.querySelector<HTMLElement>('.folder-popup')
  if (existing) {
    const sameFolder = existing.dataset.openedBy === def.cmd
    closeActivePopup()
    if (sameFolder) return   // clicking the same folder again → just close
  }

  const popup = document.createElement('div')
  popup.className = 'folder-popup'
  popup.dataset.openedBy = def.cmd
  popup.setAttribute('role', 'dialog')
  popup.setAttribute('aria-label', def.label)

  const title = document.createElement('div')
  title.className = 'folder-popup-title'
  title.textContent = def.label
  popup.appendChild(title)

  const grid = document.createElement('div')
  grid.className = 'folder-popup-grid'

  for (const tile of def.tiles) {
    const item = document.createElement('button')
    item.type = 'button'
    item.className = 'folder-popup-item'

    const glyph = document.createElement('span')
    glyph.className = 'folder-popup-item-glyph'
    glyph.textContent = tile.glyph
    item.appendChild(glyph)

    const lbl = document.createElement('span')
    lbl.className = 'folder-popup-item-label'
    lbl.textContent = tile.label
    item.appendChild(lbl)

    item.addEventListener('click', () => {
      closeActivePopup()
      onActivate(tile.cmd)
    })
    grid.appendChild(item)
  }

  popup.appendChild(grid)

  document.body.appendChild(popup)
  positionFolderPopup(anchor, popup)

  // Keyboard close — AbortController ensures cleanup via any close path
  popupKeyController = new AbortController()
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape') closeActivePopup()
  }, { signal: popupKeyController.signal })
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
      let x = snapToGrid(parseFloat(el.style.left))
      let y = snapToGrid(parseFloat(el.style.top))

      // Clamp: one GRID_CELL margin on every edge — icons can never land in
      // the outer ring of grid cells (top/bottom/left/right border cells).
      const host = el.parentElement ?? document.documentElement
      const elW  = el.offsetWidth  || GRID_CELL
      const elH  = el.offsetHeight || GRID_CELL
      const minX = GRID_CELL
      const minY = GRID_CELL
      const maxX = Math.max(minX, host.clientWidth  - elW - GRID_CELL)
      const maxY = Math.max(minY, host.clientHeight - elH - GRID_CELL)
      x = Math.max(minX, Math.min(x, maxX))
      y = Math.max(minY, Math.min(y, maxY))

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
