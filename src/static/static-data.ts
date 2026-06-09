/**
 * Copy for `/static/` résumé-style sections.
 * **Projects** render from `PORTFOLIO_PROJECTS` in `content/portfolio.ts` (see `main.ts`).
 * Profile, skills, experience, education, certs, and contact live in `content/copy/resume-facts.ts`.
 */

export type { ExperienceEntry, EducationEntry } from '../content/copy/resume-facts'

export {
  PROFILE,
  CONTACT,
  SKILLS_PRIMARY,
  EXPERIENCE,
  EDUCATION,
  CERTIFICATIONS,
} from '../content/copy/resume-facts'

export interface PlainProject {
  title: string
  meta?: string
  blurb?: string
  url?: string
  repo?: string
  /** Path relative to the site root (e.g. `img/legacy/portfolio-awfdn.svg`). When present, rendered as a preview image above the card body. */
  thumb?: string
  /** When true, skip the WordPress mShots live screenshot and rely solely on {@link thumb}. */
  skipLiveScreenshot?: boolean
  thumbPosition?: string
  previewKind?: 'website' | 'app' | 'portfolio' | 'client'
}
