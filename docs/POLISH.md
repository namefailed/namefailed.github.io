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

- [ ] **System menu (clock)**: theme chips match `theme list`; active chip obvious; ←/→ move between radios; panel reads lighter than bar chrome overload
- [ ] **xterm**: font stack matches site mono tokens; smooth wheel scroll isn’t jarring; selection stays readable when focus moves to a window
- [ ] **Padding / scrollbar**: terminal body uses shared spacing tokens; thumb still hugs the right inner edge
- [ ] **Mode line**: vim mode changes tint the top accent with a short transition (not a hard snap)
- [ ] **`help`**: intro mentions URL behavior; grouped catalog still matches every visible command

---

Later phases extend this doc with Phase 5+ checklists (content apps, games layer, mobile/a11y, perf).
