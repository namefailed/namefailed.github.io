# mrgrey.dev

I built my portfolio as an in-browser **window manager**: tiling layout, **xterm.js** terminal, a toy filesystem, themes, and optional CRT/matrix effects—so visitors land in something that feels like a workspace, not a scrolling brochure.

## Documentation

- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — how I wired the modules, bootstrap order, WM vs terminal vs fake OS layers, mobile quirks, and build.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server |
| `npm run build` | `tsc` + production bundle |
| `npm run preview` | Preview `dist/` locally |

## Stack

- TypeScript, Vite 8
- [@xterm/xterm](https://github.com/xtermjs/xterm.js) + fit + web-links addons

## License

Private project (`package.json`).
