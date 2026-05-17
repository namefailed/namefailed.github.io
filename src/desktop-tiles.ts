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

/** Commands that live inside the "Games" folder tile (not rendered individually). */
export const GAME_CMDS: ReadonlySet<string> = new Set(['paint', 'snake', 'pong', 'p5'])

/** All 13 tile definitions — used for persistence / tests. */
export function visibleDesktopTiles(): readonly DesktopTile[] {
  return TILES
}

/** Tiles shown as individual icons on the desktop (games are inside the folder). */
export function standaloneDesktopTiles(): readonly DesktopTile[] {
  return TILES.filter(t => !GAME_CMDS.has(t.cmd))
}

/** Tiles that live inside the Games folder popup. */
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

/** Default desktop arrangement on first visit — top-left anchored. */
export function defaultTileLayout(): TileLayout {
  const STEP     = GRID_CELL + 16   // 96 px per tile
  const YASB_H   = 42
  const MARGIN_X = 40               // gap from left edge
  const MARGIN_Y = YASB_H + 20     // gap below YASB bar

  const portfolioY = MARGIN_Y
  const toolsY     = portfolioY + STEP + 20

  const out: TileLayout = {}
  const standalone = standaloneDesktopTiles()

  let pi = 0, ti = 0
  for (const tile of standalone) {
    if (tile.zone === ZONE_PORTFOLIO) {
      out[tile.cmd] = { x: MARGIN_X + pi * STEP, y: portfolioY }
      pi++
    } else {
      out[tile.cmd] = { x: MARGIN_X + ti * STEP, y: toolsY }
      ti++
    }
  }

  // Games folder sits after the standalone tool tiles
  out['games-folder'] = { x: MARGIN_X + ti * STEP, y: toolsY }

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
  const standalone = standaloneDesktopTiles()

  // Individual standalone tiles
  for (const tile of standalone) {
    const el = createTileButton(tile, layout[tile.cmd])
    const cmd = tile.cmd
    attachTileDrag(el, cmd, () => opts.onActivate(cmd))
    opts.host.appendChild(el)
  }

  // Games folder tile
  const folderEl = createFolderTile(layout['games-folder'])
  attachTileDrag(folderEl, 'games-folder', () => {
    toggleGamesPopup(folderEl, opts.onActivate)
  })
  opts.host.appendChild(folderEl)

  // Close popup on outside click
  document.addEventListener('pointerdown', (e) => {
    const popup = document.body.querySelector<HTMLElement>('.games-folder-popup')
    if (!popup) return
    if (!popup.contains(e.target as Node) && !folderEl.contains(e.target as Node)) {
      popup.remove()
    }
  }, { capture: true })
}

// ── Tile DOM helpers ─────────────────────────────────────────────────────────

function createTileButton(tile: DesktopTile, pos: TilePosition): HTMLButtonElement {
  const el = document.createElement('button')
  el.type = 'button'
  el.className = [
    'desktop-tile',
    tile.zone === ZONE_PORTFOLIO ? 'desktop-tile--portfolio' : '',
    tile.accent === 'fun' ? 'desktop-tile--fun' : '',
  ].filter(Boolean).join(' ')
  el.dataset.cmd = tile.cmd
  el.style.left = `${pos.x}px`
  el.style.top = `${pos.y}px`

  const glyph = document.createElement('span')
  glyph.className = 'desktop-tile-glyph'
  glyph.textContent = tile.glyph
  el.appendChild(glyph)

  const label = document.createTextNode(tile.label)
  el.appendChild(label)

  return el
}

function createFolderTile(pos: TilePosition): HTMLButtonElement {
  const el = document.createElement('button')
  el.type = 'button'
  el.className = 'desktop-tile desktop-tile--folder desktop-tile--fun'
  el.dataset.cmd = 'games-folder'
  el.style.left = `${pos.x}px`
  el.style.top = `${pos.y}px`
  el.title = 'Games'

  // 2×2 mini-grid preview of game icons
  const grid = document.createElement('div')
  grid.className = 'folder-tile-grid'
  const previews = gameFolderTiles().slice(0, 4)
  for (const g of previews) {
    const mini = document.createElement('div')
    mini.className = 'folder-tile-mini'
    mini.textContent = g.glyph
    grid.appendChild(mini)
  }
  el.appendChild(grid)

  const label = document.createTextNode('Games')
  el.appendChild(label)

  return el
}

function toggleGamesPopup(
  anchor: HTMLElement,
  onActivate: (cmd: string) => void,
): void {
  // Toggle: close if already open
  const existing = document.body.querySelector('.games-folder-popup')
  if (existing) {
    existing.remove()
    return
  }

  const popup = document.createElement('div')
  popup.className = 'games-folder-popup'
  popup.setAttribute('role', 'dialog')
  popup.setAttribute('aria-label', 'Games')

  const title = document.createElement('div')
  title.className = 'games-folder-popup-title'
  title.textContent = 'Games'
  popup.appendChild(title)

  const grid = document.createElement('div')
  grid.className = 'games-folder-popup-grid'

  for (const tile of gameFolderTiles()) {
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
