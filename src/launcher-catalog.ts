/**
 * Launcher grid + dock membership + lazy chunk warmup.
 * Lives outside `desktop.ts` so tuning “what appears in Applications vs dock” isn’t buried in WM logic.
 */

/** Title bar strings for tiled portfolio commands — centralised so bar + help don’t drift */
export function tileTitleForPortfolioCommand(cmd: string): string {
  switch (cmd) {
    case 'links':
      return 'contact · outbound'
    case 'resume':
      return 'résumé · skills'
    case 'projects':
      return 'work & roadmap'
    case 'whoami':
      return 'about me · personal'
    default:
      return cmd
  }
}

/** Same set as `terminal.ts` WINDOW_COMMANDS — opens a right-pane tile */
export const TILED_WINDOW_COMMANDS = new Set([
  'resume',
  'links',
  'projects',
  'whoami',
  'edit',
  'editor',
  'vim',
  'explorer',
  'browse',
  'paint',
  'cube',
  'snake',
  'pong',
])

/** Treat these as the editor tile for prefetch + focus heuristics */
export const EDITOR_LAUNCH_ALIASES = new Set(['edit', 'editor', 'vim'])

export const TERMINAL_TILE_SENTINEL = '__terminal__'

/** Grid entries: terminal shortcut + every app the shell can open */
export const LAUNCHER_ICON_ROWS: ReadonlyArray<
  | { kind: 'terminal'; label: string; glyph: string }
  | { kind: 'app'; cmd: string; label: string; glyph: string }
> = [
  { kind: 'terminal', label: 'Terminal', glyph: '~' },
  { kind: 'app', cmd: 'browse', label: 'Browse', glyph: 'w' },
  { kind: 'app', cmd: 'explorer', label: 'Files', glyph: '▣' },
  { kind: 'app', cmd: 'edit', label: 'Editor', glyph: 'E' },
  { kind: 'app', cmd: 'resume', label: 'Resume', glyph: 'R' },
  { kind: 'app', cmd: 'projects', label: 'Projects', glyph: '{}' },
  { kind: 'app', cmd: 'whoami', label: 'About me', glyph: '☺' },
  { kind: 'app', cmd: 'links', label: 'Contact', glyph: '✉' },
  { kind: 'app', cmd: 'paint', label: 'Paint', glyph: '◐' },
  { kind: 'app', cmd: 'cube', label: 'Cube', glyph: '▦' },
  { kind: 'app', cmd: 'snake', label: 'Snake', glyph: '≈' },
  { kind: 'app', cmd: 'pong', label: 'Pong', glyph: '◎' },
]

/** Commands omitted from dock pills — still in Applications grid */
export const DOCK_HIDDEN_COMMANDS = new Set(['paint', 'snake', 'pong', 'cube'])

export function dockPinnedCommandSet(): Set<string> {
  const s = new Set<string>()
  for (const item of LAUNCHER_ICON_ROWS) {
    if (item.kind === 'app' && !DOCK_HIDDEN_COMMANDS.has(item.cmd)) s.add(item.cmd)
  }
  return s
}

/** Hover/focus on launcher row → kick dynamic import before click */
export function prefetchLazyWindowModule(invokedCmd: string): void {
  const cmd = EDITOR_LAUNCH_ALIASES.has(invokedCmd) ? 'edit' : invokedCmd
  switch (cmd) {
    case 'browse':
      void import('./browser-window')
      return
    case 'explorer':
      void import('./file-explorer-window')
      return
    case 'edit':
      void import('./editor-window')
      return
    case 'paint':
      void import('./paint-window')
      return
    case 'snake':
      void import('./snake-window')
      return
    case 'pong':
      void import('./pong-window')
      return
    default:
      return
  }
}

export function attachLazyPrefetchHandlers(el: HTMLElement, invokedCmd: string): void {
  const run = (): void => prefetchLazyWindowModule(invokedCmd)
  el.addEventListener('pointerenter', run, { passive: true })
  el.addEventListener('focusin', run)
}
