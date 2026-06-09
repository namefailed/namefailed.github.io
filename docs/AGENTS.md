# Agent Guide

Machine-oriented reference for AI coding agents, automation, and contributors who need **deterministic navigation** of this repository.

---

## Mission

Build and maintain an in-browser fake desktop portfolio. Primary constraints:

1. **No UI framework** — vanilla TypeScript + DOM.
2. **Lazy tiles** — dynamic `import()` for every `*-window.ts` except `appwindow.ts`.
3. **Never move iframe-backed DOM nodes** after mount (p5, browser tiles reload if reparented).
4. **Persist via `storage.ts`** — handle private-mode failure gracefully.
5. **Test pure logic** in Node; stub DOM when testing layout/WM.

---

## Entry-point graph

```
index.html
  └─ src/main.ts
       └─ bootstrap-shell.ts
            ├─ theme-control.ts (initThemeFromStorage)
            ├─ retro-fx.ts, os-sound.ts, os-systray.ts
            ├─ boot-splash.ts (runBootSplash, before Desktop)
            ├─ matrix-bg.ts (idle)
            └─ new Desktop(#desktop)
                 ├─ bsp-layout.ts (#right-pane)
                 ├─ desktop-open-window.ts (lazy tiles)
                 └─ terminal.ts (lazy tile via openWindow)

static/index.html
  └─ src/static/main.ts (brochure only — no desktop imports)
```

---

## File → responsibility map

| Path pattern | Role |
|--------------|------|
| `desktop.ts` | WM orchestrator — do not re-bloat; extract to `desktop-*.ts` |
| `desktop-wm-*.ts` | WM subsystems (lifecycle, maximize, sync, focus, …) |
| `desktop-open-window.ts` | **Single dispatch** for opening tiles |
| `desktop-window-spec.ts` | Build `WindowSpec` from command strings |
| `launcher-catalog.ts` | Dock pins, launcher grid, prefetch map |
| `*-window.ts` | Tile UI class (`el`, `command`, WM callbacks) |
| `terminal.ts` | xterm + command execution + `openWindow` bridge |
| `commands/index.ts` | Shell command registry merge point |
| `commands/app-commands.ts` | Tile stubs returning `[]` |
| `os-fs.ts` | VFS — key `portfolio-vfs-v8-namefailed-home` |
| `os-registry.ts` | Breaks circular import: terminal → desktop ref |
| `editor-vim-motions.ts` | Pure caret/motion helpers — **no buffer mutation** |
| `editor-vim-edits.ts` | Pure `{ text, pos }` buffer edits — `BufferEditResult` |
| `editor-vim-ops.ts` | Barrel re-export of motions + edits |
| `editor-buffer.ts` | Apply layer between pure edits and textarea state |
| `editor-normal-handlers.ts` | NORMAL-mode single-key handler map |
| `editor-vim-keys.ts` | Pure editor key-chord helpers |
| `vim.ts` | Terminal one-line vim widget (separate from editor tile) |
| `bsp-layout.ts` | Two-column BSP + splitters |
| `splitter.ts` | Pointer drag resize |
| `theme-packs.ts` | All `--th-*` values per theme |
| `content/copy/*.ts` | Portfolio text sources |
| `portfolio.ts` | ANSI line arrays for content tiles |

---

## Critical invariants

| Invariant | Why |
|-----------|-----|
| `app-commands` handlers return `[]` | Desktop opens tiles; terminal must not print fake output |
| `setDesktopRef(this)` in Desktop ctor | Terminal `openWindow` routing |
| `focusedId === null` | No right-pane tile focused (not “legacy terminal focused”) |
| `#panes` contains only `#right-pane` | Terminal is a tile, not static HTML column |
| BSP `maxVisible = 4` | Fifth tile bumps oldest to dock |
| Editor buffer mutations | Prefer `editor-vim-edits.ts` + `editor-vim-motions.ts` + tests before touching `editor-window.ts` |

---

## Change recipes

### New shell command (no tile)

```
commands/<subsystem>-commands.ts  → add Command entry
commands/<subsystem>-commands.test.ts  → add test
commands/index.ts  → already spreads submodule
```

### New tile command `myapp`

```
1. src/myapp-window.ts          — tile class
2. desktop-open-window.ts       — case in dispatchOpenWindow + dynamic import
3. commands/app-commands.ts     — myapp: { run: () => [], loadMs: N }
4. launcher-catalog.ts          — TILED_WINDOW_COMMANDS, LAUNCHER_ICON_ROWS, prefetch
5. desktop-window-spec.ts       — if portfolio spec needed
6. tests for pure helpers only
```

