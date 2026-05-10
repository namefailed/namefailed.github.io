/**
 * Copy for my terminal commands — ANSI via theme helper `c`.
 */

import { c } from '../theme'

const DOT = `${c.dim}·${c.reset}`

/** Right column for legacy `about` neofetch — kept for optional reuse */
export function aboutInfoLines(): string[] {
  return [
    `${c.blue}${c.bold}Matt Grey${c.reset}${c.dim} / mrgrey${c.reset}`,
    `${c.dim}${'─'.repeat(28)}${c.reset}`,
    `${c.pink}Role       ${c.reset}Developer · web · TypeScript-first`,
    `${c.pink}Focus      ${c.reset}Shippable UI, clear APIs, maintainable JS`,
    `${c.dim}${'─'.repeat(28)}${c.reset}`,
    `${c.pink}OS         ${c.reset}Windows 11`,
    `${c.pink}Editor     ${c.reset}Doom Emacs`,
    `${c.pink}WM         ${c.reset}Komorebi`,
    `${c.pink}Shell      ${c.reset}PowerShell`,
    `${c.pink}Keys       ${c.reset}Kanata`,
    `${c.pink}Terminal   ${c.reset}Windows Terminal · WTQ`,
    `${c.pink}PKM        ${c.reset}Org · Denote ${c.dim}(plain-text notes)${c.reset}`,
    `${c.pink}Runtime    ${c.reset}Node · Browser engines`,
    `${c.pink}Site theme ${c.reset}${c.dim}try ${c.blue}theme list${c.reset}`,
    `${c.dim}${'─'.repeat(28)}${c.reset}`,
    `${c.pink}Location   ${c.reset}Killeen, TX ${c.dim}(US Central)${c.reset}`,
    `${c.pink}Status     ${c.reset}${c.green}open to work${c.reset}`,
    `${c.dim}${'─'.repeat(28)}${c.reset}`,
    `${c.dim}I build interfaces people can steer without reading a manual.${c.reset}`,
    `${c.dim}Freelance + product-minded delivery; calm git history matters.${c.reset}`,
    `${c.dim}Recent focus:${c.reset} portfolio OS ${c.dim}(this site)${c.reset}, tightening`,
    `${c.dim}accessibility where it costs little, and shipping with measurable loops.`,
    `${c.dim}Outside paid work I chase clarity:${c.reset} keyboard-first tooling,`,
    `${c.dim}vim-style browser habits, readable CSS/DOM, and UIs that survive theme changes.`,
    `${c.dim}Personal notes live in ${c.reset}Org/Denote${c.dim}—portable files, stable IDs,`,
    `${c.dim}easy to grep; I came here after years in Obsidian + Syncthing.${c.reset}`,
  ]
}

/** `links` tiled window — quick destinations */
export function linksLines(): string[] {
  return [
    '',
    `  ${c.pink}links${c.reset}  ${c.dim}— jump points${c.reset}`,
    `  ${c.dim}${'─'.repeat(44)}${c.reset}`,
    '',
    `  ${c.yellow}site${c.reset}       mrgrey.dev`,
    `  ${c.yellow}github${c.reset}     github.com/mrgrey`,
    `  ${c.yellow}email${c.reset}      namefailedx@gmail.com`,
    '',
    `  ${c.dim}${DOT}${c.reset} ${c.dim}Open the embedded browser:${c.reset} ${c.blue}browse${c.reset}`,
    `  ${c.dim}${DOT}${c.reset} ${c.dim}Example:${c.reset} ${c.blue}browse https://example.com${c.reset}`,
    '',
    `  ${c.dim}Bookmark bar uses sites that allow iframes; many hosts block embeds.${c.reset}`,
    '',
  ]
}

export type PortfolioProjectEntry = {
  title: string
  period?: string
  lines: string[]
  repo?: string
  web?: string
}

/** Shipped + placeholder rows for the `projects` window */
export const PORTFOLIO_PROJECTS: readonly PortfolioProjectEntry[] = [
  {
    title: 'mrgrey.dev',
    period: 'portfolio · 2026',
    lines: [
      `This site: tiling WM metaphor, real xterm.js shell, vim-style editing,`,
      `matrix backdrop, CRT retro mode, theme packs for UI + terminal.`,
      `Stack: TypeScript, Vite, vanilla DOM.`,
      `Same keyboard-first story I document in Org: Komorebi, Kanata, Doom, WTQ.`,
    ],
    repo: 'https://github.com/mrgrey/mrgrey.dev',
    web: 'https://mrgrey.dev',
  },
  {
    title: 'Enterprise & gov-adjacent web',
    period: '2018–2020',
    lines: [
      `Topsarge / milMedia: production sites for military-adjacent clients —`,
      `responsive builds, CMS customization, hosting support.`,
    ],
    web: 'https://topsarge.com',
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
    repo: 'https://github.com/mrgrey',
  },
]

