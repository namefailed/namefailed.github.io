import { describe, it, expect } from 'vitest'
import {
  isPortfolioWindowCommand,
  launcherIconWindowSpec,
  windowSpecForCommand,
} from './desktop-window-spec'
import {
  PORTFOLIO_PROJECTS,
  linksAndContactLines,
  resumeWindowSplitPayload,
  whoamiAboutLines,
} from './content/portfolio'
import { tileTitleForPortfolioCommand } from './launcher-catalog'

describe('windowSpecForCommand', () => {
  it('builds résumé split payload', () => {
    expect(windowSpecForCommand('resume')).toEqual({
      command: 'resume',
      title: tileTitleForPortfolioCommand('resume'),
      ...resumeWindowSplitPayload(),
    })
  })

  it('builds projects card list', () => {
    const spec = windowSpecForCommand('projects')
    expect(spec.command).toBe('projects')
    expect(spec.projectCards).toBe(PORTFOLIO_PROJECTS)
  })

  it('builds whoami content lines', () => {
    expect(windowSpecForCommand('whoami').content).toEqual(whoamiAboutLines())
  })

  it('builds links/contact content lines', () => {
    expect(windowSpecForCommand('links').content).toEqual(linksAndContactLines())
  })

  it('returns command-only spec for tool tiles', () => {
    expect(windowSpecForCommand('paint')).toEqual({ command: 'paint' })
  })
})

describe('launcherIconWindowSpec', () => {
  it('routes portfolio cmds through windowSpecForCommand', () => {
    expect(launcherIconWindowSpec('whoami')).toEqual(windowSpecForCommand('whoami'))
    expect(launcherIconWindowSpec('links')).toEqual(windowSpecForCommand('links'))
  })

  it('seeds edit/explorer/browse defaults', () => {
    expect(launcherIconWindowSpec('edit')?.editorPath).toBe('notes.txt')
    expect(launcherIconWindowSpec('explorer')?.explorerPath).toBeTruthy()
    expect(launcherIconWindowSpec('browse')?.browserUrl).toBeTruthy()
  })

  it('returns null for unknown cmds', () => {
    expect(launcherIconWindowSpec('not-a-real-cmd')).toBeNull()
  })
})

describe('isPortfolioWindowCommand', () => {
  it('recognises portfolio folder cmds only', () => {
    expect(isPortfolioWindowCommand('resume')).toBe(true)
    expect(isPortfolioWindowCommand('paint')).toBe(false)
  })
})
