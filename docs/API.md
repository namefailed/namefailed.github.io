# API Reference

Key interfaces and types for extending the portfolio OS.

---

## Window System

### WindowSpec

The contract between terminal commands and the desktop tile system.

```typescript
interface WindowSpec {
  /** Unique tile id — the same CLI again focuses or closes this window */
  command: string
  title: string
  content: string[]
  
  /** Virtual path for `edit` / `vim` (in-browser FS) */
  editorPath?: string
  
  /** Starting directory for `explorer` (vfs path) */
  explorerPath?: string
  
  /** Initial URL for embedded `browse` */
  browserUrl?: string
  
  /** When `command === 'resume'`, ANSI lines plus optional skills aside */
  resumeSkills?: string[]
  
  /** Résumé header lines (name/contact) — paired with resumeBody */
  resumeLead?: string[]
  
  /** PROFILE … certifications — full-width under header row */
  resumeBody?: string[]
  
  /** Thumbnail/metadata list for `projects` tile layout */
  projectCards?: readonly PortfolioProjectEntry[]
}
```

### AppWindowOptions

Used when creating a new window tile.

```typescript
interface AppWindowOptions extends WindowSpec {
  onClose: () => void
  onMinimize: () => void
  onMaximize: () => void
  onFocus: () => void
}
```

### WindowChromeOptions

Factory options for `createWindowChrome()`.

```typescript
interface WindowChromeOptions {
  title: string
  onClose: () => void
  onMinimize: () => void
  onMaximize: () => void
  onFocus?: () => void
  /** When true, focus callback is also attached to titlebar mousedown. Default true. */
  focusOnTitlebar?: boolean
}

interface WindowChromeElements {
  el: HTMLElement           // Container (.app-window)
  titlebar: HTMLElement     // Title bar element
  titleEl: HTMLElement      // Title text span
  btnClose: HTMLElement      // Close button
  btnMin: HTMLElement         // Minimize button
  btnMax: HTMLElement         // Maximize button
}
```

---

## Commands

### Command Interface

```typescript
interface Command {
  /** One-line description shown in help */
  description: string
  
  /** Handler function — receives arguments, returns lines to print */
  run: (args: string[]) => string[]
  
  /** Hidden from `help` listing (e.g., deprecated aliases) */
  hidden?: boolean
  
  /** Fake load time for window-spawning commands (milliseconds) */
  loadMs?: number
}
```

### Registering a Command

Add to `commands/index.ts`:

```typescript
export const commands: Record<string, Command> = {
  mycommand: {
    description: 'Does something useful',
    run: (args) => {
      return ['Output line 1', 'Output line 2']
    },
  },
}
```

For window-spawning commands, return empty array and handle via `desktop.ts`:

```typescript
myapp: {
  description: 'Opens my custom app',
  loadMs: 400,
  run: () => [],
}
```

Then in `desktop.ts` `openWindow()`:

```typescript
case 'myapp': {
  const win = new MyAppWindow({ ... })
  // ... attach to DOM
  return
}
```

---

## Virtual Filesystem

### Node Types

```typescript
type FsDir = { t: 'd'; c: Record<string, FsNode> }
type FsFile = { t: 'f'; body: string }
type FsNode = FsDir | FsFile
```

### Core Operations

```typescript
// Path operations
export function vfsNormalize(input: string): string
export function vfsPwd(): string
export function vfsCd(path: string): string | null  // error or null

// Directory operations
export function vfsLs(path?: string): string[]
export function vfsLsLong(path?: string): VfsLongEntry[]
export function vfsMkdir(path: string): string | null  // error or null

// File operations
export function vfsCat(path: string): string | null  // contents or error
export function vfsTouch(path: string): string | null  // error or null
export function vfsWrite(path: string, body: string): string | null
export function vfsReadRaw(path: string): { ok: true; body: string } | { ok: false; err: string }

// Utility
export function vfsFormatPath(abs: string): string  // /home/namefailed → ~
```

### Usage Example