/** `projects` window */
export function projectsLines(): string[] {
  const out: string[] = ['', `  ${c.pink}work & roadmap${c.reset}`, `  ${c.dim}${'─'.repeat(44)}${c.reset}`, '']

  for (const p of PORTFOLIO_PROJECTS) {
    const head =
      `  ${c.blue}${c.bold}${p.title}${c.reset}` +
      (p.period ? `  ${c.dim}${p.period}${c.reset}` : '')
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

/** `skills` window — bar width follows longest label */
export function skillsLines(
  section: (t: string) => string,
  skillRow: (label: string, pct: number, labelWidth: number) => string,
): string[] {
  const pairs: Array<[string, number]> = [
    ['TypeScript', 88],
    ['JavaScript', 88],
    ['HTML / CSS', 90],
    ['Java', 72],
    ['Python', 68],
    ['SQL', 62],
    ['Bash', 74],
    ['Emacs Lisp', 58],
    ['React', 72],
    ['Responsive UI', 86],
    ['Vite / tooling', 78],
    ['Accessibility basics', 68],
    ['CMS / WordPress', 78],
    ['REST APIs', 74],
    ['JSON / HTTP', 82],
    ['Auth flows (OAuth-ish)', 58],
    ['Git', 90],
    ['Linux', 74],
    ['Doom Emacs', 82],
    ['Org / Denote', 78],
    ['Kanata', 88],
    ['PowerShell', 72],
  ]
  const lw = Math.min(28, Math.max(16, ...pairs.map(([a]) => a.length)))

  const lines: string[] = [
    '',
    section('languages'),
    '',
    ...pairs.slice(0, 8).map(([l, p]) => skillRow(l, p, lw)),
    '',
    section('frontend & UI'),
    '',
    ...pairs.slice(8, 13).map(([l, p]) => skillRow(l, p, lw)),
    '',
    section('backend & integration'),
    '',
    ...pairs.slice(13, 16).map(([l, p]) => skillRow(l, p, lw)),
    '',
    section('tools & workflow'),
    '',
    ...pairs.slice(16).map(([l, p]) => skillRow(l, p, lw)),
    '',
    section('notes & knowledge'),
    '',
    `  ${c.dim}${DOT}${c.reset} Plain-text PKM: Denote IDs + Org so notes survive renames and play nice`,
    `    with git and ripgrep—fewer brittle wiki paths than filename-only linking.`,
    `  ${c.dim}${DOT}${c.reset} When tools get plugin-heavy ${c.dim}(past life: Obsidian)${c.reset}, I`,
    `    version what matters and document the load-bearing bits.`,
    '',
    section('how I like to work'),
    '',
    `  ${c.dim}${DOT}${c.reset} Small commits, descriptive messages, reviews when pairing.`,
    `  ${c.dim}${DOT}${c.reset} Prefer boring stacks that teammates can grep six months later.`,
    `  ${c.dim}${DOT}${c.reset} Tests where they save regressions; docs where onboarding hurts.`,
    `  ${c.dim}${DOT}${c.reset} Ship thin slices: measurable checkpoints instead of big-bang reveals.`,
    '',
  ]
  return lines
}

/** `contact` window */
export function contactLines(): string[] {
  return [
    '',
    `  ${c.pink}contact${c.reset}`,
    `  ${c.dim}${'─'.repeat(44)}${c.reset}`,
    '',
    `  ${c.yellow}Email${c.reset}     namefailedx@gmail.com`,
    `            ${c.dim}Best for scope, links, and async detail.${c.reset}`,
    '',
    `  ${c.yellow}Phone${c.reset}     +1 254-534-9544`,
    `            ${c.dim}Voice / SMS · US Central timezone.${c.reset}`,
    '',
    `  ${c.yellow}GitHub${c.reset}    github.com/mrgrey`,
    `  ${c.yellow}Site${c.reset}      mrgrey.dev`,
    '',
    `  ${c.dim}${DOT}${c.reset} ${c.dim}Résumé tile:${c.reset} ${c.blue}resume${c.reset}${c.dim}; formal PDF on request.${c.reset}`,
    `  ${c.dim}${DOT}${c.reset} ${c.dim}Typical reply within a business day.${c.reset}`,
    '',
  ]
}

/** `resume` window — full résumé text */
export function resumeLines(): string[] {
  const hr = `  ${c.dim}${'─'.repeat(54)}${c.reset}`
  return [
    '',
    `  ${c.dim}(Drop ${c.blue}/portrait.jpg${c.dim} in site root for a photo beside this tile.)${c.reset}`,
    '',
    `  ${c.pink}${c.bold}MATT GREY${c.reset}  ${c.dim}·${c.reset}  Developer / Engineer`,
    `  ${c.dim}Killeen, TX  ·  namefailedx@gmail.com  ·  +1 254-534-9544${c.reset}`,
    `  ${c.dim}github.com/mrgrey  ·  mrgrey.dev${c.reset}`,
    '',
    hr,
    `  ${c.pink}PROFILE${c.reset}`,
    hr,
    '',
    `  Software developer with 8+ years shipping web work end-to-end — scoping,`,
    `  UI implementation, integrations, and handoff. Comfortable owning the`,
    `  front of the stack ${c.dim}(TypeScript, React, HTML/CSS)${c.reset} while collaborating`,
    `  on Java-heavy coursework ${c.dim}(unit tests, HTTP/JSON clients, REST framing)${c.reset}.`,
    `  Daily driver: keyboard-first workflow on Windows — ${c.dim}Komorebi, Kanata,`,
    `  Doom Emacs, Windows Terminal${c.dim}, WTQ dropdown shell${c.reset}. Keeps cheat-`,
    `  sheets and config rationale in ${c.dim}Org + Denote${c.reset}; moved there from Markdown`,
    `  vault tooling for stable note IDs and plaintext portability.`,
    '',
    hr,
    `  ${c.pink}EXPERIENCE${c.reset}`,
    hr,
    '',
    `  ${c.blue}${c.bold}Freelance Web Development / Design${c.reset}  ${c.dim}Jan 2017 – Present${c.reset}`,
    `  ${c.dim}Killeen, TX${c.reset}`,
    `  ${c.dim}·${c.reset} Partner with clients from first conversation through launch:`,
    `    requirements, wireframes or templates, custom themes, performance passes.`,
    `  ${c.dim}·${c.reset} Stack varies by client — ${c.dim}HTML, CSS, JavaScript, React, Git, CMS.`,
    `  ${c.dim}·${c.reset} Small businesses, nonprofits, and individuals; repeat engagements.`,
    '',
    `  ${c.blue}${c.bold}Web Developer / Tech${c.reset}  ${c.dim}Jun 2018 – Jan 2020${c.reset}`,
    `  ${c.dim}Topsarge Business Solutions / milMedia Group · Killeen, TX${c.reset}`,
    `  ${c.dim}·${c.reset} Built and maintained marketing and resource sites under deadlines.`,
    `  ${c.dim}·${c.reset} Responsive layouts; CMS configuration ${c.dim}(WordPress and similar).`,
    `  ${c.dim}·${c.reset} Ticket-driven fixes; coordination with stakeholders and hosting.`,
    `  ${c.dim}·${c.reset} Represented the company at regional events and client outreach.`,
    '',
    `  ${c.blue}${c.bold}Technical Support Specialist${c.reset}  ${c.dim}Sept 2017 – Jan 2018${c.reset}`,
    `  ${c.dim}Sykes Enterprises · Temple, TX${c.reset}`,
    `  ${c.dim}·${c.reset} Tier-2 troubleshooting — hardware, OS, and application layers.`,
    `  ${c.dim}·${c.reset} Documented resolutions; strong satisfaction scores on surveys.`,
    '',
    hr,
    `  ${c.pink}EDUCATION${c.reset}`,
    hr,
    '',
    `  ${c.blue}Southern New Hampshire University / Kenzie Academy${c.reset}`,
    `  ${c.dim}B.S. Software Engineering  ·  2021 – 2025${c.reset}`,
    `  ${c.dim}·${c.reset} Java & OOP, data structures, REST, collaborative workflow, UML.`,
    `  ${c.dim}·${c.reset} Unit testing discipline; Git; integrating third-party APIs.`,
    '',
    `  ${c.blue}Temple College${c.reset}  ${c.dim}GED with Honors  ·  2016${c.reset}`,
    '',
    hr,
    `  ${c.pink}SKILLS ${c.dim}(summary)${c.reset}`,
    hr,
    '',
    `  ${c.dim}Languages & markup${c.reset}  TypeScript · JavaScript · Java · Python · Bash`,
    `                      HTML5 · CSS3 · SQL basics`,
    `  ${c.dim}Frontend${c.reset}         React · responsive patterns · component-driven UI`,
    `  ${c.dim}Integration${c.reset}     REST · JSON · CMS platforms · DNS/hosting familiarity`,
    `  ${c.dim}Tooling${c.reset}          Git · Linux · Emacs · Org/Denote · Kanata`,
    `                      PowerShell · Windows Terminal`,
    '',
    hr,
    `  ${c.pink}CERTIFICATIONS${c.reset}`,
    hr,
    '',
    `  ${c.dim}·${c.reset} MIT OpenCourseWare — Introduction to CS & programming`,
    `  ${c.dim}·${c.reset} freeCodeCamp — JavaScript, HTML, CSS certificates`,
    '',
    `  ${c.dim}References:${c.reset} available on request ${c.dim}(coordinate via ${c.blue}contact${c.dim}).${c.reset}`,
    '',
  ]
}

/** `whoami` one-liners below ASCII art */
export function whoamiFooterLines(): string[] {
  return [
    `  ${c.blue}Matt Grey${c.reset}  ${c.dim}·${c.reset}  software dev / web  ${c.dim}·${c.reset}  Killeen, TX`,
    `  ${c.dim}I type for a living.${c.reset}  ${c.green}open to work${c.reset}`,
    `  ${c.dim}Try ${c.blue}skills${c.reset}${c.dim}, ${c.blue}projects${c.reset}${c.dim}, ${c.blue}links${c.reset}${c.dim}, `,
    `${c.blue}resume${c.reset}${c.dim} — résumé mentions the tiling/Emacs/note stack.${c.reset}`,
    '',
  ]
}
