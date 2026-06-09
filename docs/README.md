# Documentation

Personal portfolio site ([mrgrey.site](https://mrgrey.site)) built as an in-browser desktop OS — tiling window manager, xterm.js shell, virtual filesystem, games, and a separate mobile brochure.

---

## Start here

| If you are… | Read this |
|-------------|-----------|
| **Hiring / reviewing the project** | [OVERVIEW.md](./OVERVIEW.md) — what it is, why it was built, technical highlights |
| **Using the site** | [USER_GUIDE.md](./USER_GUIDE.md) — keyboard shortcuts, shell commands, tiles |
| **Contributing or extending** | [DEVELOPMENT.md](./DEVELOPMENT.md) — setup, tests, common change recipes |
| **An AI agent or automation** | [AGENTS.md](./AGENTS.md) — repo map, invariants, where to edit what |
| **Changing visuals / themes** | [THEMING.md](./THEMING.md) — colour packs and `--th-*` tokens |
| **Looking up types and APIs** | [API.md](./API.md) — interfaces, storage, commands, events |

---

## Reference

| Document | Contents |
|----------|----------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Module layers, bootstrap order, build chunks, persistence, test map |
| [STYLE_GUIDE.md](./STYLE_GUIDE.md) | TypeScript, CSS, testing, and commit conventions |
| [THEMING.md](./THEMING.md) | `ThemePack` structure and custom property catalogue |
| [API.md](./API.md) | `WindowSpec`, VFS, storage, vim input, events |

---

## Project health (main branch)

| Metric | Value |
|--------|-------|
| Unit tests | **563** across **46** files (`npm test`) |
| E2e smoke | **3** Playwright specs (`npm run test:e2e`) |
| CI | lint → unit tests → build → e2e → GitHub Pages deploy |
| Stack | TypeScript, Vite 8, vanilla DOM — no React/Vue/Svelte |
| Bundle strategy | Lazy `import()` per window tile; Three.js isolated to Rubik chunk |

---

## Repository layout

```
namefailed.github.io/
├── index.html              # Desktop shell entry
├── static/index.html       # Brochure entry (mobile default)
├── src/
│   ├── main.ts             # Desktop bootstrap
│   ├── desktop.ts          # Window manager orchestrator (~340 lines)
│   ├── desktop-*.ts        # WM subsystems (focus, lifecycle, taskbar, …)
│   ├── *-window.ts         # Lazy-loaded tiles
│   ├── commands/           # Shell command registry
│   ├── content/            # Portfolio copy
│   ├── os-*.ts             # Fake OS (VFS, sound, systray)
│   └── static/             # Brochure-only code + CSS
├── docs/                   # ← you are here
├── e2e/                    # Playwright smoke tests
└── .github/workflows/      # CI + Pages deploy
```