```typescript
import { vfsCat, vfsWrite, vfsNormalize, FS_HOME } from './os-fs'

// Read file
const content = vfsCat('/home/namefailed/notes.txt')
if (content !== null) {
  console.log(content)
}

// Write file
const err = vfsWrite('notes.txt', 'New content')
if (err) {
  console.error('Write failed:', err)
}

// Normalize path
const abs = vfsNormalize('~/Documents')  // → /home/namefailed/Documents
```

---

## Storage

### Functions

```typescript
/** Get item from localStorage; returns null on any error or if not found */
export function storageGet(key: string): string | null

/** Set item in localStorage; returns true on success, false on error */
export function storageSet(key: string, value: string): boolean

/** Remove item from localStorage; returns true on success, false on error */
export function storageRemove(key: string): boolean

/** Get and parse JSON from localStorage; returns fallback on error or if not found */
export function storageGetJson<T>(key: string, fallback: T): T

/** Stringify and store JSON in localStorage; returns true on success */
export function storageSetJson<T>(key: string, value: T): boolean

/** Get numeric value from localStorage with bounds checking */
export function storageGetNumber(key: string, fallback: number, min?: number, max?: number): number

/** Get boolean from localStorage (parses '1'/'0') */
export function storageGetBool(key: string, fallback: boolean): boolean

/** Store boolean as '1'/'0' */
export function storageSetBool(key: string, value: boolean): boolean
```

### Usage

```typescript
import { storageSet, storageGetJson, storageGetBool } from './storage'

// Simple values
storageSet('my-key', 'value')

// JSON objects
interface Config {
  theme: string
  volume: number
}
const config = storageGetJson<Config>('my-config', { theme: 'mocha', volume: 0.72 })

// Booleans
const enabled = storageGetBool('feature-flag', true)
storageSetBool('feature-flag', false)
```

---

## Themes

### ThemePack Interface

```typescript
export interface ThemePack {
  id: string          // slug used in localStorage and the `theme` command
  label: string       // display name shown in the picker
  terminal: ITheme    // xterm.js colour palette
  matrixRain: string[] // 8 hex colours for matrix rain glyph tints
  css: Record<string, string> // maps every --th-* custom property to a value
}
```

### Theme Control Functions

```typescript
/** Apply named theme; returns false if id is unknown */
export function applyTheme(id: string): boolean

/** Restore the saved pack at boot; falls back to Mocha */
export function initThemeFromStorage(): void

/** Returns the currently applied ThemePack */
export function getActivePack(): ThemePack

/** Returns the current pack id string */
export function getThemeId(): string

/** Returns { id, label }[] for the picker UI */
export function listThemeSummaries(): ReadonlyArray<{ id: string; label: string }>
```

### Adding a Theme

1. Define in `src/theme-packs.ts`:

```typescript
const myThemeCss: Record<string, string> = {
  ...mochaCss,
  '--th-desktop-bg': '#0d1117',
  '--th-accent': '#ff6b6b',
  // ... overrides
}

const myTheme: ThemePack = {
  id: 'my-theme',
  label: 'My Theme',
  terminal: {
    background: '#0d1117',
    foreground: '#c9d1d9',
    // ... xterm palette
  },
  matrixRain: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#dfe6e9', '#74b9ff', '#a29bfe'],
  css: myThemeCss,
}
```

2. Add to `THEME_PACKS` array:

```typescript
export const THEME_PACKS: ThemePack[] = [
  // ... existing themes
  myTheme,
]
```

---

## Vim Input

### VimInput Class

```typescript
export type VimMode = 'insert' | 'normal' | 'visual'

export type InputAction =
  | { type: 'none' }
  | { type: 'rendered' }
  | { type: 'submit'; value: string }
  | { type: 'history'; dir: 'up' | 'down' }
  | { type: 'complete' }
  | { type: 'interrupt' }
  | { type: 'clear' }

export class VimInput {
  mode: VimMode
  
  constructor(onModeChange: (mode: VimMode) => void)
  
  getValue(): string
  setBuffer(text: string): void
  setBufferInsert(text: string): void
  clear(): void
  render(): string
  cursorBack(): number
  handleKey(ev: KeyboardEvent): InputAction
}
```

