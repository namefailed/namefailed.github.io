# Roadmap

All original planned phases are complete. Recent polish work is tracked below. Future candidates are grouped by priority.

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

### Polish pass — Static site, resume, and shell

- **Static site interactive polish:** scroll-progress bar, floating section-nav dots (scroll-spy via IntersectionObserver), typewriter headline, animated stat counters (9+/15+/3), scroll-triggered fade-ins, bouncing scroll cue
- **Experience cards:** role-type inset colour strips (freelance/contract/fulltime/volunteer), "Featured" badge on Vertalo card
- **Resume sync:** added Vertalo (Frontend Developer, 2021–2022) and SCA (Deputy Web Minister, 2025) to both terminal resume and static site; corrected all dates and descriptions; bullets rewritten for impact across all five roles
- **VFS v3:** bumped `STORAGE_KEY` to `portfolio-vfs-v3-namefailed-home`; removed `welcome.txt` from default tree; default editor target changed to `notes.txt`
- **hjkl keybinds:** corrected to true vim directions — `H`=terminal (left), `L`=enter pane (right), `K`=previous window (up), `J`=next window (down); YASB and help text updated to match
- **Paint canvas:** switched from `overflow: auto` to `overflow: hidden` to eliminate phantom scroll containers on touch
- **Resume hanging-indent:** long PROFILE paragraph no longer overhangs left on wrap; fixed with `padding-left: 2ch; text-indent: -2ch`
- **Workstyle bullets:** rewritten for clarity and directness

---

## Next up

Priority order — highest value / most visible first.

### 1. Rubik's cube fix *(top priority)*
The cube tile exists and lazy-loads fine but is currently disabled in `launcher-catalog.ts` because the rotation math produces incorrect face orientations after arbitrary move sequences. Fix the quaternion/rotation accumulation, re-enable the tile, add it back to the dock.

### 2. VFS tab-completion
Complete filenames after `cat`, `cd`, `edit`, `rm`, etc. from the current directory. Huge UX improvement for anyone who tries to actually use the shell. Hook into the existing readline layer in `vim.ts` / `terminal.ts`.

### 3. `history` command
Print the session command log. Pairs naturally with existing up/down history navigation. Low effort, high payoff — every terminal user reaches for it within the first minute.

### 4. Launcher keyboard navigation
Arrow keys move focus through the icon grid; Enter launches. The launcher already has focus management — this fills in the expected keyboard contract.

### 5. Per-tile persistent state
Reopen browser to the last URL, editor to the last file, on restore. State goes in `localStorage` keyed by tile type. Makes the WM feel real rather than toy.

---

## Future candidates

Unscheduled, roughly grouped by area.

### Shell commands
- **`man`** — per-command manual pages: longer description, flag reference, examples; a step up from `help <cmd>`
- **`alias` / `unalias`** — let visitors define shorthand commands, persisted to `localStorage`
- **`wget` / `curl`** — fake download that writes a file into the VFS and prints transfer output
- **`git log`** — fetch real commit history from the GitHub API and render it as a proper `git log` output
- **`Ctrl+R` reverse search** — incremental history search, fzf-style, overlaid on the input line

### Window manager
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
