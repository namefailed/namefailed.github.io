/**
 * Résumé ANSI formatters for CLI `resume` and the résumé tile.
 * Structured facts live in `resume-facts.ts` (shared with `/static/`).
 */

import { c } from '../../theme'
import { dimInterpunct, dimRule, sectionHeadingLine, skillMeterLine } from './ansi-widgets'
import {
  CERTIFICATIONS,
  EDUCATION_ENTRIES,
  EXPERIENCE,
  PROFILE,
  experienceMetaLine,
  type ExperienceEntry,
} from './resume-facts'

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

function experienceBlockLines(entry: ExperienceEntry): string[] {
  return [
    `  ${c.blue}${c.bold}${entry.title}${c.reset}  ${c.dim}${entry.period}${c.reset}`,
    `  ${c.dim}${experienceMetaLine(entry)}${c.reset}`,
    ...entry.bullets.map(bullet => `  ${dimInterpunct} ${bullet}`),
  ]
}

function educationBlockLines(): string[] {
  const lines: string[] = []
  for (const edu of EDUCATION_ENTRIES) {
    if (edu.resumeDetails?.length) {
      lines.push(`  ${c.blue}${edu.resumeSchool}${c.reset}`)
      lines.push(`  ${c.dim}${edu.resumeCredentialLine}${c.reset}`)
      lines.push(...edu.resumeDetails.map(detail => `  ${dimInterpunct} ${detail}`))
      lines.push('')
      continue
    }
    lines.push(
      `  ${c.blue}${edu.resumeSchool}${c.reset}  ${c.dim}${edu.resumeCredentialLine}${c.reset}`,
    )
  }
  return lines
}

function resumeEducationEndLines(): string[] {
  const hr = resumeHrBar()
  return [
    '',
    `  ${c.pink}${c.bold}${PROFILE.name.toUpperCase()}${c.reset}  ${c.dim}·${c.reset}  Developer / Engineer`,
    `  ${c.dim}Killeen–Temple, TX  ·  namefailedx@gmail.com  ·  +1 254-534-9544${c.reset}`,
    `  ${c.dim}github.com/namefailed  ·  mrgrey.site  ·  linkedin.com/in/matthew-grey-215615179${c.reset}`,
    '',
    hr,
    `  ${c.pink}PROFILE${c.reset}`,
    hr,
    `  ${PROFILE.summary}`,
    hr,
    `  ${c.pink}EXPERIENCE${c.reset}`,
    hr,
    ...EXPERIENCE.flatMap(entry => experienceBlockLines(entry)),
    hr,
    `  ${c.pink}EDUCATION${c.reset}`,
    hr,
    ...educationBlockLines(),
  ]
}

function resumeCertTailLines(): string[] {
  const hr = resumeHrBar()
  return [
    hr,
    `  ${c.pink}CERTIFICATIONS${c.reset}`,
    hr,
    ...CERTIFICATIONS.map(cert => `  ${dimInterpunct} ${cert}`),
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
 * The slice offsets here and in {@link resumeWindowBodyLines} index into
 * resumeEducationEndLines(); keep them in step if that line layout changes.
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
