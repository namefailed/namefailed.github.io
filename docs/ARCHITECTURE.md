# Architecture

Personal portfolio site built as an in-browser fake desktop environment. TypeScript throughout, Vite for bundling, no framework. All state persists to `localStorage`.

## Entry Points

| File | Purpose |
|------|---------|
| `index.html` | Desktop shell — CRT monitor frame, YASB status bar, launcher overlay, tiling panes, floating dock |
| `static/index.html` | Brochure page — same portfolio content, no OS chrome. Mobile auto-redirects here (viewport ≤ 768px) |
| `src/main.ts` | Vite entry: imports CSS, calls `bootstrapShellUi()` |
| `src/bootstrap-shell.ts` | Startup sequence: boot splash → theme → retro-fx → sound → Desktop → matrix rain. Terminal is a lazy tile, not pre-mounted. |
| `src/static/main.ts` | Brochure entry: mounts banner, hero, sections, scroll-spy, animations |

## Module Layers

### Core Shell
| Module | Responsibility |
|--------|----------------|
| `desktop.ts` | Tiling window manager, dock, launcher overlay, focus management, Ctrl+chord keyboard handling |
| `terminal.ts` | xterm.js façade, scripted boot lines, Vim-style prompt, command dispatch |
| `bootstrap-shell.ts` | Boot sequence orchestration |
| `launcher-catalog.ts` | Launcher grid definitions, dock membership, lazy-chunk prefetch triggers |

### Window Tiles (`*-window.ts`)
Each tile is self-contained with close/minimize/maximize/focus callbacks. All lazy-loaded except `appwindow.ts`. `desktop.ts` uses dynamic `import()` so each module ships in its own chunk.

| Module | Type | Notes |
|--------|------|-------|
| `appwindow.ts` | Content | Read-only portfolio tiles (resume, projects, contact, about) |
| `editor-window.ts` | Editor | Vim-mode text editor over VFS; `F5` / `:run` plays a `.js` file in the p5 viewer |
| `file-explorer-window.ts` | Explorer | File browser with rename/cut/copy/paste/delete; double-click `.js` → p5 viewer |
| `browser-window.ts` | Browser | Iframe embed with URL bar, bookmarks |
| `paint-window.ts` | Canvas | Pixel canvas with brush, eraser, fill |
| `p5-window.ts` | Viewer | Sandboxed p5.js sketch viewer; loads built-in sketches + VFS files |
| `rubik-window.ts` | Game | Interactive 3D Rubik's cube (Three.js); drag to spin, animated scramble/solve, algorithm picker |
| `pong-window.ts` | Game | Pong vs CPU or P2 |
| `snake-window.ts` | Game | Snake with WASD/arrow controls |

Three.js ships exclusively in the `rubik-window` lazy chunk (~139 kB gzipped). It is never in the main bundle.

### Shared Utilities
| Module | Purpose |
|--------|---------|
| `storage.ts` | Safe `localStorage` wrapper with JSON helpers, error handling for private mode |
| `window-chrome.ts` | Shared window titlebar factory — eliminates duplication across tiles |
| `splitter.ts` | Drag-to-resize handle for horizontal/vertical splits |
| `theme.ts` / `theme-control.ts` / `theme-packs.ts` | Theme system — CSS custom properties, xterm palettes, matrix rain colors |
| `ansi.ts` | ANSI-to-HTML conversion for rendering terminal output |
| `ascii.ts` | ASCII art strings used in boot splash and neofetch |
| `boot-splash.ts` | Scripted boot animation lines |
| `hint-bubbles.ts` | Dismissable first-visit hints on desktop folder tiles |
| `intro-toasts.ts` | Auto-dismiss toast notifications on first visit |
| `matrix-bg.ts` | Canvas matrix rain animation with visibility pause optimization |
| `random-pick.ts` | Seeded random / weighted pick utilities |
| `retro-fx.ts` | CRT scanlines and vignette toggle |
| `vim.ts` | Vim-style line editor — insert/normal/visual modes, operators, motions |

### Rubik Model (`rubik-*.ts`)
| Module | Purpose |
|--------|---------|
| `rubik-model.ts` | Pure cube state: face arrays, move functions, scramble generator, canonical algorithms |
| `rubik-stickers-layout.ts` | Three.js geometry helpers: sticker center, animation axis/angle, face outward vector |

### p5.js Sketches
| Module | Purpose |
|--------|---------|
| `p5-sketches.ts` | 8+ built-in p5.js sketch definitions (code as strings); `sketchFilename()` helper |
| `p5-window.ts` | Sandboxed iframe viewer; loads sketches from built-in list or VFS |

Sketches are seeded into `~/sketches/` in the VFS (`os-fs.ts`) at first visit.

