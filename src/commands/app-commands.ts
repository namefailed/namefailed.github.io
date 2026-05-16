/**
 * App-launcher and UI-toggle command stubs.
 * These commands return [] — they are intercepted by the terminal/desktop layer
 * which opens the matching tile instead of printing output.
 */

import {
  linksAndContactLines,
  projectsLines,
  resumeAndSkillsLines,
  whoamiAboutLines,
} from '../content/portfolio'

import type { Command } from './types'

export const appCommands: Record<string, Command> = {

  // ── Portfolio content tiles ─────────────────────────────────────────────────

  links: {
    description:
      'Contact tile — portrait rail, GitHub/LinkedIn/email/phone/site, browse hints (CLI alias: `contact`)',
    loadMs: 400,
    run: () => linksAndContactLines(),
  },

  resume: {
    description:
      'Résumé + skill matrix — narrative, bar chart, certs (same path as legacy `skills`)',
    loadMs: 800,
    run: () => resumeAndSkillsLines(),
  },

  projects: {
    description:
      'Shipped work + placeholder cards for future repos and live demos (structured list)',
    loadMs: 800,
    run: () => projectsLines(),
  },

  whoami: {
    description:
      'About me tile — work story, SCA persona Graee na Uile, links (résumé: `resume`; outbound: `links`)',
    loadMs: 350,
    run: () => whoamiAboutLines(),
  },

  // ── Editor aliases ──────────────────────────────────────────────────────────

  edit: {
    description:
      'Mini-vim buffer on the virtual FS — edit [path] (default notes.txt); :wq · hjkl · wb',
    run: () => [],
  },

  editor: {
    description:
      'Editor tile — editor [path] opens the same mini-vim buffer as edit (default notes.txt)',
    run: () => [],
  },

  vim: {
    description:
      'Editor tile — vim [path] opens same mini-vim buffer as edit (default notes.txt)',
    run: () => [],
  },

  // ── Tool tiles ──────────────────────────────────────────────────────────────

  explorer: {
    description:
      'File browser — explorer [path]; Rename, Cut/Copy/Paste, Delete; F2 / Ctrl+V',
    run: () => [],
  },

  browse: {
    description:
      'Iframe browser tile — browse [url]; many sites block embeds (use Open tab when blank)',
    run: () => [],
  },

  // ── Creative tiles ──────────────────────────────────────────────────────────

  paint: {
    description: 'Paint — brush, eraser, line, fill; [ ] adjust brush size when canvas focused',
    run: () => [],
  },

  cube: {
    description: "Rubik's cube — left-drag to spin · click stickers or U/D/L/R/F/B to turn · Scramble / Solve / algorithm picker",
    run: () => [],
  },

  p5: {
    description: 'p5.js sketch viewer — 9 built-in sketches seeded under ~/sketches/; double-click .js in file explorer to play; drag-drop .js or Open… from VFS',
    run: () => [],
  },

  // ── Game tiles ──────────────────────────────────────────────────────────────

  snake: {
    description: 'Snake — WASD / arrows; rounded cells; Space restarts after game over',
    run: () => [],
  },

  pong: {
    description: 'Pong — W/S vs AI or two-player W/S vs ↑↓; goals reset the ball',
    run: () => [],
  },

  // ── UI toggles (handled by terminal.ts command interceptor) ─────────────────

  retro: {
    description:
      'CRT shader — retro · on | off | status | --help · bare word toggles scanlines',
    run: () => [],
  },

  matrix: {
    description:
      'Matrix rain — matrix on | off | status | --help · clock menu syncs · on/off saved for reload',
    run: () => [],
  },

  theme: {
    description:
      'Catppuccin packs — theme · list · random · current · <id> paints UI + terminal',
    run: () => [],
  },

  sound: {
    description:
      'UI bleeps — sound on | off · status | ? · bare word toggles · volume in clock menu',
    run: () => [],
  },

  reboot: {
    description:
      'Kernel cosplay — full reboot replays boot art; reboot --dry-run prints log sampler',
    run: () => [],
  },

  // ── Static page aliases (deprecated) ────────────────────────────────────────

  static: {
    description:
      'Static portfolio — résumé, projects & contact at `/static/` (no desktop UI; phones auto-redirect here)',
    run: () => [],
  },

  /** @deprecated Prefer `static`; kept so old scripts still work */
  plain: {
    hidden: true,
    description: 'Hidden alias for `static`',
    run: () => [],
  },

  /** @deprecated Prefer `static`; kept so old muscle memory still works */
  x: {
    hidden: true,
    description: 'Hidden alias for `static`',
    run: () => [],
  },
}
