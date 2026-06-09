/**
 * Project cards for the `projects` tile and `/static/` brochure page.
 * Facts/URLs/thumbs were scraped from an old GitHub Pages deploy; blurbs are rewritten here.
 */

import { c } from '../../theme'

export type PortfolioProjectEntry = {
  title: string
  period?: string
  lines: string[]
  repo?: string
  web?: string
  /** Path under site root (`public/`) — thumbnails from legacy GitHub Pages */
  thumb?: string
  /**
   * Skip WordPress mShots for this card. Set for domains where s0.wp.com/mshots returns
   * 403/HTML so the `<img>` never paints a frame; we then rely on {@link thumb} (or placeholder).
   */
  skipLiveScreenshot?: boolean
  /** CSS object-position for bundled screenshots (default: center top). */
  thumbPosition?: string
  /** Override auto-detected preview badge (website / app / portfolio / client). */
  previewKind?: 'website' | 'app' | 'portfolio' | 'client'
}

export const PORTFOLIO_PROJECTS: readonly PortfolioProjectEntry[] = [
  {
    title: 'Vertalo',
    period: 'vertalo.com · 2021–2022',
    lines: [
      `API-first transfer agent — tokenization infrastructure for issuers, fund managers, and institutions.`,
      `Built the full public-facing site: Craft CMS, React, GraphQL, AWS. Design through launch.`,
    ],
    web: 'https://vertalo.com',
    thumb: 'img/portfolio-vertalo.png',
    thumbPosition: 'center top',
    skipLiveScreenshot: true,
  },
  {
    title: 'Phoneme',
    period: 'phoneme · 2025–2026',
    lines: [
      `Local-first voice transcription for Windows — global hotkey, speak, release, paste anywhere.`,
      `Offline Whisper by default; optional cloud STT/LLM cleanup, meeting mode with dual-track capture,`,
      `SQLite catalog, webhooks, and CLI. Rust + Tauri + egui. Open source (MIT/Apache-2.0).`,
    ],
    repo: 'https://github.com/namefailed/phoneme',
    thumb: 'img/portfolio-phoneme.png',
    previewKind: 'app',
    thumbPosition: 'center center',
    skipLiveScreenshot: true,
  },
  {
    title: 'mrgrey.site',
    period: 'portfolio · 2026',
    lines: [
      `This site: tiling WM metaphor, real xterm.js shell, vim-style editing,`,
      `matrix backdrop, CRT retro mode, theme packs for UI + terminal.`,
      `Stack: TypeScript, Vite, vanilla DOM.`,
    ],
    repo: 'https://github.com/namefailed/namefailed.github.io',
    web: 'https://mrgrey.site',
    thumb: 'img/portfolio-mrgrey.png',
    previewKind: 'portfolio',
    thumbPosition: 'center top',
    skipLiveScreenshot: true,
  },
  {
    title: 'Army Women’s Foundation',
    period: 'awfdn.org',
    lines: [`Live nonprofit / program marketing site.`],
    web: 'https://awfdn.org/',
    thumb: 'img/legacy/portfolio-awfdn.svg',
  },
  {
    title: 'Lopez Houses',
    period: 'lopezhouses.com',
    lines: [`Live real-estate marketing site for the Greater Killeen area.`],
    web: 'https://www.lopezhouses.com/',
    thumb: 'img/legacy/portfolio-hacienda.svg',
  },
  {
    title: 'SolutionPoint+',
    period: 'solutionpointplus.com',
    lines: [`Live brochure / training marketing site.`],
    web: 'https://solutionpointplus.com/',
    thumb: 'img/legacy/portfolio-solutionpointplus.svg',
  },
  {
    title: 'Comal County ESD #6',
    period: 'comalcountyesd6.org',
    lines: [`Live public ESD / community informational site.`],
    web: 'https://comalcountyesd6.org/',
    thumb: 'img/legacy/portfolio-ccesd6.svg',
  },
  {
    title: 'Topsarge / milMedia production',
    period: '2018–2020',
    lines: [
      `Agency-side production: responsive layouts, CMS configuration, iterative releases.`,
      `Overlap in time/project mix with several of the sites listed above.`,
    ],
    web: 'https://topsarge.com',
    thumb: 'img/legacy/portfolio-topsarge.svg',
  },
  {
    title: 'Freelance web',
    period: '2017–present',
    lines: [
      `End-to-end for small businesses: discovery, design handoff, build,`,
      `deploy, iterate. HTML/CSS/JS/React + WordPress where it fits.`,
    ],
    thumb: 'img/portfolio-freelance.png',
    previewKind: 'client',
    thumbPosition: 'center center',
    skipLiveScreenshot: true,
  },
]

/** Lines printed by the `projects` shell command */
export function projectsLines(): string[] {
  const out: string[] = ['', `  ${c.pink}work & roadmap${c.reset}`, `  ${c.dim}${'─'.repeat(44)}${c.reset}`, '']

  for (const p of PORTFOLIO_PROJECTS) {
    const head =
      `  ${c.blue}${c.bold}${p.title}${c.reset}` + (p.period ? `  ${c.dim}${p.period}${c.reset}` : '')
    out.push(head)
    for (const ln of p.lines) out.push(`  ${c.dim}${ln}${c.reset}`)
    const bits: string[] = []
    if (p.repo) bits.push(`${c.green}repo${c.reset} ${c.dim}${p.repo}${c.reset}`)
    if (p.web) bits.push(`${c.green}web${c.reset}  ${c.dim}${p.web}${c.reset}`)
    if (bits.length) out.push(`  ${bits.join(`  ${c.dim}·${c.reset}  `)}`)
    out.push('')
  }

  out.push(
    `  ${c.dim}Tip:${c.reset} run ${c.blue}browse <url>${c.reset}${c.dim} to open a demo beside the shell.${c.reset}`,
    '',
  )
  return out
}
