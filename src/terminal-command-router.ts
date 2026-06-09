/**
 * Built-in terminal command handlers — extracted from `TerminalApp.execute` so the
 * shell router stays readable and special cases are testable in isolation.
 */

import type { Command } from './commands/types'
import type { WindowSpec } from './desktop'
import { PORTFOLIO_PROJECTS, resumeWindowSplitPayload } from './content/portfolio'
import { getRetroFx, setRetroFx, toggleRetroFx } from './retro-fx'
import { getMatrixBgHandle } from './matrix-bg'
import {
  getActivePack,
  getThemeId,
  listThemeSummaries,
  applyTheme,
  c,
} from './theme'
import {
  playOsSound,
  resumeAudioIfNeeded,
  setSoundEnabled,
  isSoundEnabled,
  toggleSound,
  getSoundVolume,
} from './os-sound'
import { syncSettingsSoundToggle } from './os-systray'
import { windowSpawnEcho } from './cli-window-echo'
import { randomPick } from './random-pick'
import { EDITOR_LAUNCH_ALIASES, TILED_WINDOW_COMMANDS } from './launcher-catalog'
import { DEFAULT_BROWSER_URL, normalizeBrowserUrl } from './browser-url'
import { vfsNormalize, vfsPwd } from './os-fs'
import { resolveStaticPortfolioHref } from './static-portfolio-href'
import { commands } from './commands/index'

export interface TerminalCommandHost {
  writeln(line: string): void
  writeLines(lines: string[]): void
  clearTerminal(): void
  onOpenWindow(spec: WindowSpec): void
  showSpinner(label: string, ms: number): Promise<void>
  refreshTerminalTheme(): void
  showMotd(): Promise<void>
  recordHistory(raw: string): void
}

/** When true, `execute` should return without pushing history or re-prompting. */
export type TerminalDispatchResult = 'continue' | 'exit'

export async function dispatchTerminalCommand(
  host: TerminalCommandHost,
  name: string,
  args: string[],
  raw: string,
  cmd: Command,
): Promise<TerminalDispatchResult> {
  if (name === 'static' || name === 'plain' || name === 'x') {
    const target = resolveStaticPortfolioHref()
    host.writeln('')
    host.writeln(`  ${c.dim}Opening the static portfolio…${c.reset}`)
    host.writeln(`  ${c.green}→${c.reset} ${c.blue}${target}${c.reset}`)
    host.writeln('')
    host.recordHistory(raw)
    window.location.assign(target)
    return 'exit'
  }

  if (name === 'clear') {
    handleClear(host, args)
    return 'continue'
  }

  if (name === 'retro') {
    handleRetro(host, args)
    return 'continue'
  }

  if (name === 'matrix') {
    handleMatrix(host, args)
    return 'continue'
  }

  if (name === 'theme') {
    handleTheme(host, args)
    return 'continue'
  }

  if (name === 'sound') {
    await handleSound(host, args)
    return 'continue'
  }

  if (name === 'reboot') {
    host.recordHistory(raw)
    host.clearTerminal()
    await host.showMotd()
    return 'exit'
  }

  if (name === 'skills' || name === 'contact') {
    handleLegacyWindowAliases(host, name, args)
    return 'continue'
  }

  if (TILED_WINDOW_COMMANDS.has(name)) {
    handleTiledWindowCommand(host, name, args, cmd)
    return 'continue'
  }

  host.writeLines(cmd.run(args))
  return 'continue'
}

function handleClear(host: TerminalCommandHost, args: string[]): void {
  const sub = args[0]?.toLowerCase()
  if (sub === '--help' || sub === '-h') {
    host.writeln('')
    host.writeln(`  ${c.blue}clear${c.reset} ${c.dim}— blank scrollback; prompt stays thematic.${c.reset}`)
    host.writeln(`  ${c.blue}clear --cow${c.reset} ${c.dim}— clear, then microscopic cow haiku.${c.reset}`)
    host.writeln('')
    return
  }

  host.clearTerminal()
  if (sub === '--cow') {
    host.writeln('')
    host.writeln(`  ${c.dim}< moo.${c.reset}`)
    host.writeln(`   ${c.dim}\\${c.green}‾${c.reset}${c.dim}—— now you see nothing.${c.reset}`)
    host.writeln('')
  }
}

