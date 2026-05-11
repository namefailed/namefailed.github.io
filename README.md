# mrgrey.dev

**Live site:** https://namefailed.github.io/  
**Repository:** https://github.com/namefailed/namefailed.github.io  

I built my portfolio as an in-browser **window manager**: tiling layout, **xterm.js** terminal, a toy filesystem, themes, and optional CRT/matrix effects—so visitors land in something that feels like a workspace, not a scrolling brochure.

There is also a **`/static/`** lightweight brochure page (second Vite HTML entry → `dist/static/index.html`): open it from the shell with **`static`** (aliases `plain`, `x`) — same outbound links as the SPA’s projects list, stripped-down layout for readers or phones (the SPA also redirects coarse-pointer narrow viewports here). Résumé-style copy is imported from the same **`content/`** modules as the main app; **project tiles** reuse **`PORTFOLIO_PROJECTS`** from **`src/content/portfolio.ts`**, so you only edit portfolio data once for both surfaces. Deploy **`dist/`** as a whole so **`/static/`** is served as real files—not rewritten to the SPA shell.

## Documentation

- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — how I wired the modules, bootstrap order, WM vs terminal vs fake OS layers, mobile quirks, and build.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server (SPA at `/`, static brochure at `/static/`) |
| `npm run build` | `tsc` + production bundle → **`dist/`** + **`dist/static/`** |
| `npm run preview` | Preview `dist/` locally |

## GitHub Pages

The live site must publish **`dist/`** after `npm run build`, not the repo-root `index.html` (that file still points at `/src/main.ts`, which only exists under `vite dev`). This repo uses **`.github/workflows/deploy-pages.yml`**.

**One-time (repo → Settings → Pages):** set **Build and deployment → Source** to **GitHub Actions** (not “Deploy from a branch” on `main` / root). Then pushes to `main` build and deploy automatically.

## Stack

- TypeScript, Vite 8
- [@xterm/xterm](https://github.com/xtermjs/xterm.js) + fit + web-links addons

## License

Private project (`package.json`).
