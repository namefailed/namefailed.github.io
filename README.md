# namefailed.github.io

**Live:** https://namefailed.github.io/

A personal portfolio built as an in-browser window manager — tiling layout, xterm.js terminal, a toy filesystem, seven colour themes, and optional CRT/matrix effects.

A second entry (`/static/`) serves the same portfolio copy as a plain brochure page. Mobile visitors land there automatically.

## Stack

- TypeScript, Vite 8 (two HTML entry points)
- [@xterm/xterm](https://github.com/xtermjs/xterm.js) + fit + web-links addons
- Three.js (Rubik's cube tile)
- Web Audio API (sound effects)
- No framework — vanilla DOM throughout

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server — desktop at `/`, brochure at `/static/` |
| `npm run build` | `tsc` then Vite build → `dist/` and `dist/static/` |
| `npm run preview` | Preview `dist/` locally |
| `npm test` | Vitest — `*.test.ts` files |

## GitHub Pages

The deploy publishes `dist/`, not the repo root. `index.html` at the root still points at `/src/main.ts` and only works under `vite dev`.

**One-time setup:** repo → Settings → Pages → Build and deployment → Source → **GitHub Actions**. Pushes to `main` then build and deploy via `.github/workflows/deploy-pages.yml`.

## Docs

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — module layout, bootstrap order, naming conventions
- [docs/THEMING.md](docs/THEMING.md) — ThemePack interface, custom property reference, how to add a pack
- [docs/ROADMAP.md](docs/ROADMAP.md) — completed phases and planned polish work
