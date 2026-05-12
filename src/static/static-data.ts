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

export interface ExperienceEntry {
  title: string
  company: string
  period: string
  location: string
  bullets: readonly string[]
}

export const PROFILE = {
  name: 'Matt Grey',
  headline: 'Software engineer · TypeScript · React · browser UI',
  location: 'Killeen–Temple, TX · US Central',
  statusOpen: true,
  summary:
    'I build web interfaces from discovery to delivery — scoping requirements, implementing UI, wiring integrations, and handing off something maintainable. 8+ years freelance, backed by a B.S. in Software Engineering (SNHU / Kenzie Academy). TypeScript-first, with a bias toward layouts that survive real conditions: narrow viewports, zoom, reduced-motion, and the next developer who reads the code.',
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
    text: 'Matthew Grey — LinkedIn profile',
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
  'React',
  'HTML / CSS',
  'Node.js',
  'Vite',
  'REST APIs',
  'Git',
  'Accessibility',
  'WordPress / CMS',
]

export const EXPERIENCE: readonly ExperienceEntry[] = [
  {
    title: 'Freelance Web Developer',
    company: 'Independent',
    period: 'Jan 2017 – present',
    location: 'Killeen, TX (remote)',
    bullets: [
      'End-to-end delivery for small businesses and nonprofits: scoping, UI build, integrations, hand-off docs.',
      'Stack varies by project — TypeScript, React, Vite, vanilla JS/CSS, Node.js, CMS platforms.',
      'Current focus: accessible component patterns, performance budgets, and iterative client feedback loops.',
    ],
  },
  {
    title: 'Web Developer',
    company: 'Topsarge / milMedia',
    period: 'Jun 2018 – Jan 2020',
    location: 'Killeen, TX',
    bullets: [
      'Built and maintained marketing sites under tight deadlines for military-adjacent clients.',
      'Responsive HTML/CSS layouts, WordPress theming, cross-browser QA, and hosting ticket triage.',
      'Coordinated with designers, content editors, and stakeholders across multiple concurrent campaigns.',
    ],
  },
  {
    title: 'Technical Support Specialist (Tier 2)',
    company: 'Sykes',
    period: 'Sep 2017 – Jan 2018',
    location: 'Temple, TX',
    bullets: [
      'Escalated customer issues, documented resolutions, and maintained ticket queues.',
      'Built troubleshooting familiarity with network and software configurations under production pressure.',
    ],
  },
]

export const EDUCATION: readonly string[] = [
  'B.S. Software Engineering · Southern New Hampshire University / Kenzie Academy · 2021–2025',
  'Temple College · GED with Honors · 2016',
]

export const CERTIFICATIONS: readonly string[] = [
  'MIT OpenCourseWare — Introduction to Computer Science & Programming',
  'freeCodeCamp — JavaScript, HTML, and CSS certificates',
]
