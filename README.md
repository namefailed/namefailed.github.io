# namefailed.github.io

**Live:** [mrgrey.site](https://mrgrey.site) · **Alt:** [namefailed.github.io](https://namefailed.github.io/)

A personal portfolio built as an **in-browser desktop OS** — tiling window manager, xterm.js terminal, virtual filesystem, vim-style editor, interactive demos, and seven runtime colour themes. The same content also ships as a polished brochure at `/static/` (mobile default).

---

## At a glance

| | |
|---|---|
| **Stack** | TypeScript · Vite 8 · vanilla DOM (no framework) |
| **Terminal** | [@xterm/xterm](https://github.com/xtermjs/xterm.js) + vim input layer |
| **3D** | Three.js (Rubik cube — lazy chunk only) |
| **Tests** | **587** unit · **3** e2e smoke · CI on every `main` push |
| **Deploy** | GitHub Actions → GitHub Pages (`dist/`) |

---

## Why this exists

Most portfolios list skills. This one **runs** them: modular TypeScript, lazy code splitting, keyboard-driven UX, tested pure helpers, and client-side persistence — packaged as something memorable to explore.

**For reviewers:** start with [docs/OVERVIEW.md](docs/OVERVIEW.md) — architecture diagram, technical highlights, skills map.

**For contributors & AI agents:** [docs/README.md](docs/README.md) — full documentation index.

---

## Quick start

```bash
npm install
npm run dev          # desktop → http://localhost:5173/
npm test             # 587 unit tests
npm run build && npm run test:e2e
```

Open the terminal (`Ctrl+T`) and type `help`.

---

## Features

### Desktop shell
- BSP tiling window manager with drag splitters, floating dock, Applications launcher
- Lazy-loaded tiles: résumé, projects, editor, file explorer, browser, p5 viewer, games, Rubik cube
- xterm.js shell with 50+ commands and vim-style prompt editing
- VFS v8 in `localStorage` — real `edit` / `ls` / `mkdir` workflow
- Seven themes, CRT overlay, matrix rain, wallpaper, Web Audio UI sounds

### Brochure (`/static/`)
- Scroll progress, section nav, typewriter hero, animated counters
- Auto-redirect on viewport ≤768px

---

## Keyboard shortcuts

| Chord | Action |
|-------|--------|
| `Ctrl+T` | Open / focus terminal |
| `Ctrl+D` | Applications launcher |
| `Ctrl+H/L/K/J` | Focus window ← → ↑ ↓ |
| `Ctrl+Q/M/F` | Close / minimize / maximize |
| `Ctrl+1–9` | Focus dock slot |

Full list: `keybinds` in terminal or [docs/USER_GUIDE.md](docs/USER_GUIDE.md).

---

## Documentation

| Document | Audience |
|----------|----------|
| [docs/README.md](docs/README.md) | **Documentation hub** |
| [docs/OVERVIEW.md](docs/OVERVIEW.md) | Employers & technical reviewers |
| [docs/USER_GUIDE.md](docs/USER_GUIDE.md) | Site users |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Module layout & data flow |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Local dev & change recipes |
| [docs/AGENTS.md](docs/AGENTS.md) | AI agents & automation |
| [docs/API.md](docs/API.md) | Types & extension APIs |
| [docs/THEMING.md](docs/THEMING.md) | Colour packs & CSS tokens |
| [docs/STYLE_GUIDE.md](docs/STYLE_GUIDE.md) | Coding standards |

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev — `/` desktop, `/static/` brochure |
| `npm run build` | `tsc` + Vite → `dist/` |
| `npm run preview` | Preview production build |
| `npm test` | Vitest unit suite |
| `npm run test:coverage` | Coverage report |
| `npm run lint` | ESLint |
| `npm run test:e2e` | Playwright smoke tests |

---

## GitHub Pages

Deploy publishes **`dist/`**, not the repo root. One-time: repo → Settings → Pages → Source → **GitHub Actions**. Pushes to `main` run lint, tests, build, e2e, then deploy (`.github/workflows/deploy-pages.yml`).

---

## License

Personal portfolio — source available for review; contact author for reuse.
