/**
 * Terminal theme facade: re-exports the runtime theme controls and provides a
 * static Catppuccin Mocha `theme` for xterm to use before initThemeFromStorage
 * runs, plus the `c` ANSI escape helpers used across CLI output.
 */
import type { ITheme } from '@xterm/xterm'
import { THEME_PACKS } from './theme-packs'
export {
  getActiveTerminalTheme,
  initThemeFromStorage,
  applyTheme,
  getThemeId,
  listThemeSummaries,
  getActivePack,
} from './theme-control'

/**
 * Fallback xterm palette until initThemeFromStorage runs — derived from the
 * default pack (Catppuccin Mocha) so it can't drift from theme-packs.ts.
 */
export const theme: ITheme = THEME_PACKS[0]!.terminal

// ANSI escape helpers
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
