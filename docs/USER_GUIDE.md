# User Guide

How to use the desktop portfolio at [mrgrey.site](https://mrgrey.site).

---

## First visit

1. **Boot splash** plays once (skipped on return visits).
2. **Desktop tiles** on the workspace open portfolio windows when clicked.
3. Press **`Ctrl+T`** or click **Terminal** in the dock to open the shell.
4. Type **`help`** for commands or **`keybinds`** for the full shortcut list.

Mobile visitors (viewport ≤768px) land on the **[brochure](/static/)** automatically — same content, no OS chrome.

---

## Window manager shortcuts

Global chords work while any tile is focused (Ctrl, no Alt/Meta):

| Chord | Action |
|-------|--------|
| `Ctrl+T` | Open or focus **terminal** tile |
| `Ctrl+D` | Toggle **Applications** launcher / show desktop |
| `Ctrl+H` | Focus window **←** (spatial); opens terminal if nothing focused |
| `Ctrl+L` | Focus window **→** |
| `Ctrl+K` | Focus window **↑** |
| `Ctrl+J` | Focus window **↓** |
| `Ctrl+Q` | Close focused window |
| `Ctrl+M` | Minimize focused window |
| `Ctrl+F` | Maximize / restore focused window |
| `Ctrl+1` … `Ctrl+9` | Focus Nth dock slot |
| `Escape` | Close launcher overlay |

Spatial focus picks the nearest window in the chosen direction using on-screen geometry (BSP columns).

---

## Terminal

The terminal uses **xterm.js** with a vim-style input layer (`vim.ts`):

| Key | Action |
|-----|--------|
| `i` | Insert mode |
| `Esc` | Normal mode |
| `v` | Visual mode |
| `Tab` | Command completion |
| `↑` / `↓` | Command history |
| `Ctrl+C` | Cancel / interrupt |
| `Ctrl+U` | Clear to line start |

### Essential commands

| Command | Opens / does |
|---------|----------------|
| `help` | Command summary |
| `help -v` | Full command glossary |
| `keybinds` | Keyboard legend |
| `resume` | Résumé tile |
| `projects` | Projects tile |
| `whoami` | About tile |
| `links` | Contact tile |
| `edit [path]` | Vim-style editor (`~/notes.txt` default) |
| `explorer [path]` | File browser |
| `browse [url]` | Embedded browser |
| `p5` | p5.js sketch viewer |
| `cube` | Rubik's cube (Three.js) |
| `paint` / `snake` / `pong` | Mini-apps |
| `theme [id\|list\|random]` | Switch colour pack |
| `retro on\|off` | CRT scanline overlay |
| `matrix on\|off` | Matrix rain backdrop |
| `ls`, `cat`, `cd`, `mkdir`, `touch`, `rm`, `mv`, `cp` | Virtual filesystem |

Type a command name in the terminal to open its tile, or use the **Applications** launcher (`Ctrl+D`).

---

## Editor tile

Opened via `edit`, `vim`, `editor`, or the launcher. Modal vim over the VFS:

| Mode | Keys |
|------|------|
| Normal | `hjkl`, `w`/`b`/`e`, `dd`/`yy`/`p`, `f`/`F`/`t`/`T`, `>>`/`<<`, `u`, counts |
| Insert | type text; `Esc` or `Ctrl+[` → Normal |
| Ex | `:` then `:w`, `:q`, `:wq`, `:e path`, `:run` |
| Any | `F5` — save and open buffer in **p5 viewer** |

---

## p5.js sketches

Built-in sketches live in `~/sketches/` after first visit. Workflow:

```text
edit ~/sketches/my-sketch.js
# write code, then F5 or :run in editor
```

---

## Themes and effects

| Command | Effect |
|---------|--------|
| `theme list` | Show all seven packs |
| `theme nord` | Apply by id |
| `theme random` | Random pack |
| `retro on` | CRT filter |
| `matrix on` | Matrix rain (also in settings) |

Settings panel (YASB bar) exposes sound, wallpaper, theme, and effect toggles.

---

## Static brochure

Visit **`/static/`** for a scroll-based layout: hero, experience cards, skills, contact — no terminal required. Ideal for mobile and quick scanning.

---

## See also

- [OVERVIEW.md](./OVERVIEW.md) — project architecture for reviewers
- [API.md](./API.md) — extending commands and tiles
- In-app: `help keybinds` and `help theme`
