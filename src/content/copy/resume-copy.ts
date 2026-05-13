/**
 * Résumé + skills matrix strings for CLI `resume`, the résumé tile, and `/static/` page data imports.
 *
 * Split from the barrel on purpose: this file churns whenever I tweak jobs or skill bars,
 * while `projects-catalog.ts` is a different mental mode (client work list).
 */

import { c } from '../../theme'
import { dimInterpunct, dimRule, sectionHeadingLine, skillMeterLine } from './ansi-widgets'

/** Label column width for skill meter rows (terminal + tile) */
export const RESUME_SKILL_METER_LABEL_WIDTH = 22

export interface ResumeSkillMatrixSection {
  readonly title: string
  readonly pairs: ReadonlyArray<readonly [string, number]>
}

/** Single source for skills matrix — tile builds HTML from this; strings come from `skillsDetailLines` */
export const RESUME_SKILL_MATRIX_SECTIONS: readonly ResumeSkillMatrixSection[] = [
  {
    title: 'languages',
    pairs: [
      ['TypeScript', 88],
      ['JavaScript', 88],
      ['HTML / CSS', 90],
      ['Java', 72],
      ['Python', 68],
      ['SQL', 62],
      ['Bash', 74],
      ['Node.js', 78],
    ],
  },
  {
    title: 'frontend & UI',
    pairs: [
      ['React', 72],
      ['Responsive UI', 86],
      ['Vite / tooling', 78],
      ['Accessibility basics', 68],
      ['CMS / WordPress', 78],
    ],
  },
  {
    title: 'backend & integration',
    pairs: [
      ['REST APIs', 74],
      ['JSON / HTTP', 82],
      ['OAuth-style auth', 58],
    ],
  },
  {
    title: 'tools & workflow',
    pairs: [
      ['Git', 90],
      ['Linux', 74],
      ['pnpm / npm', 76],
      ['PowerShell', 72],
    ],
  },
] as const

export const RESUME_WORKSTYLE_BULLETS: readonly string[] = [
  'Small commits with clear messages; review my own diff before asking others to.',
  'Simpler stacks age better — prefer tools the next person can pick up without a guide.',
  'Write tests where they catch real bugs; add docs where a new dev would otherwise be stuck.',
  'Ship one reviewable slice at a time rather than queuing up a big reveal.',
]

function skillsDetailLines(): string[] {
  const lw = RESUME_SKILL_METER_LABEL_WIDTH
  const lines: string[] = ['']
  for (const sec of RESUME_SKILL_MATRIX_SECTIONS) {
    lines.push(sectionHeadingLine(sec.title), '', ...sec.pairs.map(([l, p]) => skillMeterLine(l, p, lw)), '')
  }
  lines.push(
    '',
    sectionHeadingLine('how I like to work'),
    ...RESUME_WORKSTYLE_BULLETS.map(b => `${dimInterpunct} ${b}`),
  )
  return lines
}

function resumeHrBar(): string {
  return dimRule(54)
}

