/**
 * Résumé + skills matrix strings for CLI `resume`, the résumé tile, and `/plain/` data imports.
 *
 * Split from the barrel on purpose: this file churns whenever I tweak jobs or skill bars,
 * while `projects-catalog.ts` is a different mental mode (client work list).
 */

import { c } from '../../theme'
import { dimInterpunct, dimRule, sectionHeadingLine, skillMeterLine } from './ansi-widgets'

function skillsDetailLines(): string[] {
  const pairs: Array<[string, number]> = [
    ['TypeScript', 88],
    ['JavaScript', 88],
    ['HTML / CSS', 90],
    ['Java', 72],
    ['Python', 68],
    ['SQL', 62],
    ['Bash', 74],
    ['Node.js', 78],
    ['React', 72],
    ['Responsive UI', 86],
    ['Vite / tooling', 78],
    ['Accessibility basics', 68],
    ['CMS / WordPress', 78],
    ['REST APIs', 74],
    ['JSON / HTTP', 82],
    ['OAuth-style auth', 58],
    ['Git', 90],
    ['Linux', 74],
    ['pnpm / npm', 76],
    ['PowerShell', 72],
  ]
  /* Cap label width so the skills rail stays one visual column beside the bars */
  const lw = Math.min(22, Math.max(14, ...pairs.map(([a]) => a.length)))

  return [
    '',
    sectionHeadingLine('languages'),
    '',
    ...pairs.slice(0, 8).map(([l, p]) => skillMeterLine(l, p, lw)),
    '',
    sectionHeadingLine('frontend & UI'),
    '',
    ...pairs.slice(8, 13).map(([l, p]) => skillMeterLine(l, p, lw)),
    '',
    sectionHeadingLine('backend & integration'),
    '',
    ...pairs.slice(13, 16).map(([l, p]) => skillMeterLine(l, p, lw)),
    '',
    sectionHeadingLine('tools & workflow'),
    '',
    ...pairs.slice(16).map(([l, p]) => skillMeterLine(l, p, lw)),
    '',
    sectionHeadingLine('how I like to work'),
    '',
    `${dimInterpunct} Small commits, descriptive messages, reviews when pairing.`,
    `${dimInterpunct} Prefer boring stacks that teammates can grep six months later.`,
    '',
    `${dimInterpunct} Tests where they save regressions; docs where onboarding hurts.`,
    `${dimInterpunct} Ship thin slices: measurable checkpoints instead of big-bang reveals.`,
    '',
  ]
}

function resumeHrBar(): string {
  return dimRule(54)
}

function resumeEducationEndLines(): string[] {
  const hr = resumeHrBar()
  return [
    '',
    `  ${c.pink}${c.bold}MATT GREY${c.reset}  ${c.dim}·${c.reset}  Developer / Engineer`,
    `  ${c.dim}Killeen, TX  ·  namefailedx@gmail.com  ·  +1 254-534-9544${c.reset}`,
    `  ${c.dim}github.com/namefailed  ·  mrgrey.dev${c.reset}`,
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

/** First lines only — paired with `resumeWindowBodyLines` when the tile splits lead vs body */
export function resumeWindowLeadLines(): string[] {
  return resumeEducationEndLines().slice(0, 5)
}

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
