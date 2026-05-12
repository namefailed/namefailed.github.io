# Roadmap

All planned phases are complete. Future work is tracked under [Future](#future).

---

## Completed

### Phase 1 — Design tokens and keyboard accessibility
- All spacing, border-radius, z-index, duration, and easing values driven from `--ui-*` custom properties
- Global `:focus-visible` ring via `--ui-focus-ring` and `--ui-focus-offset`; xterm suppresses its own duplicate ring
- Skip link jumps keyboard users directly into the terminal on load
- Monitor frame uses `env(safe-area-inset-*)` so focus rings and scrollbars are never clipped on notched phones

### Phase 2 — Shell chrome (YASB, launcher, dock)
- Launcher panel scrolls with a styled thumb; icon grid uses `auto-fill` with `minmax` so it reflows at any width; tiles stagger in via `launcher-tile-in`
- Dock distinguishes active, minimised, idle, running, and closed states with distinct background, border, opacity, and glyph colour treatments
- YASB focused-title truncates with `text-overflow: ellipsis`; clock popover and toast column align to bar padding
- `@media (max-width: 720px)` tightens launcher inset and narrows icon minimum so nothing hugs the bezel

### Phase 3 — Window manager core
- `#terminal-window.app-window.active` is explicitly pinned to the same accent border + outer glow as any `.app-window.active` — parity is enforced in CSS, not inferred
- Active titlebar picks up `color-mix(accent 32%, titlebar-border)` on its bottom edge; inactive windows stay neutral
- Horizontal and vertical splitters styled via `--th-splitter-idle` / `--th-splitter-hover` with clear hover and drag states
- `.app-window` transitions `border-color`, `box-shadow`, `transform`, and `filter` so active/inactive and maximise/restore state changes animate smoothly

### Phase 4 — Terminal and command surface
- Settings panel theme `<select>` stays in sync with the `theme` CLI command via `syncThemeSelect()` in `os-systray.ts`
- Terminal font uses `--ui-font-sans` (JetBrains Mono) — same token as the rest of the shell
- `terminal-status-bar` transitions `border-top-color` using `:has(.vim-mode-line.mode-*)` selectors so mode changes tint the accent strip with a smooth transition rather than a hard swap

### Phase 5 — Motion and depth
- Cold load: `wm-monitor-in` (bezel), `wm-yasb-slide` (bar), and `wm-dock-rise` (dock) each have their own choreographed entrance
- Launcher tiles stagger in via `launcher-tile-in` with per-nth-child delays
- Windows mount via `wm-window-mount` (scale + blur + rotate) and close via `wm-window-close`; inactive panes read as recessed via `scale(0.997)` and `saturate(0.93)`
- Six `@media (prefers-reduced-motion: reduce)` blocks suppress or reduce every non-trivial animation

### Phase 6 — In-app chrome
- File explorer, browser, and editor toolbars use shared `--ui-*` tokens; all interactive controls have `focus-visible` rings
- Resume text column capped at `min(74ch, 100%)`; projects shell at `120ch`; contact copy at `76ch`
- Snake, paint, and cube canvases have `tabIndex` set; pong and snake have `@media (max-width: 720px)` minimum heights

### Phase 7 — Mobile, performance, accessibility
- Narrow viewports (≤720px): file explorer and browser URL bar layout, keyboard hint accuracy
- Non-critical work deferred to keep first interaction snappy on mid-tier hardware
- Landmark roles, contrast audit across all theme packs, axe pass on launcher and WM chrome

### Phase 8 — Persistence and reduced-motion
- Matrix rain state persists across reloads via `localStorage`
- `prefers-reduced-motion: reduce` defaults rain to off unless a saved preference overrides it
- Skip link lets keyboard users jump directly into the terminal on load

### Phase 9 — Route-level code splitting
- All heavy tiles (`browse`, `explorer`, `edit`, `paint`, `snake`, `pong`, `cube`) load via dynamic `import()` on first open — Three.js stays out of the cold path
- `browser-url.ts` extracted so the desktop and terminal don't eagerly import `browser-window`

### Phase 10 — Hover prefetch
- Launcher grid items and dock pins fire the same `import()` paths on `pointerenter` and `focusin`, so the first open is usually already cached

---

## Future

Unscheduled candidates, roughly grouped by area.

### Shell commands
- **`history`** — print the session command log; pairs naturally with the existing up/down history navigation
- **`man`** — per-command manual pages: longer description, flag reference, examples; a step up from `help <cmd>`
- **`alias` / `unalias`** — let visitors define shorthand commands, persisted to `localStorage`
- **`wget` / `curl`** — fake download that writes a file into the VFS and prints transfer output
- **`git log`** — fetch real commit history from the GitHub API and render it as a proper `git log` output

### Terminal UX
- **VFS path tab-completion** — complete filenames after `cat`, `cd`, `edit`, etc. from the current directory
- **Ctrl+R reverse search** — incremental history search, fzf-style, overlaid on the input line
- **`help` URL-bar caveat** — inline note in the `browse` command description about iframe sandboxing limits

### Window manager
- **Launcher keyboard navigation** — arrow keys move focus through the icon grid; Enter launches
- **Per-tile persistent state** — reopen browser to the last URL, editor to the last file, on restore
- **Screensaver mode** — matrix rain fills the screen after an idle timeout; any key restores the desktop
- **`ssh` easter egg** — fake handshake, motd, and remote shell prompt; `exit` returns to the local shell

### Themes and appearance
- **More colour packs** — Rose Pine, Everforest, Kanagawa, Catppuccin Latte (light variant)
- **`prefers-color-scheme: light` support** — auto-select a light pack when the OS is in light mode; overridable with `theme <id>`

### New app tiles
- **Markdown viewer** — render `.md` files from the VFS in a content window, with syntax-highlighted fenced blocks
- **More games** — Tetris or Minesweeper fit the tile size and match the existing input model

### Platform
- **PWA manifest + service worker** — makes the site installable and functional offline; cache strategy mirrors the Vite build output
