# Architecture

Personal portfolio site built as a fake desktop environment. TypeScript throughout, Vite for bundling, no framework.

## Entry points

**`index.html`** — The full desktop shell. Contains static markup for the CRT monitor frame, YASB status bar, launcher overlay, tiling pane area, and the floating dock. No dynamic content — everything is mounted by JS after load.

**`static/index.html`** — A second Vite entry that compiles to `dist/static/`. Same portfolio copy, no fake OS chrome. Mobile browsers auto-redirect here (viewport ≤ 768px). Good for anyone who just wants the resume.

**`src/main.ts`** — Imports CSS and calls `bootstrapShellUi()`. That's it.

**`src/bootstrap-shell.ts`** — The actual startup sequence. Order matters: theme and sound state restore from `localStorage` first, then `Desktop` is constructed before `TerminalApp` (so `fit()` closes over the real tiles), then Matrix rain defers via `requestIdleCallback`. If something fires at the wrong time, look here first.

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
