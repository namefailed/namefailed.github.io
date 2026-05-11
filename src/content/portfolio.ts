/**
 * Barrel re-export for portfolio-facing copy.
 *
 * Import paths stay `content/portfolio` from shell / tiles; the real files live under `content/copy/`
 * so I can grep “where is resume text” without landing in project cards by accident.
 */

export type { PortfolioProjectEntry } from './copy/projects-catalog'
export { PORTFOLIO_PROJECTS, projectsLines } from './copy/projects-catalog'

export { aboutInfoLines, whoamiAboutLines } from './copy/about-copy'
export { linksAndContactLines } from './copy/contact-copy'

export {
  resumeAndSkillsLines,
  resumeWindowBodyLines,
  resumeWindowLeadLines,
  resumeWindowMainLines,
  resumeWindowSkillsLines,
  resumeWindowSplitPayload,
} from './copy/resume-copy'
