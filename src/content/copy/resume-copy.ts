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
  'Small commits, descriptive messages, reviews when pairing.',
  'Prefer boring stacks that teammates can grep six months later.',
  'Tests where they save regressions; docs where onboarding hurts.',
  'Ship thin slices: measurable checkpoints instead of big-bang reveals.',
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
    `  ${c.dim}github.com/namefailed  ·  mrgrey.dev  ·  linkedin.com/in/matthew-grey-215615179${c.reset}`,
    '',
    hr,
    `  ${c.pink}PROFILE${c.reset}`,
    hr,
    `  Software developer with 8+ years shipping web work end-to-end — scoping, UI implementation, integrations, and handoff. Comfortable owning the front of the stack ${c.dim}(TypeScript, React, HTML/CSS)${c.reset} while collaborating on Java-heavy coursework ${c.dim}(unit tests, HTTP/JSON clients, REST framing)${c.reset}. Day-to-day: Git-driven workflow, pragmatic testing, README-level docs for teammates, and iterative delivery with stakeholder visibility.`,
    hr,
    `  ${c.pink}EXPERIENCE${c.reset}`,
    hr,
    `  ${c.blue}${c.bold}Freelance Web Development / Design${c.reset}  ${c.dim}Jan 2017 – Present${c.reset}`,
    `  ${c.dim}Killeen, TX${c.reset}`,
    `  ${dimInterpunct} Partner with clients from first conversation through launch: requirements, wireframes or templates, custom themes, performance passes.`,
    `  ${dimInterpunct} Stack varies by client — ${c.dim}HTML, CSS, JavaScript, React, Git, CMS.`,
    `  ${dimInterpunct} Small businesses, nonprofits, and individuals; repeat engagements.`,
    `  ${c.blue}${c.bold}Web Developer / Tech${c.reset}  ${c.dim}Jun 2018 – Jan 2020${c.reset}`,
    `  ${c.dim}Topsarge Business Solutions / milMedia Group · Killeen, TX${c.reset}`,
    `  ${dimInterpunct} Built and maintained marketing and resource sites under deadlines. Responsive layouts; CMS configuration ${c.dim}(WordPress and similar).`,
    `  ${dimInterpunct} Ticket-driven fixes; coordination with stakeholders and hosting. Represented the company at regional events and client outreach.`,
    `  ${c.blue}${c.bold}Technical Support Specialist${c.reset}  ${c.dim}Sept 2017 – Jan 2018${c.reset}`,
    `  ${c.dim}Sykes Enterprises · Temple, TX${c.reset}`,
    `  ${dimInterpunct} Tier-2 troubleshooting — hardware, OS, and application layers. Documented resolutions; strong satisfaction scores on surveys.`,
    hr,
    `  ${c.pink}EDUCATION${c.reset}`,
    hr,
    `  ${c.blue}Southern New Hampshire University / Kenzie Academy${c.reset}`,
    `  ${c.dim}B.S. Software Engineering  ·  2021 – 2025${c.reset}`,
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
