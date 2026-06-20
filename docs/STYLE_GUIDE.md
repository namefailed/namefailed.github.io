# Style Guide

Coding standards for the portfolio codebase. For AI agent workflows see [AGENTS.md](./AGENTS.md). For setup see [DEVELOPMENT.md](./DEVELOPMENT.md).

---

## TypeScript

### General

- **No `any`**. Use `unknown` if the type is truly unknown, then narrow with type guards.
- **Strict null checks**. Always handle `null` and `undefined` explicitly.
- **Prefer `const` and `let`**. Never use `var`.
- **Explicit return types** on public functions. Private/internal functions can infer.

### Types and Interfaces

```typescript
// Prefer interfaces for object shapes
interface WindowOptions {
  onClose: () => void
  onMinimize: () => void
}

// Use type aliases for unions, complex types
type EditMode = 'normal' | 'insert' | 'cmd'
type PendingOp = 'd' | 'c' | 'y'

// Export types that cross module boundaries
export type { WindowOptions, EditMode }
```

### Classes

```typescript
export class Example {
  // Public properties (no underscore)
  readonly el: HTMLElement
  
  // Private properties (no underscore, rely on TypeScript)
  private mode: EditMode = 'normal'
  private buffer = ''
  
  // Static constants
  private static readonly MAX_HISTORY = 50
  
  constructor(opts: WindowOptions) {
    // Initialize inline where possible
  }
  
  // Public methods
  focus(): void {
    this.syncFocus()
  }
  
  // Private methods — verb-first naming
  private syncFocus(): void {
    // implementation
  }
}
```

### Functions

```typescript
// Verb-first naming for actions
function mountComponent(): void
function renderOutput(): string[]
function playNotificationSound(): void

// Utility functions — descriptive names
function escapeHtml(input: string): string
function debounce<T extends (...args: any[]) => void>(fn: T, ms: number): T

// Async functions — explicit Promise return
async function loadConfig(): Promise<Config>

// Avoid boolean trap — prefer object parameter
function setEnabled(opts: { on: boolean; persist?: boolean }): void
// NOT: function setEnabled(on: boolean, persist?: boolean)
```

---

## File Organization

### Naming

| Pattern | Example | Use Case |
|---------|---------|----------|
| `kebab-case.ts` | `browser-window.ts` | Module files |
| `*.test.ts` | `storage.test.ts` | Test files (co-located) |
| `*.d.ts` | — | Type declarations (if needed) |

### Imports

```typescript
// 1. External dependencies first
import { Terminal } from '@xterm/xterm'

// 2. Absolute project imports (with @/ alias where configured)
import { storageGet, storageSet } from './storage'
import type { WindowSpec } from './appwindow'

// 3. Relative imports within same directory
import { buildResumeSkills } from './resume-copy'

// Group related imports
import {
  vfsPwd,
  vfsLs,
  vfsCat,
  type VfsNode,
} from './os-fs'
```

---

## CSS

### Custom Properties (Design Tokens)

Use the existing token system. Don't hardcode values.

```css
/* ✅ Correct */
.my-element {
  padding: var(--ui-space-3);
  border-radius: var(--ui-radius-sm);
  background: rgba(var(--th-overlay-rgb), 0.42);
}

/* ❌ Incorrect */
.my-element {
  padding: 12px;
  border-radius: 6px;
  background: rgba(30, 30, 46, 0.42);
}
```

### Available Tokens

**Spacing**: `--ui-space-1` through `--ui-space-6`
**Border radius**: `--ui-radius-sm`, `--ui-radius-md`, `--ui-radius-lg`
**Duration**: `--ui-duration-fast`, `--ui-duration-normal`, `--ui-duration-slow`
**Easing**: `--ui-easing-out`, `--ui-easing-out-back`

### Naming Conventions

```css
/* Component prefix */
.browser-toolbar { }
.fe-icon-btn { }     /* fe = file-explorer */
.snake-hud { }

/* State suffixes */
.btn--primary { }    /* modifier */
.win-line--hang { } /* variant */
.is-active { }       /* JS toggle */
.has-error { }       /* JS toggle */
```

### Container Queries

Use container queries for component-level responsive behavior:

```css
.my-component {
  container-type: inline-size;
  container-name: myComponent;
}

@container myComponent (max-width: 400px) {
  .my-component > .child {
    flex-direction: column;
  }
}
```

---

## Error Handling

### localStorage

Always use the `storage.ts` wrapper:

```typescript
import { storageGet, storageSet, storageGetJson } from './storage'

// Returns null on failure
const value = storageGet('key')

// Returns fallback on failure
const config = storageGetJson<Config>('config', {})
```

### DOM Queries

Use non-null assertion (`!`) only when element is guaranteed by HTML structure:

```typescript
// ✅ OK — element exists in static HTML
const terminal = document.getElementById('terminal')!

// ❌ Dangerous — check or handle null
const maybe = document.getElementById('maybe')
if (maybe) {
  maybe.classList.add('active')
}
```

### Try/Catch

Keep error handling minimal. Most errors are silently ignored (e.g., localStorage in private mode):

```typescript
function save(): void {
  storageSet('key', value) // Already handles errors internally
}
```

---

## Testing

### Test File Location

Co-locate with source: `module.ts` → `module.test.ts`

### Test Structure

