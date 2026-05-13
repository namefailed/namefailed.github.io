# Architecture

Personal portfolio site built as an in-browser fake desktop environment. TypeScript throughout, Vite for bundling, no framework. All state persists to `localStorage`.

## Entry Points

| File | Purpose |
|------|---------|
| `index.html` | Desktop shell — CRT monitor frame, YASB status bar, launcher overlay, tiling panes, floating dock |
| `static/index.html` | Brochure page — same portfolio content, no OS chrome. Mobile auto-redirects here (viewport ≤ 768px) |
| `src/main.ts` | Vite entry: imports CSS, calls `bootstrapShellUi()` |
| `src/bootstrap-shell.ts` | Startup sequence: theme → sound → Desktop → TerminalApp → Matrix rain. Order matters |
| `src/static/main.ts` | Brochure entry: mounts banner, hero, sections, scroll-spy, animations |

## Module Layers

### Core Shell
| Module | Responsibility |
|--------|----------------|
| `desktop.ts` | Tiling window manager, dock, launcher overlay, focus management, Ctrl+chord keyboard handling |
| `terminal.ts` | xterm.js façade, scripted boot lines, Vim-style prompt, command dispatch |
| `bootstrap-shell.ts` | Boot sequence orchestration |

### Window Tiles (`*-window.ts`)
Each tile is self-contained with close/minimize/maximize/focus callbacks. All lazy-loaded except `appwindow.ts`.

| Module | Type | Notes |
|--------|------|-------|
| `appwindow.ts` | Content | Read-only portfolio tiles (resume, projects, contact, about) |
| `editor-window.ts` | Editor | Vim-mode text editor over VFS |
| `file-explorer-window.ts` | Explorer | File browser with cut/copy/paste/delete |
| `browser-window.ts` | Browser | Iframe embed with URL bar, bookmarks |
| `paint-window.ts` | Canvas | Pixel canvas with brush, eraser, fill |
| `pong-window.ts` | Game | Pong vs CPU or P2 |
| `snake-window.ts` | Game | Snake with powerups |
| `rubik-window.ts` | Game | **Disabled** — rotation math needs fixing |

### Shared Utilities
| Module | Purpose |
|--------|---------|
| `storage.ts` | **NEW** — Safe localStorage wrapper with JSON helpers, error handling for private mode |
| `window-chrome.ts` | **NEW** — Shared window titlebar factory eliminates duplication across tiles |
| `splitter.ts` | Drag-to-resize handle for horizontal/vertical splits |
| `theme.ts` / `theme-control.ts` / `theme-packs.ts` | Theme system — CSS custom properties, xterm palettes, matrix rain colors |
| `ansi.ts` | ANSI-to-HTML conversion for rendering terminal output |
| `matrix-bg.ts` | Canvas matrix rain animation with visibility pause optimization |
| `retro-fx.ts` | CRT scanlines and vignette toggle |
| `vim.ts` | Vim-style line editor — insert/normal/visual modes, operators, motions |

### Fake OS Layer (`os-*.ts`)
| Module | Purpose |
|--------|---------|
| `os-fs.ts` | Virtual filesystem backed by `localStorage`. Debounced saves (150ms) |
| `os-sound.ts` | Web Audio API for UI sound effects |
| `os-systray.ts` | Toast notifications, settings panel |
| `os-registry.ts` | Shared ref for shell commands → Desktop (prevents circular imports) |
| `os-apt.ts` | `apt install` joke command |
| `os-packages.ts` | `cowsay` package simulation |

### Commands (`commands/`)
| File | Purpose |
|------|---------|
| `index.ts` | Keyword-to-handler registry |
| `help-output.ts` | Help screen rendering |
| `cli-text-utils.ts` | Fake Unix commands (`cal`, `uptime`, `wc`, etc.) |
| `cli-fortunes.ts` | Echo flavor text |
| `types.ts` | `Command` interface |

### Content (`content/`)
| File | Purpose |
|------|---------|
| `copy/resume-copy.ts` | Resume text, skill matrix data |
| `copy/about-copy.ts` | `whoami` output, neofetch column |
| `copy/contact-copy.ts` | Contact tile content |
| `copy/projects-catalog.ts` | Project listings |
| `portfolio.ts` | Re-exports for backward compatibility |

