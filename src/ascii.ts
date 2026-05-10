import { c } from './theme'

// ── BANNER ────────────────────────────────────────────────────────────────────
// "mrgrey" — figlet Big / Shadow font, blue → pink gradient

export const BANNER: string[] = [
  `${c.blue} _ __ ___  _ __ __ _ _ __ ___ _   _ ${c.reset}`,
  `${c.blue}| '_ \` _ \\| '__/ _\` | '__/ _ \\ | | |${c.reset}`,
  `${c.cyan}| | | | | | | | (_| | | |  __/ |_| |${c.reset}`,
  `${c.pink}|_| |_| |_|_|  \\__, |_|  \\___||__, |${c.reset}`,
  `${c.dim}                |___/          |___/ ${c.reset}`,
]

// ── ABOUT_ART ─────────────────────────────────────────────────────────────────
// Ghost sidebar art — Catppuccin pink body, blue eyes

export const ABOUT_ART: string[] = [
  `   ${c.pink}▄▓▓▓▓▓▓▓▓▓▄${c.reset}   `,
  `  ${c.pink}▓██████████▓${c.reset}   `,
  `  ${c.pink}▓█${c.reset} ${c.blue}◉${c.reset}    ${c.blue}◉${c.reset} ${c.pink}█▓${c.reset}  `,
  `  ${c.pink}▓█${c.reset}   ${c.yellow}────${c.reset}  ${c.pink}█▓${c.reset}  `,
  `  ${c.pink}▓████████████▓${c.reset}`,
  `  ${c.pink}▒▓▒${c.reset}${c.dim}░▓██▓░${c.reset}${c.pink}▒▓▒${c.reset} `,
  `  ${c.dim}░▒░${c.reset}${c.dim}      ${c.reset}${c.dim}░▒░${c.reset} `,
  `   ${c.dim}░░░░░░░░░░${c.reset}   `,
]

// ── WHOAMI_ART ────────────────────────────────────────────────────────────────
// Greyhat man — fedora, shaded body, terminal glow on face

export const WHOAMI_ART: string[] = [
  `   ${c.dim}  _________  ${c.reset}`,
  `   ${c.dim} /▒▒▒▒▒▒▒▒▒\\ ${c.reset}`,
  `   ${c.dim}(___________)${c.reset}`,
  `   ${c.pink}  ( ◉   ◉ ) ${c.reset}`,
  `   ${c.pink}   \\  ─  /  ${c.reset}`,
  `   ${c.pink}    '───'   ${c.reset}`,
  `   ${c.dim}    |   |   ${c.reset}`,
  `   ${c.dim}   /|   |\\  ${c.reset}`,
  `   ${c.dim}  /_|___|_\\ ${c.reset}`,
]
