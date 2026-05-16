# namefailed.github.io

**Live:** https://mrgrey.site  
**Alt:** https://namefailed.github.io/

A personal portfolio built as an in-browser window manager — tiling layout, xterm.js terminal, a toy filesystem, seven colour themes, and optional CRT/matrix effects.

A second entry (`/static/`) serves the same portfolio content as a polished brochure page. Mobile visitors are redirected there automatically.

## Stack

- TypeScript, Vite 8 (two HTML entry points)
- [@xterm/xterm](https://github.com/xtermjs/xterm.js) + fit + web-links addons
- Web Audio API (sound effects)
- No framework — vanilla DOM throughout

> **Note:** Three.js (Rubik's cube tile) is bundled but the cube is currently disabled pending a geometry/rotation fix.

## Features

### Desktop shell
- Tiling window manager with floating dock and launcher overlay
- xterm.js terminal with vim-mode editing (insert / normal / visual)
- Seven switchable colour themes — Catppuccin Mocha, Dracula, Nord, Gruvbox, Tokyo Night, Solarized Dark, One Dark
- Matrix rain backdrop and CRT scanline/vignette overlay (both toggleable and persistent)
- Virtual filesystem (VFS v3) backed by `localStorage` — `cat`, `ls`, `mkdir`, `touch`, `rm`, `edit`, `wc`, and more

### Shell commands
- `resume` — full résumé with inline skills matrix in ANSI colour
- `projects` — portfolio project listing with links
- `contact`, `about`, `help`, `whoami`, `motd`, `fortune`
- `theme [id|list|random]` — switch colour packs at runtime
- `browse <url>` — embedded browser tile
- `edit [file]` — in-shell text editor backed by the VFS
- `snake`, `pong` — playable games
- `paint` — pixel canvas
- `ssh`, `apt`, `cowsay`, `neofetch`, `wc`, `matrix` — easter eggs and flavor commands

### Static brochure (`/static/`)
- Scroll progress bar, floating section-nav dots with tooltips
- Typewriter headline effect, animated stat counters
- Scroll-triggered fade-in animations (respects `prefers-reduced-motion`)
- Experience cards with role-type colour strips and a "Featured" badge
- Auto-redirect from mobile: viewport ≤ 768px lands on `/static/` by default

### Keybinds
| Chord | Action |
|-------|--------|
| `Ctrl+H` | Focus terminal (← left) |
| `Ctrl+L` | Enter right pane (→) |
| `Ctrl+K` | Previous window (↑) |
| `Ctrl+J` | Next window (↓) |
| `Ctrl+Q` | Close focused window |
| `Ctrl+M` | Minimise focused window |
| `Ctrl+F` | Maximise / restore |
| `Ctrl+1–9` | Activate dock slot N |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server — desktop at `/`, brochure at `/static/` |
| `npm run build` | `tsc` then Vite build → `dist/` and `dist/static/` |
| `npm run preview` | Preview `dist/` locally |
| `npm test` | Vitest — `*.test.ts` files |

## GitHub Pages

The deploy publishes `dist/`, not the repo root. `index.html` at the root only works under `vite dev`.

**One-time setup:** repo → Settings → Pages → Build and deployment → Source → **GitHub Actions**. Pushes to `main` build and deploy via `.github/workflows/deploy-pages.yml`.

## Docs

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — module layout, bootstrap order, naming conventions, testing
- [docs/THEMING.md](docs/THEMING.md) — ThemePack interface, custom property reference, how to add a pack
- [docs/STYLE_GUIDE.md](docs/STYLE_GUIDE.md) — TypeScript standards, CSS conventions, testing guidelines
- [docs/API.md](docs/API.md) — Window system, VFS, storage utilities, theming API

## Testing

171 tests across 7 test files:
- `npm test` — run Vitest suite
- Tests co-located with source: `module.ts` → `module.test.ts`
- Coverage: VFS, vim input, storage utilities, ANSI parsing, CLI tools, window chrome
