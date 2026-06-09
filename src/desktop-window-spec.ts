/**
 * WindowSpec builders for tiled commands — shared by the WM, folder tiles, and launcher icons.
 */

import type { WindowSpec } from './appwindow'
import { commands } from './commands/index'
import {
  PORTFOLIO_PROJECTS,
  linksAndContactLines,
  resumeWindowSplitPayload,
  whoamiAboutLines,
} from './content/portfolio'
import { DEFAULT_BROWSER_URL } from './browser-url'
import { FS_HOME } from './os-fs'
import { tileTitleForPortfolioCommand, TILED_WINDOW_COMMANDS } from './launcher-catalog'

const PORTFOLIO_WINDOW_COMMANDS = new Set(['resume', 'projects', 'whoami', 'links', 'portfolio'])

export function isPortfolioWindowCommand(cmd: string): boolean {
  return PORTFOLIO_WINDOW_COMMANDS.has(cmd)
}

/** Tabbed hub — résumé, projects, about, contact in one tile (Portfolio folder / dock). */
export function portfolioHubWindowSpec(): WindowSpec {
  return {
    command: 'portfolio',
    title: 'Portfolio',
    portfolioHub: true,
    ...resumeWindowSplitPayload(),
    projectCards: PORTFOLIO_PROJECTS,
    hubWhoamiLines: whoamiAboutLines(),
    hubContactLines: linksAndContactLines(),
  }
}

/** Build a spec for portfolio folder tiles and other WM open paths. */
export function windowSpecForCommand(cmd: string): WindowSpec {
  switch (cmd) {
    case 'portfolio':
      return portfolioHubWindowSpec()
    case 'resume':
      return {
        command: 'resume',
        title: tileTitleForPortfolioCommand('resume'),
        ...resumeWindowSplitPayload(),
      }
    case 'projects':
      return {
        command: 'projects',
        title: tileTitleForPortfolioCommand('projects'),
        content: [],
        projectCards: PORTFOLIO_PROJECTS,
      }
    case 'whoami':
      return {
        command: 'whoami',
        title: tileTitleForPortfolioCommand('whoami'),
        content: whoamiAboutLines(),
      }
    case 'links':
      return {
        command: 'links',
        title: tileTitleForPortfolioCommand('links'),
        content: linksAndContactLines(),
      }
    default:
      return { command: cmd } as WindowSpec
  }
}

/** Spec for a launcher grid icon click — returns null when the cmd is not a tiled window. */
export function launcherIconWindowSpec(cmd: string): WindowSpec | null {
  if (!TILED_WINDOW_COMMANDS.has(cmd)) return null
  if (isPortfolioWindowCommand(cmd)) return windowSpecForCommand(cmd)

  const command = commands[cmd]
  if (!command) return null

  return {
    command: cmd,
    title: tileTitleForPortfolioCommand(cmd),
    content: command.run([]),
    editorPath: cmd === 'edit' ? 'notes.txt' : undefined,
    explorerPath: cmd === 'explorer' ? FS_HOME : undefined,
    browserUrl: cmd === 'browse' ? DEFAULT_BROWSER_URL : undefined,
  }
}
