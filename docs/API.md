# API Reference

Interfaces and extension points for the portfolio OS. For step-by-step recipes see [DEVELOPMENT.md](./DEVELOPMENT.md) and [AGENTS.md](./AGENTS.md).

---

## Window system

### WindowSpec

Contract between shell commands and the desktop tile system (`appwindow.ts`).

```typescript
interface WindowSpec {
  /** Unique tile id — same CLI again focuses or toggles this window */
  command: string
  title: string
  content: string[]

  editorPath?: string       // edit / vim / editor
  explorerPath?: string     // explorer starting directory
  browserUrl?: string       // browse initial URL
  resumeSkills?: string[]   // resume tile aside
  resumeLead?: string[]
  resumeBody?: string[]
  projectCards?: readonly PortfolioProjectEntry[]
  p5SketchPath?: string     // p5 viewer VFS path
}
```

Build specs from command names: `windowSpecForCommand()` in `desktop-window-spec.ts`.

### Opening tiles

Flow:

1. Terminal runs command → `app-commands` returns `[]`
2. `terminal.ts` calls `getDesktopRef().openWindow(spec)`
3. `desktop.ts` → `dispatchOpenWindow()` in `desktop-open-window.ts`
4. Dynamic `import('./foo-window')` → mount via `BspLayout`

Do **not** instantiate tiles from command handlers directly.

### WindowChromeOptions

```typescript
interface WindowChromeOptions {
  title: string
  onClose: () => void
  onMinimize: () => void
  onMaximize: () => void
  onFocus?: () => void
  focusOnTitlebar?: boolean  // default true
}

interface WindowChromeElements {
  el: HTMLElement
  titlebar: HTMLElement
  titleEl: HTMLElement
  btnClose: HTMLElement
  btnMin: HTMLElement
  btnMax: HTMLElement
}
```

Factory: `createWindowChrome()` in `window-chrome.ts`.

### TiledWin

Union of all tile classes (`desktop-open-window.ts`):

```typescript
type TiledWin =
  | AppWindow | EditorWindow | FileExplorerWindow | BrowserWindow
  | PaintWindow | SnakeWindow | PongWindow | RubikWindow | P5Window
  | TerminalWindow
```

Each tile exposes: `el`, `command`, `onFocus`, `setActive()`, `setMinimized()`, `isMaximized()`, etc.

---

## Commands

### Command interface

```typescript
interface Command {
  description: string
  run: (args: string[]) => string[]
  hidden?: boolean
  loadMs?: number   // fake delay for tile commands
}
```

Registry: `commands/index.ts` merges `vfsCommands`, `systemCommands`, `appCommands`.

### Register a text command

```typescript
// commands/system-commands.ts
export const systemCommands = {
  hello: {
    description: 'Says hello',
    run: args => [`Hello, ${args[0] ?? 'world'}!`],
  },
}
```

### Register a tile command

```typescript
// commands/app-commands.ts
myapp: {
  description: 'Opens my app tile',
  loadMs: 400,
  run: () => [],   // required — desktop opens the tile
},
```

Then add dispatch in `desktop-open-window.ts` and launcher entries in `launcher-catalog.ts`.

---

## Virtual filesystem

### Node types

```typescript
type FsDir = { t: 'd'; c: Record<string, FsNode> }
type FsFile = { t: 'f'; body: string }
type FsNode = FsDir | FsFile
```

Storage key: **`portfolio-vfs-v8-namefailed-home`** (`os-fs.ts`).

### Core operations

```typescript
vfsNormalize(input: string): string
vfsPwd(): string
vfsCd(path: string): string | null
vfsLs(path?: string): string[]
vfsLsLong(path?: string): VfsLongEntry[]
vfsCat(path: string): string | null
vfsTouch(path: string): string | null
vfsWrite(path: string, body: string): string | null
vfsReadRaw(path: string): { ok: true; body: string } | { ok: false; err: string }
vfsFormatPath(abs: string): string   // /home/namefailed → ~
vfsMkdir(path: string): string | null
```

Debounced save: **150 ms** after mutations.

---

## Storage

Always use `storage.ts` — never raw `localStorage` in new code.

```typescript
storageGet(key: string): string | null
storageSet(key: string, value: string): boolean
storageRemove(key: string): boolean
storageGetJson<T>(key: string, fallback: T): T
storageSetJson<T>(key: string, value: T): boolean
storageGetNumber(key: string, fallback: number, min?: number, max?: number): number
storageGetBool(key: string, fallback: boolean): boolean
storageSetBool(key: string, value: boolean): boolean
```

### Keys reference