function resumeEducationEndLines(): string[] {
  const hr = resumeHrBar()
  return [
    '',
    `  ${c.pink}${c.bold}MATT GREY${c.reset}  ${c.dim}·${c.reset}  Developer / Engineer`,
    `  ${c.dim}Killeen–Temple, TX  ·  namefailedx@gmail.com  ·  +1 254-534-9544${c.reset}`,
    `  ${c.dim}github.com/namefailed  ·  mrgrey.site  ·  linkedin.com/in/matthew-grey-215615179${c.reset}`,
    '',
    hr,
    `  ${c.pink}PROFILE${c.reset}`,
    hr,
    `  Web developer with 9 years delivering end-to-end — scoping, UI implementation, integrations, and handoffs that teammates can actually maintain. Shipped the full public-facing site for Vertalo ${c.dim}(fintech / digital-asset infrastructure)${c.reset} and built across nonprofits, agencies, and independent clients. TypeScript-first; day-to-day is Git-driven development, pragmatic testing, and iterative delivery with visible progress at every checkpoint.`,
    hr,
    `  ${c.pink}EXPERIENCE${c.reset}`,
    hr,
    `  ${c.blue}${c.bold}Freelance Web Development / Design${c.reset}  ${c.dim}Jan 2017 – Present${c.reset}`,
    `  ${c.dim}Remote / hybrid${c.reset}`,
    `  ${dimInterpunct} Owned the full project lifecycle for 15+ client engagements — discovery, design, development, deployment, and post-launch training — with no hand-offs and no gaps in accountability.`,
    `  ${dimInterpunct} Shipped responsive, accessible web experiences across ${c.dim}TypeScript, React, Vite, Node.js, vanilla JS/CSS, and CMS platforms${c.reset}; stack chosen per project, not habit.`,
    `  ${dimInterpunct} Managed hosting environments and long-term feature cadence for retainer clients, keeping production healthy well past launch.`,
    `  ${dimInterpunct} Built repeat business through transparent ownership and direct communication — primary contact from first call through post-launch iterations across small businesses, nonprofits, and independent operators.`,
    `  ${c.blue}${c.bold}Deputy Web Minister${c.reset}  ${c.dim}Feb 2025 – Aug 2025${c.reset}`,
    `  ${c.dim}Society for Creative Anachronism · Killeen–Temple Area (volunteer/hybrid)${c.reset}`,
    `  ${dimInterpunct} Maintained and improved the official website for one of the world's largest volunteer-driven historical organizations, ensuring compliance with SCA digital governance policies.`,
    `  ${dimInterpunct} Restructured officer rosters, event listings, and announcement workflows to improve usability for members and event organizers across multiple regional branches.`,
    `  ${dimInterpunct} Coordinated cross-branch content updates with the Web Minister and regional officers; kept digital presence consistent and timely during a high-volume event season.`,
    `  ${dimInterpunct} Handled technical troubleshooting and CMS administration in a fully volunteer, distributed environment — reliable delivery without a conventional support chain.`,
    `  ${c.blue}${c.bold}Frontend Developer${c.reset}  ${c.dim}Jan 2021 – Jan 2022${c.reset}`,
    `  ${c.dim}Vertalo · Austin, TX (contract/hybrid)${c.reset}`,
    `  ${dimInterpunct} Sole front-end developer for Vertalo.com — designed and built the entire public-facing site from zero, delivering a high-performance, accessible interface for a fast-moving digital-asset infrastructure company.`,
    `  ${dimInterpunct} Implemented on Craft CMS, fully integrated with Vertalo's ${c.dim}React / PostgreSQL / AWS${c.reset} stack; engineered scalable front-end architecture to support ongoing content updates throughout the contract.`,
    `  ${dimInterpunct} Applied SEO best practices and performance optimisation across all pages; ensured full accessibility compliance for an institutional client audience.`,
    `  ${dimInterpunct} Translated complex blockchain, tokenisation, and regulatory concepts into clear, client-facing copy and layout — making technical infrastructure legible to fund managers and institutional investors.`,
    `  ${dimInterpunct} Collaborated directly with company leadership on messaging, UX structure, and content from first commit through post-launch refinement and handoff.`,
    `  ${c.blue}${c.bold}Web Developer${c.reset}  ${c.dim}Jun 2018 – Jan 2020${c.reset}`,
    `  ${c.dim}milMedia Group · Killeen–Temple Area (on-site)${c.reset}`,
    `  ${dimInterpunct} Built and maintained marketing and resource websites for military-adjacent clients using HTML, CSS, JavaScript, and React — responsive layouts, accessible UI, and cross-browser QA under agency deadlines.`,
    `  ${dimInterpunct} Customised CMS platforms ${c.dim}(WordPress and similar)${c.reset} to streamline client content workflows and reduce editorial overhead across multiple concurrent accounts.`,
    `  ${dimInterpunct} Managed hosting environments and deployment pipelines; delivered iterative feature additions and bug fixes with minimal client downtime across a live production portfolio.`,
    `  ${dimInterpunct} Represented the agency at regional conventions and events — booth setup, live demos, and direct prospect engagement.`,
    `  ${c.blue}${c.bold}Technical Support Specialist${c.reset}  ${c.dim}Sep 2017 – Jan 2018${c.reset}`,
    `  ${c.dim}Sykes Enterprises · Remote${c.reset}`,
    `  ${dimInterpunct} Provided Tier-2 technical support for complex hardware, OS, and application-layer issues — diagnosing root causes efficiently under high-volume queue conditions.`,
    `  ${dimInterpunct} Communicated resolutions clearly and patiently to non-technical customers; maintained consistently strong CSAT scores throughout the engagement.`,
    `  ${dimInterpunct} Documented edge cases and escalated appropriately; contributed resolved patterns to the team knowledge base.`,
    hr,
    `  ${c.pink}EDUCATION${c.reset}`,
    hr,
    `  ${c.blue}Southern New Hampshire University / Kenzie Academy${c.reset}`,
    `  ${c.dim}A.S. Software Engineering  ·  2021 – 2023${c.reset}`,
    `  ${dimInterpunct} Java & OOP, data structures, REST, collaborative workflow, UML. Unit testing discipline; Git; integrating third-party APIs.`,
    '',
    `  ${c.blue}Temple College${c.reset}  ${c.dim}GED with Honors  ·  2016${c.reset}`,
  ]
}