### Static Site (`src/static/`)
| File | Purpose |
|------|---------|
| `main.ts` | Brochure page mount — progress bar, scroll-spy, typewriter, animated counters |
| `static-data.ts` | Single source of truth for profile, contact, skills, experience |
| `static.css` | Standalone stylesheet using `--plain-*` tokens (not `--th-*`) |

## Testing

Tests are in `*.test.ts` files alongside the modules they test.

| Test File | Coverage |
|-----------|----------|
| `os-fs.test.ts` | 57 tests — virtual filesystem operations |
| `storage.test.ts` | 20 tests — localStorage wrapper, JSON serialization |
| `vim.test.ts` | 36 tests — vim input: modes, motions, operators, undo |
| `window-chrome.test.ts` | 8 tests — window chrome factory |
| `browser-url.test.ts` | 5 tests — URL normalization |
| `cli-text-utils.test.ts` | 21 tests — `cal`, `wc`, human-readable bytes |
| `ansi.test.ts` | 24 tests — ANSI-to-HTML conversion |

Run tests: `npm test`

## Naming Conventions

- **Storage/Init**: `initXFromStorage` — reads and applies persisted state once at boot
- **Window Contract**: `openWindow` / `WindowSpec` — contract between terminal and desktop tiles
- **Tile Suffix**: `*-window.ts` — self-contained tile. If it doesn't end in `-window.ts`, it isn't a tile.
- **OS Prefix**: `os-*.ts` — fake OS layer modules
- **Verb-First**: `runShellHelp`, `renderKeybindsLegend`, `playOsSound`, `pushToast`
- **Private Methods**: `handleKey()`, `syncDom()` — private methods don't use `_` prefix (class-based privacy)

## Key Patterns

### Storage Utility (storage.ts)
Replace all direct `localStorage` access with:
```typescript
import { storageGet, storageSet, storageGetJson, storageSetJson, storageGetBool } from './storage'

storageSet('key', 'value')           // Returns boolean success
storageGetJson<Config>('key', {})    // Returns fallback on error
storageGetBool('key', true)          // Parses '1'/'0' strings
```

### Window Chrome (window-chrome.ts)
Replace duplicated titlebar HTML with:
```typescript
import { createWindowChrome } from './window-chrome'

const { el, titlebar, titleEl, btnClose, btnMin, btnMax } = createWindowChrome({
  title: 'Window Title',
  onClose: () => {},
  onMinimize: () => {},
  onMaximize: () => {},
  onFocus: () => {},
})
```

### Theme System
Themes are self-contained `ThemePack` objects in `theme-packs.ts`. Adding a theme requires no other file changes — the picker and `theme` command auto-detect.

## Build & Deploy

```bash
npm install
npm run dev        # Vite dev server — desktop at /, brochure at /static/
npm run build      # tsc && vite build → dist/ and dist/static/
npm test           # Vitest
npm run preview    # Preview dist/ locally
```

Deploy publishes `dist/` to GitHub Pages via Actions (`.github/workflows/deploy-pages.yml`).

## State Persistence

All state stored in `localStorage`:
- `portfolio-vfs-v3-namefailed-home` — VFS tree and cwd
- `mrgrey-theme` — selected theme id
- `mrgrey-os-sound` / `mrgrey-os-volume` — sound settings
- `mrgrey-retro-fx` — CRT toggle
- `mrgrey-matrix-bg` — matrix rain toggle
- `mrgrey-browser-iframe-tip-dismiss` — browser tip dismissal
- `portfolio-fe-prefs-v1` — file explorer preferences

No backend required.

## Layers

**`content/`**  
Portfolio copy. Long text lives under `content/copy/` (`resume-copy.ts`, `about-copy.ts`, `contact-copy.ts`, `projects-catalog.ts`). `portfolio.ts` re-exports everything so older import paths keep working. ANSI helper functions that belong to copy — not to the shell — live in `copy/ansi-widgets.ts`.

**`commands/`**  
`index.ts` is the keyword-to-handler map the terminal reads. Everything else is split out: `help-output.ts` for all help rendering, `cli-text-utils.ts` for the fake Unix commands, `cli-fortunes.ts` for the echo flavor text, `types.ts` for the `Command` interface.