function handleRetro(host: TerminalCommandHost, args: string[]): void {
  const sub = args[0]?.toLowerCase()
  if (sub === 'status') {
    const on = getRetroFx()
    host.writeln(
      `  ${c.green}crt profile:${c.reset} ${on ? 'warped phosphor nostalgia' : 'flat modern cowardice'}`,
    )
    host.writeln(
      `  ${c.dim}${randomPick([
        'vignette strength: bureaucracy × 3',
        'grain budget: confiscated Super 8 crumbs',
        'scanline pitch: ethically questionable',
      ])}${c.reset}`,
    )
    return
  }

  if (sub === '--help' || sub === '-h') {
    host.writeln('')
    host.writeln(
      `  ${c.blue}retro${c.reset}${c.dim} · ${c.blue}on${c.dim} │ ${c.blue}off${c.dim} │ bare word toggles · ${c.blue}status${c.reset}`,
    )
    host.writeln('')
    return
  }

  if (sub === 'on') setRetroFx(true)
  else if (sub === 'off') setRetroFx(false)
  else if (sub !== 'status' && sub !== '--help' && sub !== '-h') toggleRetroFx()

  if (!sub || sub === 'on' || sub === 'off' || (sub !== 'status' && sub !== '--help' && sub !== '-h')) {
    const on = getRetroFx()
    if (sub !== 'status' && sub !== '--help' && sub !== '-h') {
      host.writeln(
        on
          ? `  ${c.green}retro on${c.reset}  ${c.dim}(grain · scanlines · guilty nostalgia)${c.reset}`
          : `  ${c.dim}retro off — pixels unpunished.${c.reset}`,
      )
    }
  }
}

function handleMatrix(host: TerminalCommandHost, args: string[]): void {
  const api = getMatrixBgHandle()
  if (!api) {
    host.writeln(`  ${c.dim}matrix backdrop not wired in this route${c.reset}`)
    return
  }

  const sub = args[0]?.toLowerCase()
  if (sub === 'status') {
    const on = api.isEnabled()
    host.writeln(
      `  ${c.green}matrix:${c.reset} ${on ? 'Glyphs falling — recruiter emails decoded as poetry.' : 'Idle — Wallpaper drinks tea.'}`,
    )
    if (on) {
      host.writeln(
        `  ${c.dim}throughput illusion: ~${randomPick(['9021', '1337', '4096'])} green chars / conceptual second${c.reset}`,
      )
    }
    return
  }

  if (sub === '--help' || sub === '-h') {
    host.writeln('')
    host.writeln(
      `  ${c.blue}matrix${c.reset}${c.dim} · ${c.blue}on${c.dim} │ ${c.blue}off${c.dim} │ ${c.blue}status${c.reset}`,
    )
    host.writeln('')
    return
  }

  if (sub === 'on') {
    api.setEnabled(true)
    host.writeln(`  ${c.green}matrix rain armed${c.reset}`)
    return
  }

  if (sub === 'off') {
    api.setEnabled(false)
    host.writeln(`  ${c.dim}matrix drizzle cancelled${c.reset}  ${c.dim}— gradient wallpaper only.${c.reset}`)
    return
  }

  if (!api.isEnabled()) {
    host.writeln(
      `  ${c.dim}matrix idle — wake with ${c.blue}matrix on${c.reset}${c.dim} · ${c.blue}matrix status${c.reset}${c.dim} gossips.${c.reset}`,
    )
    return
  }

  host.writeln(
    `  ${c.dim}usage:${c.reset} ${c.blue}matrix on${c.reset}${c.dim} │ ${c.reset}${c.blue}off${c.reset}${c.dim} │ ${c.reset}${c.blue}status${c.reset}`,
  )
}

function handleTheme(host: TerminalCommandHost, args: string[]): void {
  const raw = args[0]?.toLowerCase()
  const sub = raw?.replace(/_/g, '-')
  if (!sub || sub === 'current') {
    const p = getActivePack()
    host.writeln(`  ${c.green}theme:${c.reset} ${p.label} ${c.dim}(${getThemeId()})${c.reset}`)
    return
  }

  if (sub === 'list') {
    host.writeln('')
    for (const { id, label } of listThemeSummaries()) {
      const mark = id === getThemeId() ? ` ${c.dim}←${c.reset}` : ''
      host.writeln(`  ${c.blue}${id.padEnd(14)}${c.reset} ${c.dim}${label}${c.reset}${mark}`)
    }
    host.writeln('')
    host.writeln(
      `  ${c.dim}usage:${c.reset} ${c.blue}theme${c.reset} ${c.dim}<id>${c.reset} · ${c.blue}theme random${c.reset}`,
    )
    return
  }

  if (sub === 'random' || sub === 'shuffle') {
    const pool = listThemeSummaries().filter(t => t.id !== getThemeId())
    const pick = pool.length
      ? pool[Math.floor(Math.random() * pool.length)]!
      : listThemeSummaries()[0]!
    if (applyTheme(pick.id)) {
      host.refreshTerminalTheme()
      const p = getActivePack()
      host.writeln(`  ${c.green}theme roulette →${c.reset} ${p.label} ${c.dim}(${getThemeId()})${c.reset}`)
    }
    return
  }

  if (sub && applyTheme(sub)) {
    host.refreshTerminalTheme()
    const p = getActivePack()
    host.writeln(`  ${c.green}theme applied:${c.reset} ${p.label} ${c.dim}(${getThemeId()})${c.reset}`)
    return
  }

  host.writeln(`  ${c.red}unknown theme:${c.reset} ${raw ?? ''}  ${c.dim}(theme list · theme random)${c.reset}`)
}