```typescript
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { VimInput } from './vim'

describe('VimInput', () => {
  let vim: VimInput
  
  beforeEach(() => {
    vim = new VimInput(() => {})
  })
  
  describe('mode transitions', () => {
    it('switches to normal mode on Escape', () => {
      vim.handleKey(keyEvent('Escape'))
      expect(vim.mode).toBe('normal')
    })
  })
  
  describe('operators', () => {
    it('deletes word with dw', () => {
      vim.setBuffer('hello world')
      vim.handleKey(keyEvent('Escape'))
      vim.handleKey(keyEvent('d'))
      vim.handleKey(keyEvent('w'))
      expect(vim.getValue()).not.toContain('hello')
    })
  })
})
```

### Mocking

Mock DOM globals for Node environment:

```typescript
// @ts-expect-error mock for tests
;(globalThis as unknown as { localStorage: Storage }).localStorage = new MockStorage()
```

---

## Comments

### JSDoc

Use JSDoc for public APIs:

```typescript
/**
 * Safe localStorage wrapper with error handling.
 * Returns null on any error or if key not found.
 */
export function storageGet(key: string): string | null

/**
 * Create standard window chrome with titlebar and traffic light buttons.
 * @param opts - Window configuration and callbacks
 * @returns Container element and references to interactive parts
 */
export function createWindowChrome(opts: WindowChromeOptions): WindowChromeElements
```

### Inline Comments

Explain the *why*, not the *what*:

```typescript
// ✅ Good — explains rationale
// Debounce saves to reduce localStorage writes during rapid operations
const SAVE_DEBOUNCE_MS = 150

// ❌ Redundant — code is self-explanatory
// Set the timeout to 150 milliseconds
```

---

## Performance

### localStorage

- Debounce writes (see `os-fs.ts`: 150ms debounce)
- Read once at module init, cache in memory
- Use `storage.ts` wrapper (handles errors, private mode)

### Canvas Animations

- Pause on `document.hidden` (see `matrix-bg.ts`)
- Check `shouldRun()` before each frame
- Cancel animation frames on cleanup

### Event Listeners

- Use `AbortController` or manual cleanup in `destroy()` methods
- Debounce resize handlers
- Use `ResizeObserver` for element-level changes (not window resize)

```typescript
const ro = new ResizeObserver(() => this.layout())
ro.observe(this.el)

// Cleanup
destroy(): void {
  ro.disconnect()
}
```

---

## Accessibility

### Keyboard

- All interactive elements must be keyboard accessible
- Document shortcuts in YASB settings panel
- Use `:focus-visible` for focus rings (not `:focus`)

### Screen Readers

- Use `aria-label` for icon-only buttons
- Use `aria-hidden="true"` for decorative icons
- Provide `role` for custom widgets

```typescript
const btn = document.createElement('button')
btn.setAttribute('aria-label', 'Close window')
btn.innerHTML = '<span class="dot dot-close" aria-hidden="true"></span>'
```

### Reduced Motion

Respect `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: reduce) {
  .animated-element {
    animation: none;
    transition: none;
  }
}
```

---

## Git Commits

### Message Format

```
Subject line (50 chars max)

Body explaining what and why (wrap at 72 chars)

- Bullet points for details
- Another point if needed
```

### Examples

```
Fix resume narrow layout: photo on top, narrative below

When resume window shrinks to narrow width (<679px), the layout now
stacks vertically instead of side-by-side:
- Photo: full-width centered on top
- Narrative: full-width below photo
- Skills: full-width at bottom

This eliminates the gap that previously appeared when the photo stayed
in a side column while skills fell below.
```

```
Add storage.ts: centralized localStorage wrapper

- Replaces try/catch boilerplate across 8 files
- Provides typed JSON helpers (storageGetJson, storageSetJson)
- Handles private mode gracefully (returns fallback)
- Adds comprehensive test suite (20 tests)
```

---

## Documentation

Keep docs in `docs/` updated when making architectural changes:

| Doc | Update when… |
|-----|----------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | New modules, bootstrap changes, persistence keys |
| [API.md](./API.md) | Public types, extension points |
| [AGENTS.md](./AGENTS.md) | New invariants, storage keys, file-map changes |
| [USER_GUIDE.md](./USER_GUIDE.md) | New commands or keybinds |
| [THEMING.md](./THEMING.md) | New themes or `--th-*` tokens |
| [README.md](../README.md) | Test counts, stack versions, deploy notes |

When adding modules, update the relevant tables — do not leave docs stale.

---

## Common Pitfalls

### ❌ Don't

```typescript
// Don't use any
function process(data: any): any

// Don't ignore errors silently without comment
try {
  riskyOperation()
} catch {
  // empty
}

// Don't hardcode magic numbers
if (width < 679) { }

// Don't use innerHTML with dynamic content (XSS risk)
el.innerHTML = userInput
```

### ✅ Do

```typescript
// Use unknown + type guard
function process(data: unknown): Output {
  if (isValidInput(data)) { /* ... */ }
}

// Document why error is safe to ignore
try {
  localStorage.setItem(key, value)
} catch {
  /* private mode — persistence not possible */
}

// Use named constants
const NARROW_BREAKPOINT = 679
if (width < NARROW_BREAKPOINT) { }

// Use textContent or escape HTML
el.textContent = userInput
el.innerHTML = escapeHtml(userInput)
```

## Tooling

- `npm run lint` — ESLint (TypeScript, e2e specs, maintainer scripts)
- `npm test` — **615** Vitest unit tests (60 files)
- `npm run test:coverage` — Vitest v8 coverage (`coverage/` gitignored)
- `npm run test:e2e` — Playwright smoke against `vite preview`
- Desktop CSS: `src/styles/*.css` via `src/style.css` hub; regenerate with `node scripts/split-style-css.mjs`

---

## Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [Vite Docs](https://vitejs.dev/guide/)
- [Vitest Docs](https://vitest.dev/guide/)
- [Container Queries](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Container_Queries)