| Key | Module |
|-----|--------|
| `portfolio-vfs-v8-namefailed-home` | `os-fs.ts` |
| `mrgrey-theme` | `theme-control.ts` |
| `mrgrey-os-sound` / `mrgrey-os-volume` | `os-sound.ts` |
| `mrgrey-retro-fx` | `retro-fx.ts` |
| `mrgrey-matrix-bg` | `matrix-bg.ts` |
| `mrgrey-wallpaper` | `wallpaper.ts` |
| `mrgrey-desktop-tile-positions-v6` | `desktop-tiles.ts` |
| `portfolio-fe-prefs-v1` | `file-explorer-window.ts` |
| `mrgrey-browser-iframe-tip-dismiss` | `browser-window.ts` |
| `mrgrey-boot-seen` | `boot-splash.ts` |
| `mrgrey-guide-seen` | `welcome-guide.ts` |
| `mrgrey-toasts-seen` | `intro-toasts.ts` |
| `mrgrey-hint-<id>` | `hint-bubbles.ts` |
| `mrgrey-p5-tip-seen` | `p5-window.ts` |
| `mrgrey-pkgs-v1` | `os-packages.ts` |

Full table: [AGENTS.md](./AGENTS.md#localstorage-keys-authoritative).

---

## Themes

### ThemePack

```typescript
interface ThemePack {
  id: string
  label: string
  terminal: ITheme           // xterm.js palette
  matrixRain: string[]       // 8 hex colours
  css: Record<string, string> // all --th-* properties
}
```

### Control functions

```typescript
applyTheme(id: string): boolean
initThemeFromStorage(): void
getActivePack(): ThemePack
getThemeId(): string
listThemeSummaries(): ReadonlyArray<{ id: string; label: string }>
```

Adding a pack: [THEMING.md](./THEMING.md).

---

## Vim input (terminal)

`vim.ts` — one-line shell editor (separate from editor tile).

```typescript
type VimMode = 'insert' | 'normal' | 'visual'

type InputAction =
  | { type: 'none' }
  | { type: 'rendered' }
  | { type: 'submit'; value: string }
  | { type: 'history'; dir: 'up' | 'down' }
  | { type: 'complete' }
  | { type: 'interrupt' }
  | { type: 'clear' }

class VimInput {
  mode: VimMode
  handleKey(ev: KeyboardEvent): InputAction
  getValue(): string
  setBuffer(text: string): void
  // ...
}
```

---

## Editor vim ops (tile)

Pure functions in `editor-vim-ops.ts` — safe to unit test without DOM:

```typescript
lineCountTotal(text: string): number
getLineCol(text: string, pos: number): { line: number; col: number }
moveVertPos(text: string, pos: number, delta: -1 | 1): number
moveHorizPos(text: string, pos: number, delta: -1 | 1, steps?: number): number
wordForwardPos / wordBackPos / wordEndForwardPos
findNextOnLine(text, kind, ch, fromPos): number | null
deleteLineBlockText / yankLineBlockText / joinLinesText / pasteYankText
// ...
```

Key chords: `editor-vim-keys.ts` — `insertModeKeyAction`, `tryAppendCountDigit`.

Ex commands: `parseEditorExCommand()` in `editor-ex-commands.ts`.

---

## ANSI

```typescript
ansiToHtml(input: string): string
ansiToHtmlWithLinks(input: string): string
stripAnsi(input: string): string

const c = { pink, blue, green, yellow, red, cyan, white, dim, bold, reset }
```

---

## Events & sound

### Custom events

| Event | Detail |
|-------|--------|
| `mrgrey-theme-change` | none |
| `mrgrey-wallpaper-change` | `string \| null` URL |
| `mrgrey-first-window` | none |
| `mrgrey-terminal-cmd` | none |

### Sound

```typescript
playOsSound('focus' | 'click' | 'notify' | 'boot')
```

### Toasts

```typescript
pushToast(message: string, timeoutMs?: number)  // 0 = persistent
```

---

## WM keyboard API

Host interface for `desktop-keyboard-handler.ts`:

```typescript
interface DesktopKeyboardHost {
  openTerminal(): void
  focusTaskbarIndex(index: number): void
  focusSpatial(dir: 'h' | 'j' | 'k' | 'l'): void
  closeFocusedOrTerminal(): void
  minimizeFocusedOrTerminal(): void
  toggleMaximizeFocused(): void
  toggleShowDesktop(): void
}
```

Chord table: [USER_GUIDE.md](./USER_GUIDE.md).

---

## OS registry

Breaks circular import between terminal and desktop:

```typescript
// os-registry.ts
setDesktopRef(desktop: Desktop): void
getDesktopRef(): Desktop | null
```

Called once from `Desktop` constructor.

---

## See also

- [ARCHITECTURE.md](./ARCHITECTURE.md) — module map
- [DEVELOPMENT.md](./DEVELOPMENT.md) — setup & workflows
- [AGENTS.md](./AGENTS.md) — machine-oriented guide
- [THEMING.md](./THEMING.md) — CSS token catalogue