function resumeCertTailLines(): string[] {
  const hr = resumeHrBar()
  return [
    hr,
    `  ${c.pink}CERTIFICATIONS${c.reset}`,
    hr,
    `  ${dimInterpunct} MIT OpenCourseWare — Introduction to CS & programming`,
    `  ${dimInterpunct} freeCodeCamp — JavaScript, HTML, CSS certificates`,
    '',
    `  ${c.dim}References:${c.reset} available on request ${c.dim}(ping via ${c.blue}contact${c.reset}${c.dim} tile).${c.reset}`,
    '',
  ]
}

export function resumeWindowMainLines(): string[] {
  return [...resumeEducationEndLines(), ...resumeCertTailLines()]
}

/**
 * Header block only (name + contact) — no leading/trailing blank lines so the tile
 * does not reserve a tall “dead” gap before PROFILE when lead/body sit in separate grids.
 */
export function resumeWindowLeadLines(): string[] {
  return resumeEducationEndLines().slice(1, 4)
}

/** From the first rule line (hr before PROFILE) through certs — pairs with {@link resumeWindowLeadLines}. */
export function resumeWindowBodyLines(): string[] {
  return [...resumeEducationEndLines().slice(5), ...resumeCertTailLines()]
}

export function resumeWindowSkillsLines(): string[] {
  return skillsDetailLines()
}

export function resumeWindowSplitPayload(): {
  content: string[]
  resumeLead: string[]
  resumeBody: string[]
  resumeSkills: string[]
} {
  const lead = resumeWindowLeadLines()
  const body = resumeWindowBodyLines()
  return {
    content: [...lead, ...body],
    resumeLead: lead,
    resumeBody: body,
    resumeSkills: resumeWindowSkillsLines(),
  }
}

/** Flat wall of text for `resume` in the shell (includes inline SKILLS section) */
export function resumeAndSkillsLines(): string[] {
  const hr = resumeHrBar()
  const headSkillsOpener = [hr, `  ${c.pink}SKILLS${c.reset}`, hr, '']
  return [
    ...resumeEducationEndLines(),
    ...headSkillsOpener,
    ...skillsDetailLines().slice(1),
    ...resumeCertTailLines(),
  ]
}