### Fake OS Layer (`os-*.ts`)
| Module | Purpose |
|--------|---------|
| `os-fs.ts` | Virtual filesystem backed by `localStorage` key `portfolio-vfs-v8-namefailed-home`. Debounced saves (150ms). Seeds `~/p5.js/` with all p5 examples on first visit |
| `os-sound.ts` | Web Audio API for UI sound effects |
| `os-systray.ts` | Toast notifications, settings panel |
| `os-registry.ts` | Shared ref for shell commands → Desktop (prevents circular imports) |
| `os-apt.ts` | `apt install` joke command |
| `os-packages.ts` | `cowsay` package simulation |

### Commands (`commands/`)
| File | Purpose |
|------|---------|
| `index.ts` | Keyword-to-handler registry (thin merger of sub-registries) |
| `app-commands.ts` | Tile launcher stubs — commands that return `[]` and are intercepted by the desktop layer |
| `vfs-commands.ts` | VFS shell commands: `ls`, `cat`, `cd`, `mkdir`, `rm`, `mv`, `cp`, `touch`, `pwd`, `wc`, `tree` |
| `system-commands.ts` | System-flavour commands: `echo`, `env`, `date`, `whoami`, `neofetch`, `cowsay`, `ssh`, `apt` |
| `help-output.ts` | Help screen rendering |
| `cli-text-utils.ts` | Text utilities: `cal`, `wc`, human-readable bytes |
| `cli-fortunes.ts` | Echo flavor text |
| `types.ts` | `Command` interface |

### Content (`content/`)
| File | Purpose |
|------|---------|
| `copy/resume-copy.ts` | Resume text, skill matrix data |
| `copy/about-copy.ts` | `whoami` output, neofetch column |
| `copy/contact-copy.ts` | Contact tile content |
| `copy/projects-catalog.ts` | Project listings |
| `portfolio.ts` | Assembled ANSI line arrays for each portfolio tile |

### Static Site (`src/static/`)
| File | Purpose |
|------|---------|
| `main.ts` | Brochure page mount — progress bar, scroll-spy, typewriter, animated counters |
| `static-data.ts` | Single source of truth for profile, contact, skills, experience |
| `static.css` | Standalone stylesheet using `--plain-*` tokens (not `--th-*`) |

## Testing

496 tests across 36 test files (plus Playwright smoke e2e). Tests co-located with source: `module.ts` → `module.test.ts`.

| Test File | Coverage |
|-----------|----------|
| `ansi.test.ts` | ANSI-to-HTML conversion |
| `boot-splash.test.ts` | Boot animation line arrays |
| `browser-url.test.ts` | URL normalization |
| `bsp-layout.test.ts` | BSP column routing, splitter placement |
| `commands/cli-text-utils.test.ts` | `cal`, `wc`, human-readable bytes |
| `commands/system-commands.test.ts` | System-flavour shell commands |
| `commands/vfs-commands.test.ts` | VFS shell commands |
| `content/portfolio.test.ts` | Portfolio content assembly |
| `desktop-tiles.test.ts` | Tile layout, drag snap, persistence |
| `desktop.test.ts` | Window manager: focus, keyboard chords, tile limit |
| `desktop-window-spec.test.ts` | Portfolio/tool WindowSpec builders |
| `desktop-spatial-focus.test.ts` | Ctrl+H/J/K/L spatial focus geometry |
| `desktop-launcher-overlay.test.ts` | Launcher overlay flag state machine |
| `folder-popup-layout.test.ts` | Folder popup placement vs viewport edges |
| `live-site-screenshot.test.ts` | mShots preview URL builder |
| `prefers-reduced-motion.test.ts` | Reduced-motion media query probe |
| `static/static-motion.test.ts` | Brochure typewriter/counter + reduced motion |
| `static-portfolio-href.test.ts` | Classic portfolio path resolution |
| `first-visit-flags.test.ts` | First-visit onboarding flags |
| `hint-bubbles.test.ts` | Hint bubble show/dismiss logic |
| `intro-toasts.test.ts` | Toast sequencing |
| `launcher-catalog.test.ts` | Launcher grid, TILED_WINDOW_COMMANDS, prefetch |
| `matrix-bg.test.ts` | Matrix rain canvas logic |
| `os-fs.test.ts` | Virtual filesystem operations |
| `p5-sketches.test.ts` | Sketch definitions, `sketchFilename()` |
| `random-pick.test.ts` | Random/weighted pick |
| `retro-fx.test.ts` | CRT toggle |
| `rubik-model.test.ts` | Cube model: all moves, inverses, scramble, algorithms |
| `rubik-stickers-layout.test.ts` | 3D sticker layout ↔ model move lock |
| `storage.test.ts` | localStorage wrapper, JSON serialization |
| `terminal-motd.test.ts` | MOTD rendering |
| `theme-control.test.ts` | Theme pack apply/persist |
| `vim.test.ts` | Vim input: modes, motions, operators, undo |
| `wallpaper.test.ts` | Wallpaper apply/clear events |
| `window-chrome.test.ts` | Window chrome factory |

