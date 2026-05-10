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

---

Later phases extend this doc with Phase 2+ checklists.