### Usage

```typescript
import { VimInput } from './vim'

const vim = new VimInput((mode) => {
  console.log('Mode changed to:', mode)
})

// In a keydown handler
const action = vim.handleKey(event)
switch (action.type) {
  case 'submit':
    console.log('Submit:', action.value)
    break
  case 'history':
    console.log('Navigate history:', action.dir)
    break
  case 'complete':
    triggerAutocomplete()
    break
}
```

---

## ANSI Helpers

### ansi.ts

```typescript
/** Convert ANSI escape sequences to HTML */
export function ansiToHtml(input: string): string

/** Convert ANSI to HTML with clickable link detection */
export function ansiToHtmlWithLinks(input: string): string

/** Strip all ANSI escape codes */
export function stripAnsi(input: string): string

/** Theme color helpers */
export const c = {
  pink: '\x1b[35m',
  blue: '\x1b[34m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
}
```

### Usage

```typescript
import { ansiToHtmlWithLinks, c } from './ansi'

const output = [
  `${c.pink}Welcome${c.reset} to the terminal`,
  `${c.dim}Type ${c.blue}help${c.reset}${c.dim} to get started${c.reset}`,
]

const html = output.map(line => ansiToHtmlWithLinks(line)).join('<br>')
```

---

## Event System

### Custom Events

```typescript
// Theme change
window.dispatchEvent(new CustomEvent('mrgrey-theme-change'))

// Matrix rain toggle
document.documentElement.dataset.matrixBg = 'on' | 'off'
```

### Sound

```typescript
import { playOsSound } from './os-sound'

type OsSoundKind = 'focus' | 'click' | 'notify' | 'boot'

playOsSound('focus')   // Window focus
playOsSound('click')   // Button click
playOsSound('notify')  // Toast notification
playOsSound('boot')    // System boot
```

### Toast Notifications

```typescript
import { pushToast } from './os-systray'

pushToast('Message text')                    // Default timeout
pushToast('Message text', 5000)            // 5 second timeout
pushToast('Message text', 0)               // Persistent (manual dismiss)
```

---

## Keyboard Shortcuts

| Chord | Action |
|-------|--------|
| `Ctrl+H` | Focus terminal (← left) |
| `Ctrl+L` | Enter right pane (→) |
| `Ctrl+K` | Previous window (↑) |
| `Ctrl+J` | Next window (↓) |
| `Ctrl+Q` | Close focused window |
| `Ctrl+M` | Minimize focused window |
| `Ctrl+F` | Maximize / restore |
| `Ctrl+1–9` | Activate dock slot N |
| `Ctrl+T` | Focus terminal |
| `Ctrl+D` | Desktop / launcher |

---

## Storage Keys

| Key | Purpose | Module |
|-----|---------|--------|
| `portfolio-vfs-v3-namefailed-home` | VFS tree and cwd | os-fs |
| `mrgrey-theme` | Selected theme id | theme-control |
| `mrgrey-os-sound` | Sound enabled flag | os-sound |
| `mrgrey-os-volume` | Volume level (0–1) | os-sound |
| `mrgrey-retro-fx` | CRT toggle | retro-fx |
| `mrgrey-matrix-bg` | Matrix rain toggle | matrix-bg |
| `mrgrey-browser-iframe-tip-dismiss` | Browser tip dismissed | browser-window |
| `portfolio-fe-prefs-v1` | File explorer prefs | file-explorer |
| `mrgrey-pkgs-v1` | Installed packages | os-packages |

---

## See Also

- [ARCHITECTURE.md](./ARCHITECTURE.md) — Module structure and entry points
- [THEMING.md](./THEMING.md) — Detailed theme customization
- [STYLE_GUIDE.md](./STYLE_GUIDE.md) — Coding standards
