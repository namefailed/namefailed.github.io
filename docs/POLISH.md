# Polish roadmap — checkpoints

Phase 0 is **baseline**. After each numbered smoke pass, jot the date + “OK / issues” before moving on.

## Dev server

```bash
npm run dev
```

Default URL: http://localhost:5173/

## Checkpoint 0 — reference capture *(before big sweeps)*

- [ ] Screenshot: cold load (monitor + wallpaper + terminal)
- [ ] Screenshot: **Applications** open (launcher/grid)
- [ ] Screenshot: two tiled apps + terminal (desktop feels full)
- [ ] Screenshot: narrow width (~390px / phone emulation)

## Smoke path *(run anytime)*

Every polish phase should survive this walkthrough:

1. [ ] Page loads — no blank shell, bezel + matrix (if enabled) sane
2. [ ] Terminal: type `help` — renders, scrolls
3. [ ] Open **about** → window chrome + scroll OK
4. [ ] Open **files** → list renders, resize panes splitters drag
5. [ ] Toggle **retro** — scanlines overlay; WM still usable
6. [ ] **`theme list`** → switch theme → bar/desktop colors shift
7. [ ] **`matrix off`** / **`matrix on`** if testing backgrounds
8. [ ] Minimize a window → restore from dock/taskbar
9. [ ] **Ctrl+D** show-desktop ↔ restore
10. [ ] **`browse`** → URL bar warning if you hit iframe limits
11. [ ] Quickly open paint / snake — no immediate layout explosion

## Phase 1 done when

- [ ] Spacing/radius/z-index largely driven from `--ui-*` tokens (see `:root` in `style.css`)
- [ ] Keyboard **Tab** through top bar buttons — visible **focus rings** that don’t fight retro layers
- [ ] Resize viewport + rotate mobile — bezel safe-area doesn’t clip focus rings or scrollbars

## Phase 2 — shell chrome (YASB, launcher, dock)

- [ ] **Applications**: grid breathes — icon tiles show hover border, long grids scroll with a thin thumb, backdrop reads even
- [ ] **Dock**: pill width respects side gutters, active vs minimized vs running states read at a glance
- [ ] **YASB**: focused title truncates cleanly; clock popover + toast column line up; sound chip rhythm matches bar padding
- [ ] **≤720px**: launcher inset tightens so nothing hugs the bezel awkwardly

## Phase 3 — WM core (tiling, terminal, splitters)

- [ ] **Terminal focus**: click terminal then a content window then terminal again — `#terminal-window.app-window.active` shows the same accent ring + shadow stack as any other `.app-window.active` (border + outer glow), with a smooth transition, not a snap
- [ ] **Titlebar parity**: with terminal active vs a content window active, title bar bottom edge picks up the same subtle accent-tinted divider (inactive windows stay neutral)
- [ ] **Horizontal splitter**: grip reads at a glance; hover/drag states are obvious; drag still resizes terminal vs right pane without jank (`splitter.ts` unchanged)
- [ ] **Vertical splitters** (two+ stacked apps): same grip affordance; dragging still resizes row heights predictably
- [ ] **Maximize / restore**: terminal max and single-window max keep rings consistent when that surface is active
- [ ] **Ctrl+D show desktop**: restore brings focus/ring state back in a sensible way (no stuck “active” on a hidden window)

## Phase 4 — Terminal + command surface

- [ ] **System menu (clock)**: palette `<select>` lists every pack; mirrors `theme` CLI changes; shortcuts are a tidy list (no duplicate palette line above hints)
- [ ] **xterm**: font stack matches site mono tokens; smooth wheel scroll isn’t jarring; selection stays readable when focus moves to a window
- [ ] **Padding / scrollbar**: terminal body uses shared spacing tokens; thumb still hugs the right inner edge
- [ ] **Mode line**: vim mode changes tint the top accent with a short transition (not a hard snap)
- [ ] **`help`**: intro mentions URL behavior; grouped catalog still matches every visible command

---

## Phase 5 — Motion + depth

- [ ] **Cold load**: bezel / bar / dock choreography reads intentional, not sluggish
- [ ] **Launcher**: overlay + panel ease open/close; icon grid stagger stays subtle
- [ ] **Tiles**: new windows mount smoothly; inactive panes read “recessed” vs active
- [ ] **Reduced motion**: OS respects `prefers-reduced-motion` (no long flourishes)

## Phase 6 — In-app chrome (content tiles)

- [ ] **Files / Browse / Editor**: toolbars, lists, and empty states match bar tokens; no layout “drift” vs WM _(CSS rhythm + focus-visible pass in repo)_
- [ ] **Portfolio windows** (résumé, projects, skills): readable line length; headings + scroll feel consistent _(résumé text column capped at ~74ch)_
- [ ] **Tiny apps** (paint, games, cube): controls legible; focus rings don’t clip _(canvas tabindex / outline where needed)_

## Phase 7 — Mobile, perf, a11y audits

- [x] **≤720px**: file browser + browser URL bar wrap without overlap; keyboard hints still accurate where shown
- [x] **Heavy routes**: defer non-critical work; keep first interaction snappy on mid-tier hardware
- [x] **A11y**: landmark roles, contrast spot-check per theme pack, axe pass on launcher + WM _(single `main` + `role="region"` launcher; manual spot-check for contrast)_

## Phase 8 — Persistence, reduced-motion default, skip link

- [x] **Matrix**: `localStorage` remembers on/off across reloads; **`prefers-reduced-motion: reduce`** starts with rain off unless a saved preference says otherwise
- [x] **Skip link**: keyboard users can jump straight into the terminal shell (focused xterm after load)

## Phase 9 — Route-level code splitting

- [x] **Lazy tiles**: `browse`, `explorer`, `edit`, paint/snake/pong/`cube` load via `import()` on first open; **Three.js** stays out of cold path
- [x] **URL helpers**: `DEFAULT_BROWSER_URL` / `normalizeBrowserUrl` live in `browser-url.ts` so desktop + terminal avoid eager `browser-window`

## Phase 10 — Lazy-chunk warm-up

- [x] **Hover / focus prefetch**: launcher grid + dock pins fire the same `import()` paths as `openWindow` on `pointerenter` and `focusin` so the first open is often already cached

Later phases extend this doc with Phase 11+ as needed.