Run tests: `npm test` · coverage: `npm run test:coverage` · lint: `npm run lint` · e2e: `npm run test:e2e`

## Stylesheets

Desktop shell CSS lives under `src/styles/` (`section.css` plus `section-2.css` … `section-22.css`). `src/style.css` is an `@import` hub only — regenerate with `node scripts/split-style-css.mjs` after editing the monolith backup if needed.

Brochure styles remain in `src/static/static.css` (`--plain-*` tokens).

## Naming Conventions

- **Storage/Init**: `initXFromStorage` — reads and applies persisted state once at boot
- **Window Contract**: `openWindow` / `WindowSpec` — contract between terminal and desktop tiles
- **Tile Suffix**: `*-window.ts` — self-contained tile. If it doesn't end in `-window.ts`, it isn't a tile.
- **OS Prefix**: `os-*.ts` — fake OS layer modules
- **Verb-First**: `runShellHelp`, `renderKeybindsLegend`, `playOsSound`, `pushToast`
- **Private Methods**: `handleKey()`, `syncDom()` — private methods don't use `_` prefix (class-based privacy)

## Key Patterns

### Window Chrome (window-chrome.ts)
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

### Storage Utility (storage.ts)
```typescript
import { storageGet, storageSet, storageGetJson, storageSetJson, storageGetBool } from './storage'

storageSet('key', 'value')           // Returns boolean success
storageGetJson<Config>('key', {})    // Returns fallback on error
storageGetBool('key', true)          // Parses '1'/'0' strings
```

### Lazy Window Dispatch
`desktop.ts` uses `await import('./module-name')` to open each tile. This keeps all window code out of the main bundle. The `prefetchLazyWindowModule()` function in `launcher-catalog.ts` fires the same import on hover/focus to warm the chunk before the user clicks.

### Theme System
Themes are self-contained `ThemePack` objects in `theme-packs.ts`. Adding a theme requires no other file changes — the picker and `theme` command auto-detect via array iteration.

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

All state in `localStorage`:

| Key | Contents |
|-----|----------|
| `portfolio-vfs-v8-namefailed-home` | VFS tree and cwd (bump version to force fresh defaults) |
| `mrgrey-theme` | Selected theme id |
| `mrgrey-os-sound` / `mrgrey-os-volume` | Sound on/off and volume |
| `mrgrey-retro-fx` | CRT overlay toggle |
| `mrgrey-matrix-bg` | Matrix rain toggle |
| `mrgrey-browser-iframe-tip-dismiss` | Browser tile tip dismissal |
| `mrgrey-desktop-tile-positions` | Desktop tile drag positions |
| `portfolio-fe-prefs-v1` | File explorer preferences |

No backend required.

## Layers (narrative summary)

**`content/`** — Portfolio copy. Long text lives under `content/copy/`. `portfolio.ts` assembles ANSI line arrays for each tile (resume, whoami, projects, links).

**`commands/`** — `index.ts` is the keyword-to-handler map. Split into `app-commands.ts` (tile stubs), `vfs-commands.ts` (filesystem), `system-commands.ts` (OS-flavour text commands).

**`desktop.ts` + `launcher-catalog.ts`** — `desktop.ts` owns tiling layout, dock, focus, minimize/maximize, and all Ctrl-chord keyboard handling. `launcher-catalog.ts` holds grid definitions and dock membership.

**`*-window.ts`** — One file per tile. Each takes close/minimize/maximize/focus callbacks. All lazy-loaded on first open via `await import()`. Three.js is inside `rubik-window` only.

**`rubik-model.ts`** — Pure cube state with no DOM dependency. All move functions, inverse sequences, scramble generator, and named algorithms live here and are fully unit-tested.

**`p5-sketches.ts`** — Sketch definitions (code as strings). Seeded into the VFS by `os-fs.ts` on first visit. `p5-window.ts` renders them in a sandboxed iframe.

**`os-*.ts`** — Fake OS layer. `os-fs.ts` is VFS v8 backed by localStorage. Bumping the version number forces fresh default trees for returning visitors.

**`theme-control.ts` + `theme-packs.ts`** — Theme packs define CSS custom properties (`--th-*`), xterm palette, and matrix rain colors. `theme-control.ts` applies them and persists the selection.
