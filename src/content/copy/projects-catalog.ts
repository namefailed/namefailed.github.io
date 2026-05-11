/**
 * Project cards for the `projects` tile and plain page.
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
}

export const PORTFOLIO_PROJECTS: readonly PortfolioProjectEntry[] = [
  {
    title: 'mrgrey.dev',
    period: 'portfolio · 2026',
    lines: [
      `This site: tiling WM metaphor, real xterm.js shell, vim-style editing,`,
      `matrix backdrop, CRT retro mode, theme packs for UI + terminal.`,
      `Stack: TypeScript, Vite, vanilla DOM.`,
    ],
    repo: 'https://github.com/namefailed/mrgrey.dev',
    web: 'https://mrgrey.dev',
    thumb: 'img/legacy/portfolio-mrgrey.svg',
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
  },
  {
    title: 'Future entries',
    lines: [
      'Drop repos or live URLs here as you ship — same tile, clearer story.',
      'Suggested fields: title · outcome · repo URL · live demo URL.',
    ],
    repo: 'https://github.com/namefailed',
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
