# mrgrey.dev

**Repository:** https://github.com/namefailed/mrgrey.dev

I built my portfolio as an in-browser **window manager**: tiling layout, **xterm.js** terminal, a toy filesystem, themes, and optional CRT/matrix effects—so visitors land in something that feels like a workspace, not a scrolling brochure.

There is also a **`/plain/`** static brochure page (second Vite HTML entry → `dist/plain/index.html`): open it from the shell with **`static`** (aliases `plain`, `x`) — same outbound links as the SPA’s projects list, stripped-down layout for readers or hosts that struggle with heavy JS. Résumé-style copy lives in **`src/plain/plain-data.ts`**; **project tiles** reuse **`PORTFOLIO_PROJECTS`** from **`src/content/portfolio.ts`**, so you only edit portfolio data once for both surfaces. Deploy **`dist/`** as a whole so `/plain/` is served as real files—not rewritten to the SPA shell.

## Documentation

- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — how I wired the modules, bootstrap order, WM vs terminal vs fake OS layers, mobile quirks, and build.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server (SPA at `/`, plain at `/plain/`) |
| `npm run build` | `tsc` + production bundle → **`dist/`** + **`dist/plain/`** |
| `npm run preview` | Preview `dist/` locally |

## Stack

- TypeScript, Vite 8
- [@xterm/xterm](https://github.com/xtermjs/xterm.js) + fit + web-links addons

## License

Private project (`package.json`).
