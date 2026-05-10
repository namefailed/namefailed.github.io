# How I wired mrgrey.dev

This repo is a **static SPA**—Vite ships my TypeScript straight to the browser; there’s no backend for the UI. I framed the whole portfolio as a **fake desktop OS**: tiling windows, a real terminal (xterm.js), themes, plus a few playful layers I wrote on top (fake filesystem, `apt` joke, UI sounds).

---

## Startup (`src/main.ts`)

This order matters when I’m debugging “why does X look wrong on first paint?”:

1. **`initThemeFromStorage` / `initRetroFxFromStorage`** — I read Catppuccin (or whatever I saved) and CRT flags from `localStorage` before the terminal picks colors.
2. **`initOsSound` / `initSystray`** — sound toggle + clock menu + toasts.
3. **`initMatrixBg`** — optional canvas rain behind `#desktop`; I skip work if there’s no canvas.
4. I construct **`Desktop`** before **`TerminalApp`** so `fitTerminal` can close over the live app instance; the terminal gets `openWindow` from my desktop.
5. **`app.mount()`** — opens xterm, runs my boot sequence, hooks keys.

---

## Shell layout (`index.html` + `style.css`)

- **`#monitor-frame`** — the CRT bezel; I pad it with safe-area insets so notched phones don’t clip me.
- **`#desktop`** — wallpaper + matrix canvas; underneath that it’s **status bar → wm-stack → dock**.
- **`#yasb-bar`** — Applications button, focused window title, clock (opens my system menu) + toasts.
- **`#panes`** — row flex: **terminal** | **splitter** | **right pane** (stacked apps).
- **`#wm-taskbar`** — dock; I keep its order in sync with the launcher grid / Ctrl+number.

**Narrow screens (`max-width: 720px`):** I stack `#panes` in a **column**—terminal on top with a capped height, I hide the horizontal splitter (resizing width stops making sense), content fills below. I still use Pointer Events for splitters on larger widths.

---

## Window manager (`src/desktop.ts`)

- **`AppWindow`** — static tiles: I render ANSI lines to HTML (`ansi.ts`).
- **`EditorWindow`** — my mini-vim editor over the fake FS (`editor-window.ts`).
- **`splitter.ts`** — Pointer Events so I can drag handles with **mouse or touch**.
- **Ctrl shortcuts** — I grab them in the capture phase so xterm doesn’t eat WM keys.
- **`setDesktopRef`** — I stash `this` so `ps` and friends can see open windows without circular imports.

---

## Terminal (`src/terminal.ts` + `src/vim.ts`)

- xterm + Fit + Web Links.
- My **prompt vim modes** (`vim.ts`) are separate from the **`edit` app**’s editor—I didn’t want them coupled.
- **`commands/index.ts`** returns output lines for most commands; **`execute`** special-cases the interactive stuff (`theme`, `sound`, `reboot`, …) and routes window commands to `onOpenWindow`.

---

## Fake OS bits I added

| Module | What I use it for |
|--------|-------------------|
| `os-fs.ts` | `localStorage` tree; `cd`, `cat`, `vfsWrite`, … |
| `os-registry.ts` | Pointer to the live `Desktop` for `ps`. |
| `os-sound.ts` | Web Audio bleeps; on/off persisted. |
| `os-packages.ts` / `os-apt.ts` | `cowsay` / `apt` jokes. |
| `os-systray.ts` | Toasts + clock menu; I call `syncSettingsSoundToggle` after the `sound` CLI. |

---

## Themes & FX (`theme*.ts`, `retro-fx.ts`, `matrix-bg.ts`)

- Packs live in **`theme-packs.ts`**; **`theme-control.ts`** writes CSS variables onto `<html>`.
- **Retro** — I toggle classes on `<html>` for scanlines / vignette stuff.
- **Matrix** — I draw on `#matrix-bg` and resize with the desktop.

---

## Content (`src/content/portfolio.ts`, `ascii.ts`)

My bio copy and ASCII art live here; **`commands`** pulls them into `about`, `skills`, etc.

---

## Build

- **`npm run build`** — `tsc`, then Vite → **`dist/`**.
- **`npm run dev`** — Vite with strict TS.

---

## Things I try not to break

- **7px rhythm** — `.wm-stack` padding; splitters are **7px** wide. I set `#right-pane { gap: 0 }` so I don’t double-stack gap + splitter (vertical spacing then matches the horizontal splitter).
- **Window command lists** — I keep **`terminal.ts` `WINDOW_COMMANDS`**, **`desktop.ts` `WINDOW_COMMANDS`**, and launcher icons aligned or things silently drift.
- **a11y** — launcher `aria-*`, dialog role on the settings panel, `visually-hidden` labels where I hide text visually.

---

## What I touch most when I change behavior

| If I’m adding… | I usually edit… |
|----------------|-----------------|
| Terminal command | `commands/index.ts`, sometimes `terminal.ts` |
| Tiled window | `commands/index.ts`, `desktop.ts` sets, maybe `index.html` icons |
| Look & feel | `style.css`, `theme-packs.ts` |
| Fake FS | `os-fs.ts` |

I wrote this note for **future me**—if I change how something works, I should update this file too.
