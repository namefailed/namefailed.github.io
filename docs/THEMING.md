# Theming

Seven colour packs selectable at runtime via the `theme` shell command or the settings panel. Each pack is a self-contained object — no separate CSS files, no build step.

**See also:** [API.md](./API.md#themes) · [ARCHITECTURE.md](./ARCHITECTURE.md) · [USER_GUIDE.md](./USER_GUIDE.md#themes-and-effects)

## ThemePack interface

```ts
export interface ThemePack {
  id: string          // slug used in localStorage and the `theme` command
  label: string       // display name shown in the picker
  terminal: ITheme    // xterm.js colour palette
  matrixRain: string[]// 8 hex colours for matrix rain glyph tints
  css: Record<string, string> // maps every --th-* custom property to a value
}
```

Defined in `src/theme-packs.ts`. Exported as `THEME_PACKS: ThemePack[]`.

## terminal (ITheme)

Standard 16-colour ANSI palette plus xterm extras. Required keys:

| Key | Purpose |
|-----|---------|
| `background` | Terminal canvas background |
| `foreground` | Default text colour |
| `cursor` | Cursor block fill |
| `cursorAccent` | Text colour under cursor |
| `black` … `white` | ANSI 0–7 |
| `brightBlack` … `brightWhite` | ANSI 8–15 |
| `selectionBackground` | Selection highlight |
| `selectionInactiveBackground` | Selection when terminal unfocused |

`theme-control.ts` calls `terminal.options.theme = pack.terminal` when a pack is applied.

## matrixRain

An array of **8 hex strings**. `matrix-bg.ts` cycles through these to tint individual glyph columns. Pick colours from the palette's bright range so they read over the dark desktop background.

```ts
const exampleRain = [
  '#f5c2e7', '#cba6f7', '#89b4fa', '#a6e3a1',
  '#f9e2af', '#f5e0dc', '#94e2d5', '#fab387',
]
```

## css — custom property reference

Every `--th-*` property must be present in `css`. Packs typically spread `mochaCss` and override only the values that differ:

```ts
const myPackCss: Record<string, string> = {
  ...mochaCss,
  '--th-desktop-bg': '#0d1117',
  // ... only the overrides
}
```

### Backgrounds and surfaces

| Property | Used by |
|----------|---------|
| `--th-body-bg` | `<body>` background (outermost layer, visible past the monitor frame) |
| `--th-monitor-bg` | `#monitor-frame` CRT bezel gradient |
| `--th-desktop-bg` | `#desktop` tiling area fill |
| `--th-surface0` | Cards, hover states, raised elements |
| `--th-surface1` | Primary panel backgrounds |
| `--th-mantle` | Slightly lighter than desktop; used for inset areas |
| `--th-overlay-rgb` | Raw R,G,B for CSS `rgba()` compositing — no `#` prefix |

### Text

| Property | Used by |
|----------|---------|
| `--th-text` | Primary text |
| `--th-text-muted` | Secondary / helper text |
| `--th-subtext` | Dimmed labels, placeholders |

### Accent and blue

| Property | Used by |
|----------|---------|
| `--th-accent` | Highlight colour — section titles, active borders, cursor |
| `--th-accent-rgb` | Raw R,G,B for `rgba()` compositing |
| `--th-blue-rgb` | Secondary highlight; raw R,G,B |

### YASB status bar

| Property | Used by |
|----------|---------|
| `--th-yasb-bg` | Bar background gradient |
| `--th-yasb-btn-bg` | Button resting state |
| `--th-yasb-btn-hover-bg` | Button hover state |
| `--th-yasb-btn-text` | Button label colour |
| `--th-yasb-clock` | Clock/date text colour |

### Launcher overlay

| Property | Used by |
|----------|---------|
| `--th-launcher-backdrop` | Scrim behind the launcher panel |
| `--th-launcher-panel` | Panel background |
| `--th-launcher-input-bg` | Search input resting fill |
| `--th-launcher-input-bg-focus` | Search input focused fill |

### Matrix rain

| Property | Used by |
|----------|---------|
| `--th-matrix-fade` | Per-frame fade overlay colour (controls trail length) |
| `--th-matrix-g1` | Gradient stop 1 (lightest) |
| `--th-matrix-g2` | Gradient stop 2 |
| `--th-matrix-g3` | Gradient stop 3 (darkest, matches desktop) |

### Splitters (BSP tiling)

| Property | Used by |
|----------|---------|
| `--th-splitter-idle` | Column / row drag handle at rest |
| `--th-splitter-hover` | Handle on hover / active drag |

Note: legacy horizontal terminal splitter CSS was removed; splitters are BSP-only (`.splitter-v`, `.splitter-bsp-h`).

### Dock and icons

| Property | Used by |
|----------|---------|
| `--th-dock-bg` | Floating dock background |
| `--th-icon-hover-bg` | Icon hover background |
| `--th-icon-glyph-start` | Icon glyph gradient start |
| `--th-icon-glyph-end` | Icon glyph gradient end |

### Window chrome

| Property | Used by |
|----------|---------|
| `--th-win-border` | Window tile outer border |
| `--th-titlebar-border` | Title bar separator line |
| `--th-dot-close` | Close button dot colour |
| `--th-dot-min` | Minimise button dot colour |
| `--th-dot-max` | Maximise button dot colour |

### Vim mode badges

| Property | Used by |
|----------|---------|
| `--th-badge-insert` | INSERT mode badge background |
| `--th-badge-normal` | NORMAL mode badge background |
| `--th-badge-visual` | VISUAL mode badge background |
| `--th-badge-fg` | Badge text colour (all modes) |

### Scrollbar

| Property | Used by |
|----------|---------|
| `--th-scroll-thumb` | Scrollbar thumb |
| `--th-scroll-thumb-hover` | Scrollbar thumb on hover |

## Available packs

| id | Label |
|----|-------|
| `mocha` | Catppuccin Mocha (default) |
| `dracula` | Dracula |
| `nord` | Nord |
| `gruvbox` | Gruvbox Dark |
| `tokyo-night` | Tokyo Night |
| `solarized` | Solarized Dark |
| `one-dark` | One Dark |

## Adding a pack

1. Define `*Terminal: ITheme`, `*Rain: string[]`, and `*Css: Record<string, string>` in `src/theme-packs.ts`.
2. Spread `mochaCss` into `*Css` and override only what differs.
3. Add an entry to the `THEME_PACKS` array at the bottom of the file.
4. The settings panel picker and `theme list` pick it up automatically — no other files need changing.

## theme-control.ts

| Export | What it does |
|--------|-------------|
| `applyTheme(pack)` | Sets all `--th-*` vars on `document.documentElement`, updates xterm palette, saves id to `localStorage` |
| `initThemeFromStorage()` | Restores the saved pack at boot; falls back to Mocha |
| `getActivePack()` | Returns the currently applied `ThemePack` |
| `getThemeId()` | Returns the current pack `id` string |
| `listThemeSummaries()` | Returns `{ id, label }[]` for the picker UI |

## theme shell command

```
theme               # show current theme
theme list          # list all packs
theme <id>          # apply pack by id (e.g. theme nord)
theme random        # pick a random pack
```

Selection persists across page loads via `localStorage`.
