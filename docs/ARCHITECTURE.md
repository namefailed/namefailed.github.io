# How this repo is laid out

Personal site dressed up as a toy desktop. The goal is: **one brain (TypeScript), split by job**, so grep and file names carry meaning and I’m not doom-scrolling one 3k-line god file when something breaks six months later.

## Entry points

- **`index.html`** — Shell markup: CRT frame, workspace, YASB bar, launcher, docking bar, terminal host, placeholders for tiled panes.
- **`src/main.ts`** — Dead-simple Vite hook: stylesheet imports + **`bootstrapShellUi()`** from `bootstrap-shell.ts` (everything else intentionally not here).
- **`src/bootstrap-shell.ts`** — The real startup sequence: storages/theme/sound/systray, DOM lookups, **`Desktop`** before **`TerminalApp`**, idle-deferred Matrix init, skip-link. If something fires too early or too late, this is the place.
- **`src/plain/`** — Second Vite entry: same copy data, zero fake OS chrome (good for recruiters who just want prose).

Build is plain Vite; **`vite.config.ts`** names both HTML inputs so `dist/` gets `main` + `plain`.

## Rough layers

Think “rings”, not clever hexagons:

1. **`content/`** — Barrel + themed copy. Long lists sit under **`content/copy/*.ts`** (`projects-catalog`, `resume-copy`, …); **`portfolio.ts`** re-exports so old import paths keep working. ANSI helpers that are copy-only share **`copy/ansi-widgets.ts`**.
2. **`commands/`** — **`index.ts`** is the keyword registry; **`help-output.ts`**, **`cli-text-utils.ts`**, **`cli-fortunes.ts`**, **`types.ts`** carry the rest so this isn’t one megafile. **`terminal.ts`** only needs the map.
3. **Window-manager side** — **`desktop.ts`** owns tiling, dock, launcher, Ctrl-chords. **`launcher-catalog.ts`** is just the grids + prefetch hints so `desktop.ts` reads less like JSON-in-TypeScript soup.
4. **Tiles / apps** — `*-window.ts` files: self-contained DOM + behavior (editor, browser, games, etc.). They take callbacks for close/focus so `Desktop` doesn’t import their guts.
5. **OS cosplay** — `os-*.ts`: fake VFS, apt joke, tray toasts, sound. Shared registry **`os-registry.ts`** bridges “shell command wants desktop” without cyclic imports blowing up.

## Naming I try to stick to

- **`initXFromStorage`** — reads localStorage/sessionStorage once at boot.
- **`openWindow` / `WindowSpec`** — tile contract from terminal into desktop.
- **`*-window.ts`** — full tile implementation.
- **`runShellHelp`**, **`resumeWindow*`** — verb-first or noun+role so `rg` pulls the right file.

When that slips, refactor beats comments.

## If you clone this

1. **`npm install`**, **`npm run dev`**.
2. TypeScript ships as devDependency; **`npm run build`** runs `tsc` then `vite build`.
3. No backend — static hosting friendly. Persisted state is **`localStorage`** (VFS, theme, CRT flag, matrix switch, sound preference).

Tests aren’t wired yet; sanity check is `npm run build` after edits.
