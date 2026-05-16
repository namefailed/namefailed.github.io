/**
 * Keyword → handler map for the xterm shell.
 *
 * Sub-modules by responsibility:
 *   `vfs-commands.ts`    — pwd · ls · cd · cat · touch · mkdir · rm · wc · head · tail
 *   `system-commands.ts` — cookies · ps · apt · cowsay · notify · date · uptime · cal · echo
 *   `app-commands.ts`    — tile launchers + UI toggles (return [] — intercepted by desktop)
 *   `help-output.ts`     — help screens
 *   `cli-text-utils.ts`  — fake Unix utilities
 *   `cli-fortunes.ts`    — fortune lines
 */

import { renderKeybindsLegend, runShellHelp } from './help-output'
import { vfsCommands } from './vfs-commands'
import { systemCommands } from './system-commands'
import { appCommands } from './app-commands'

import type { Command } from './types'

export type { Command } from './types'

export const commands: Record<string, Command> = {

  // ── Shell meta ──────────────────────────────────────────────────────────────

  help: {
    description:
      'Summarises keywords; try help resume for one keyword, help -v for every keyword with notes',
    run: args => runShellHelp(commands, args),
  },

  keybinds: {
    description: 'Full keyboard shortcut legend — WM, terminal, editor, explorer, games',
    run: () => renderKeybindsLegend(),
  },

  clear: {
    description:
      'Clear scrollback (xterm.js) — clear --help lists flags · clear --cow whispers moo',
    run: () => [],
  },

  // ── Sub-module spreads ──────────────────────────────────────────────────────

  ...vfsCommands,
  ...systemCommands,
  ...appCommands,
}
