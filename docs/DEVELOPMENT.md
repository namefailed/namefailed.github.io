# Development Guide

Local setup, verification, and common change workflows.

---

## Prerequisites

- **Node.js 22+** (matches CI)
- npm (comes with Node)

---

## Quick start

```bash
git clone https://github.com/namefailed/namefailed.github.io.git
cd namefailed.github.io
npm install
npm run dev
```

| URL | Entry |
|-----|-------|
| http://localhost:5173/ | Desktop shell |
| http://localhost:5173/static/ | Brochure |

Production build:

```bash
npm run build      # tsc + vite → dist/
npm run preview    # serve dist/ locally
```

---

## Verification checklist

Run before opening a PR:

```bash
npm run lint       # ESLint
npm test           # Vitest — 563 unit tests
npm run build      # TypeScript + Vite
npm run test:e2e   # Playwright (requires preview build)
```

CI (`.github/workflows/deploy-pages.yml`) runs the same sequence on every push to `main`.

Coverage report (optional):

```bash
npm run test:coverage   # output in coverage/ (gitignored)
```

Watch mode during development:

```bash
npm run test:watch
```

---

## Project conventions

| Topic | Rule |
|-------|------|
| Tests | Co-located: `foo.ts` → `foo.test.ts` |
| Test env | Node (no real DOM) — stub `document` / `localStorage` when needed |
| Tiles | Filename ends in `-window.ts` |
| OS layer | Prefix `os-` |
| WM helpers | Prefix `desktop-wm-` or `desktop-` |
| Storage | Always use `storage.ts` wrapper, never raw `localStorage` in new code |
| CSS tokens | Use `--th-*` / `--ui-*` vars — see [THEMING.md](./THEMING.md) |

Full coding standards: [STYLE_GUIDE.md](./STYLE_GUIDE.md).

---

## Common tasks

### Add a shell command (text only)

1. Add handler in `src/commands/system-commands.ts` or `vfs-commands.ts`.
2. Export spreads into `src/commands/index.ts` automatically via submodule import.
3. Add tests in matching `*.test.ts`.
4. Update help groups in `help-output.ts` if the command should appear in a section.

### Add a window tile

1. Create `src/my-app-window.ts` implementing close/minimize/maximize/focus callbacks.
2. Add lazy import branch in `src/desktop-open-window.ts` → `dispatchOpenWindow`.
3. Register command in `src/commands/app-commands.ts` (returns `[]` — desktop intercepts).
4. Add to `TILED_WINDOW_COMMANDS` in `launcher-catalog.ts` if it should appear in launcher.
5. Add `prefetchLazyWindowModule` case for hover warmup.
6. Add tests for any pure logic; WM integration may use `desktop.test.ts` patterns.

See [API.md](./API.md) for `WindowSpec` and `createWindowChrome`.

### Add a colour theme

1. Define pack in `src/theme-packs.ts` (spread `mochaCss`, override deltas).
2. Append to `THEME_PACKS` array — picker and `theme` command auto-detect.

Details: [THEMING.md](./THEMING.md).

### Bump VFS schema

1. Change `STORAGE_KEY` version in `src/os-fs.ts` (e.g. `v8` → `v9`).
2. Update default seed tree if needed.
3. Update docs: [ARCHITECTURE.md](./ARCHITECTURE.md) persistence table.

Returning visitors get a fresh tree; old data is orphaned under the previous key.

### Edit desktop CSS

Desktop styles live in `src/styles/section*.css`, imported via `src/style.css`.

Regenerate split files from monolith backup (if used):

```bash
node scripts/split-style-css.mjs
```

Brochure CSS is separate: `src/static/static.css` (`--plain-*` tokens).

---

## Debugging tips

| Issue | Check |
|-------|-------|
| Tile doesn't open | Browser console; `dispatchOpenWindow` switch; command in `app-commands.ts` |
| Terminal command no-op | App commands return `[]` — desktop must handle via `openWindow` |
| Theme not applying | `theme-control.ts`; `--th-*` keys all present in pack |
| Test fails in Node | Missing DOM stub — see `bsp-layout.test.ts` or `desktop.test.ts` FakeEl patterns |
| iframe reloads on layout | BSP never moves iframe elements after mount — see `bsp-layout.ts` comment |

---

## Deploy

GitHub Pages serves **`dist/`**, not the repo root.

1. Repo → Settings → Pages → Source → **GitHub Actions**
2. Push to `main` triggers build + deploy

Custom domain: configured in repo settings (currently `mrgrey.site`).

---

## Further reading

| Doc | When |
|-----|------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Module map and data flow |
| [AGENTS.md](./AGENTS.md) | Machine-oriented repo guide |
| [API.md](./API.md) | Type reference |
| [USER_GUIDE.md](./USER_GUIDE.md) | End-user features |