### WM behaviour change

Prefer editing the extracted module, not `desktop.ts`:

| Concern | Module |
|---------|--------|
| Close/minimize animation | `desktop-wm-lifecycle.ts` |
| Maximize | `desktop-wm-maximize.ts` |
| Ctrl+chords | `desktop-keyboard-handler.ts` + `desktop-keyboard-chords.ts` |
| H/J/K/L focus | `desktop-spatial-focus.ts` |
| Shell CSS dataset | `desktop-wm-sync.ts` |
| Host bindings | `desktop-wm-hosts.ts` |

### Editor vim motion or edit

```
1. Add pure function to editor-vim-motions.ts (caret) or editor-vim-edits.ts (mutation)
2. Test in editor-vim-motions.test.ts or editor-vim-edits.test.ts
3. Wire handler in editor-normal-handlers.ts OR chord in editor-window.ts
4. Buffer apply goes through editor-buffer.ts when mutating textarea state
```

---

## Test commands

```bash
npm test                    # all unit tests
npm test -- src/foo.test.ts # single file
npm run lint
npm run build
npm run test:e2e            # needs dist + playwright chromium
```

Vitest config: `vite.config.ts` → `test.environment: 'node'`.

WM tests often use `FakeEl` trees — copy pattern from `src/desktop.test.ts` or `src/bsp-layout.test.ts`.

---

## localStorage keys (authoritative)

| Key | Module | Purpose |
|-----|--------|---------|
| `portfolio-vfs-v8-namefailed-home` | `os-fs.ts` | VFS JSON state |
| `mrgrey-theme` | `theme-control.ts` | Active theme id |
| `mrgrey-os-sound` | `os-sound.ts` | Sound enabled |
| `mrgrey-os-volume` | `os-sound.ts` | Volume 0–1 |
| `mrgrey-retro-fx` | `retro-fx.ts` | CRT overlay |
| `mrgrey-matrix-bg` | `matrix-bg.ts` | Matrix rain on/off |
| `mrgrey-wallpaper` | `wallpaper.ts` | Wallpaper URL |
| `mrgrey-desktop-tile-positions-v6` | `desktop-tiles.ts` | Folder tile drag layout |
| `portfolio-fe-prefs-v1` | `file-explorer-window.ts` | Explorer prefs |
| `mrgrey-browser-iframe-tip-dismiss` | `browser-window.ts` | Browser tip permanent dismiss |
| `mrgrey-boot-seen` | `boot-splash.ts` | Skip boot animation |
| `mrgrey-guide-seen` | `welcome-guide.ts` | Welcome guide card |
| `mrgrey-p5-tip-seen` | `p5-window.ts` | p5 viewer tip |
| `mrgrey-pkgs-v1` | `os-packages.ts` | Installed joke packages |
| `mrgrey-apt-cowsay` | `os-apt.ts` | cowsay install flag |

Always read/write through `storage.ts` helpers.

---

## Custom events

| Event | When |
|-------|------|
| `mrgrey-theme-change` | Theme applied |
| `mrgrey-wallpaper-change` | Wallpaper set/cleared |
| `mrgrey-first-window` | First tile opened (onboarding) |
| `mrgrey-terminal-cmd` | First terminal command run |

---

## Docs to update when you change…

| Change | Update |
|--------|--------|
| New module / layer | `docs/ARCHITECTURE.md` table |
| New storage key | `docs/ARCHITECTURE.md` + this file |
| New command / keybind | `docs/USER_GUIDE.md` + `help-output.ts` |
| New theme | `docs/THEMING.md` pack table |
| Public API / types | `docs/API.md` |
| Test count shift | `docs/README.md`, root `README.md` |

---

## Anti-patterns

- Adding static `#terminal-window` HTML — terminal is **lazy tile only**
- Importing `desktop.ts` from tiles — use callbacks + `os-registry.ts`
- Large new features entirely inside `desktop.ts` — extract module + tests
- Raw `localStorage.setItem` — use `storage.ts`
- Hard-coded colours — use `--th-*` from theme packs
- DOM-heavy tests without stubs — will fail in Node Vitest

---

## See also

- [DEVELOPMENT.md](./DEVELOPMENT.md) — human setup guide
- [ARCHITECTURE.md](./ARCHITECTURE.md) — full module catalogue
- [API.md](./API.md) — type definitions