**`desktop.ts` + `launcher-catalog.ts`**  
`desktop.ts` owns the tiling layout, dock, launcher overlay, focus, minimize/maximize, and all Ctrl-chord keyboard handling (Ctrl+H/L/K/J for vim-style window navigation). `launcher-catalog.ts` holds the grid definitions and dock membership so `desktop.ts` doesn't turn into a JSON dump.

**`*-window.ts`**  
One file per tile type: `appwindow.ts` (read-only portfolio content), `editor-window.ts`, `file-explorer-window.ts`, `browser-window.ts`, `paint-window.ts`, `rubik-window.ts`, `snake-window.ts`, `pong-window.ts`. Each takes close/minimize/maximize/focus callbacks so `desktop.ts` doesn't import their internals. All tile types except `appwindow.ts` are lazy-loaded on first open.

> **Note:** `rubik-window.ts` is bundled but the cube tile is disabled in `launcher-catalog.ts` pending a geometry/rotation math fix.

**`os-*.ts`**  
The fake OS layer. `os-fs.ts` is a virtual filesystem backed by `localStorage` — key `portfolio-vfs-v3-namefailed-home` (bumping the version forces fresh default trees for returning visitors). `os-apt.ts` is an `apt install` joke. `os-packages.ts` has cowsay. `os-sound.ts` wraps Web Audio API. `os-systray.ts` manages toasts and the settings panel. `os-registry.ts` is a small shared ref so shell commands can call into `Desktop` without creating a circular import.

**`theme-control.ts` + `theme-packs.ts`**  
Theme packs define CSS custom properties (`--th-*`), xterm palette, and matrix rain colors as a unit. `theme-control.ts` applies them to the document root and saves the selection. The YASB settings panel and the `theme` shell command both call into this.

**`matrix-bg.ts`** — Animated canvas behind the tiling area.  
**`retro-fx.ts`** — CRT scanlines and vignette, toggled from the settings panel.  
**`vim.ts`** — Full vim-style line editor: insert/normal/visual modes, operators, word motions. Used only by `terminal.ts`.  
**`splitter.ts`** — Drag-to-resize handle. Used for the horizontal split between terminal and right pane, and for vertical splits between stacked content windows.

## Static site (`src/static/`)

The brochure page is its own self-contained mini-app under `src/static/`:

- **`static-data.ts`** — Single source of truth for profile, contact, skills, experience, education, and certs. Consumed by `main.ts`. Projects render from `content/portfolio.ts` via `plainProjectsFromPortfolio()`.
- **`main.ts`** — Mounts the full page in JS: banner, hero, sections, footer, section nav. Key features:
  - `mountProgressBar()` — fixed scroll-progress bar at the top
  - `statsStrip()` + `animateCounter()` — "9+ years / 15+ projects / 3 industries" counters that animate in on first intersection
  - `typewriter()` — headline typed in character-by-character after a 750ms fade-in delay
  - `experienceCard()` — reads `entry.type` for inset colour strip; `entry.featured` for the "Featured" badge
  - `buildSectionNav()` + `mountScrollSpy()` — floating right-side dot nav with tooltip labels; highlights the active section via IntersectionObserver
  - `mountScrollCue()` — bouncing `↓` arrow that disappears after 80px of scroll
  - All animated elements carry `data-anim`; `observeAnimations()` adds `is-visible` on first intersection
- **`static.css`** — Standalone stylesheet; does not import `--th-*` tokens. Uses `--plain-*` properties scoped to the brochure page.

## Naming conventions

- `initXFromStorage` — reads and applies persisted state, called once at boot.
- `openWindow` / `WindowSpec` — the contract between terminal commands and the desktop tile system.
- `*-window.ts` — a self-contained tile. If it doesn't end in `-window.ts`, it isn't a tile.
- Verb-first elsewhere: `runShellHelp`, `renderKeybindsLegend`, `playOsSound`, `pushToast`.

## Getting started

```
npm install
npm run dev
```

`npm run build` runs `tsc` then `vite build`. Both HTML entries compile to `dist/`. No backend — all persisted state is `localStorage` (VFS, theme, CRT, matrix, sound).

Tests: `npm test` runs Vitest on `*.test.ts` files. Coverage is thin — `npm run build` passing is the main sanity check for now.