async function handleSound(host: TerminalCommandHost, args: string[]): Promise<void> {
  const sub = args[0]?.toLowerCase()
  if (sub === 'status' || sub === '?') {
    const pct = Math.round(getSoundVolume() * 100)
    host.writeln(
      `  ${c.green}sound:${c.reset} ${isSoundEnabled() ? 'on (blessed)' : 'off (silent film mode)'}  ${c.dim}· panel volume ≈ ${pct}%${c.reset}`,
    )
    return
  }

  if (sub === '--help' || sub === '-h') {
    host.writeln('')
    host.writeln(
      `  ${c.blue}sound${c.reset}${c.dim} · ${c.blue}on${c.dim} │ ${c.blue}off${c.dim} │ bare ⇒ toggle · ${c.blue}status${c.reset}`,
    )
    host.writeln('')
    return
  }

  if (sub === 'off') setSoundEnabled(false)
  else if (sub === 'on') setSoundEnabled(true)
  else toggleSound()

  await resumeAudioIfNeeded()
  syncSettingsSoundToggle()
  host.writeln(
    isSoundEnabled()
      ? `  ${c.green}UI sounds:${c.reset} audible · master ${Math.round(getSoundVolume() * 100)}%.`
      : `  ${c.dim}UI sounds muted — clock slider still adjusts gain.${c.reset}`,
  )
}

function handleLegacyWindowAliases(
  host: TerminalCommandHost,
  name: string,
  args: string[],
): void {
  const canonical = name === 'skills' ? 'resume' : 'links'
  const canonCmd = commands[canonical]
  if (!canonCmd) return

  const ack = (): void => host.writeLines(windowSpawnEcho(canonical, args))
  if (canonical === 'resume') {
    host.onOpenWindow({
      command: 'resume',
      title: 'résumé · skills',
      ...resumeWindowSplitPayload(),
    })
  } else {
    host.onOpenWindow({
      command: canonical,
      title: 'contact · outbound',
      content: canonCmd.run(args),
    })
  }
  ack()
  playOsSound('click')
}

function handleTiledWindowCommand(
  host: TerminalCommandHost,
  name: string,
  args: string[],
  cmd: Command,
): void {
  const ack = (): void => host.writeLines(windowSpawnEcho(name, args))

  if (EDITOR_LAUNCH_ALIASES.has(name)) {
    const path = args[0] ?? 'notes.txt'
    const heading = name === 'vim' ? 'vim' : name === 'editor' ? 'editor' : 'edit'
    host.onOpenWindow({
      command: 'edit',
      title: `${heading} — ${path}`,
      content: [],
      editorPath: path,
    })
    ack()
  } else if (name === 'explorer') {
    const pathArg = args[0] ? vfsNormalize(args[0]) : vfsPwd()
    host.onOpenWindow({
      command: 'explorer',
      title: 'Files',
      content: [],
      explorerPath: pathArg,
    })
    ack()
  } else if (name === 'browse') {
    const rawUrl = args.join(' ').trim()
    const browserUrl = rawUrl ? normalizeBrowserUrl(rawUrl) : DEFAULT_BROWSER_URL
    host.onOpenWindow({
      command: 'browse',
      title: 'Browse',
      content: [],
      browserUrl,
    })
    ack()
  } else if (name === 'p5') {
    const pathArg = args[0] ?? undefined
    host.onOpenWindow({
      command: 'p5',
      title: pathArg ? (pathArg.split('/').pop() ?? 'p5.js') : 'p5.js',
      content: [],
      p5SketchPath: pathArg,
    })
    ack()
  } else {
    const title =
      name === 'resume'
        ? 'résumé · skills'
        : name === 'links'
          ? 'contact · outbound'
          : name === 'projects'
            ? 'work & roadmap'
            : name === 'whoami'
              ? 'about me · personal'
              : name

    if (name === 'resume') {
      host.onOpenWindow({
        command: name,
        title,
        ...resumeWindowSplitPayload(),
      })
    } else if (name === 'projects') {
      host.onOpenWindow({
        command: 'projects',
        title,
        content: [],
        projectCards: PORTFOLIO_PROJECTS,
      })
    } else {
      host.onOpenWindow({ command: name, title, content: cmd.run(args) })
    }
    ack()
  }

  playOsSound('click')
}
