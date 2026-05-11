/**
 * Copy for `/static/` résumé-style sections.
 * **Projects** render from `PORTFOLIO_PROJECTS` in `content/portfolio.ts` (see `main.ts`). Keep profile,
 * skills tags, experience, education, certs, and contact aligned with portfolio when facts change.
 */

export interface PlainProject {
  title: string
  meta?: string
  blurb?: string
  url?: string
  repo?: string
}

export const PROFILE = {
  name: 'Matt Grey',
  headline: 'Software engineer / web developer',
  location: 'Killeen–Temple, TX · US Central',
  statusOpen: true,
  summary:
    'Software developer with 8+ years delivering web work end-to-end — scoping, UI implementation, integrations, and hand-off. SNHU software engineering undergrad (Kenzie track): designing, building, and shipping software. Comfortable on the browser stack (TypeScript, React, HTML/CSS) alongside Java-heavy coursework habits (REST, HTTP clients, unit tests). Pragmatic testing, concise docs, iterative delivery. Family is a pillar — partner and son keep the bar honest.',
} as const

export const CONTACT = [
  { label: 'Site', href: 'https://mrgrey.dev', text: 'mrgrey.dev' },
  {
    label: 'GitHub',
    href: 'https://github.com/namefailed',
    text: 'github.com/namefailed',
  },
  {
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/in/matthew-grey-215615179/',
    text: 'Matthew Grey — profile & experience',
  },
  { label: 'Email', href: 'mailto:namefailedx@gmail.com', text: 'namefailedx@gmail.com' },
  {
    label: 'Phone',
    href: 'tel:+12545349544',
    text: '+1 254-534-9544 · voice / SMS',
  },
] as const

/** Short tags for the palette row */
export const SKILLS_PRIMARY = [
  'TypeScript',
  'JavaScript',
  'HTML/CSS',
  'React',
  'Node.js',
  'REST',
  'Git',
  'Vite',
  'Accessibility-aware UI',
  'WordPress/CMS',
]

export const EXPERIENCE: readonly string[] = [
  'Freelance web — Jan 2017–present · Killeen, TX — discovery through launch for small businesses and nonprofits; HTML/CSS/JS/React/Git and CMS stacks as needed.',
  'Web developer · Topsarge / milMedia — Jun 2018–Jan 2020 — marketing sites under deadline, responsive layouts, WordPress/CMS, ticket fixes across hosting and stakeholders.',
  'Technical support (tier 2) · Sykes — Sept 2017–Jan 2018 · Temple, TX — troubleshooting and documented resolutions.',
]

export const EDUCATION: readonly string[] = [
  'B.S. Software Engineering · Southern New Hampshire University / Kenzie Academy · 2021–2025',
  'Temple College · GED with Honors · 2016',
]

export const CERTIFICATIONS: readonly string[] = [
  'MIT OpenCourseWare — Introduction to CS & programming',
  'freeCodeCamp — JS, HTML, CSS certificates',
]
