/**
 * Canonical résumé facts — shared by `/static/` and CLI/tile copy in `resume-copy.ts`.
 * Update profile, jobs, education, and certs here once; both surfaces stay aligned.
 */

export interface ExperienceEntry {
  title: string
  company: string
  period: string
  location: string
  bullets: readonly string[]
  /** Role category — drives the colour strip on classic experience cards */
  type?: 'freelance' | 'contract' | 'fulltime' | 'volunteer'
  /** Highlight with a "Featured" badge on classic view */
  featured?: boolean
}

export interface EducationEntry {
  /** One-line string for classic `/static/` lists */
  readonly plainLine: string
  readonly resumeSchool: string
  readonly resumeCredentialLine: string
  readonly resumeDetails?: readonly string[]
}

export const PROFILE = {
  name: 'Matt Grey',
  headline: 'Software engineer · TypeScript · React · browser UI',
  location: 'Killeen–Temple, TX · US Central',
  statusOpen: true,
  summary:
    'Solo software engineer, freelancing since 2017 — I own the whole arc: scoping, design, build, and handoff. Shipped the full public site for Vertalo (digital-asset / fintech infrastructure) and built for nonprofits, agencies, and independent clients. TypeScript-first, with a bias toward layouts that survive real conditions: narrow viewports, zoom, reduced-motion, and the next developer who reads the code.',
} as const

export const CONTACT = [
  { label: 'Site', href: 'https://mrgrey.site', text: 'mrgrey.site' },
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

/** Short tags for the classic skills row */
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
] as const

export const EXPERIENCE: readonly ExperienceEntry[] = [
  {
    title: 'Freelance Web Developer / Designer',
    company: 'Self-employed',
    period: 'Jan 2017 – present',
    location: 'Remote / hybrid',
    type: 'freelance',
    bullets: [
      "Ran 15+ client projects end-to-end — discovery, design, build, deploy, and training. No hand-offs; I'm the one accountable.",
      'Shipped responsive, accessible web experiences across TypeScript, React, Vite, Node.js, and CMS platforms; stack chosen per project, not habit.',
      'Managed hosting environments and long-term feature cadence for retainer clients, keeping production healthy well past launch day.',
      'One point of contact, start to finish — the same person who scoped it builds it and is still around after launch.',
    ],
  },
  {
    title: 'Deputy Web Minister',
    company: 'Society for Creative Anachronism',
    period: 'Feb 2025 – Aug 2025',
    location: 'Killeen–Temple Area · hybrid',
    type: 'volunteer',
    bullets: [
      "Kept the official site for one of the world's largest volunteer historical groups current and in line with SCA's web policies.",
      'Restructured site content, officer rosters, and event listings to improve clarity and usability for members and organizers across multiple regional branches.',
      'Coordinated cross-branch publishing with the Web Minister and regional officers; maintained consistency and timeliness during a high-volume event season.',
      'Handled technical troubleshooting and CMS administration in a fully volunteer, distributed environment — reliable delivery without a conventional support chain.',
    ],
  },
  {
    title: 'Frontend Developer',
    company: 'Vertalo',
    period: 'Jan 2021 – Jan 2022',
    location: 'Austin, TX · hybrid',
    type: 'contract',
    featured: true,
    bullets: [
      'Front-end developer on the public Vertalo.com — designed and built the marketing site for an institutional audience: responsive, fast, and accessible.',
      "Built the front end on Craft CMS, against Vertalo's React / PostgreSQL / AWS stack, so non-developers could manage content after launch.",
      'Applied SEO and performance work across the site; built to accessibility standards (semantic markup, keyboard nav, contrast) for an institutional audience.',
      'Turned dense blockchain and digital-asset material into plain, credible copy and layout for fund managers and investors.',
      'Collaborated directly with company leadership on messaging, UX, and content — from first commit through post-launch refinement and handoff.',
    ],
  },
  {
    title: 'Web Developer',
    company: 'milMedia Group',
    period: 'Jun 2018 – Jan 2020',
    location: 'Killeen, TX · on-site',
    type: 'fulltime',
    bullets: [
      'Built and maintained responsive, accessible marketing sites for military-adjacent clients using HTML, CSS, JavaScript, and React — cross-browser QA and accessible UI under agency deadlines.',
      'Customized CMS platforms to streamline client content workflows and reduce editorial overhead across multiple concurrent accounts.',
      'Handled hosting, deploys, and the support queue; shipped features and fixes to live client sites without taking them down.',
      'Represented the agency at regional conventions — live demos, booth setup, and direct prospect engagement.',
    ],
  },
  {
    title: 'Technical Support Specialist',
    company: 'Sykes Enterprises',
    period: 'Sep 2017 – Jan 2018',
    location: 'Remote',
    type: 'fulltime',
    bullets: [
      'Tier-2 technical support: diagnosed complex hardware, OS, and application-layer issues under high call-volume conditions.',
      'Explained fixes plainly to non-technical callers and kept satisfaction high.',
      'Documented edge cases and escalated to appropriate teams; contributed resolved patterns to the team knowledge base.',
    ],
  },
]

export const EDUCATION_ENTRIES: readonly EducationEntry[] = [
  {
    plainLine:
      'A.S. Software Engineering · Southern New Hampshire University / Kenzie Academy · 2021–2023',
    resumeSchool: 'Southern New Hampshire University / Kenzie Academy',
    resumeCredentialLine: 'A.S. Software Engineering  ·  2021 – 2023',
    resumeDetails: [
      'Java & OOP, data structures, REST, collaborative workflow, UML. Unit testing discipline; Git; integrating third-party APIs.',
    ],
  },
  {
    plainLine: 'Temple College · GED with Honors · 2016',
    resumeSchool: 'Temple College',
    resumeCredentialLine: 'GED with Honors  ·  2016',
  },
]

export const CERTIFICATIONS: readonly string[] = [
  'MIT OpenCourseWare — Introduction to Computer Science & Programming',
  'freeCodeCamp — JavaScript, HTML, and CSS certificates',
]

/** One-line education strings for classic `/static/` lists */
export const EDUCATION: readonly string[] = EDUCATION_ENTRIES.map(e => e.plainLine)

/** Second line under a job title in terminal/tile résumé output */
export function experienceMetaLine(entry: ExperienceEntry): string {
  if (entry.type === 'freelance') return entry.location

  const loc = entry.location.replace(/ · hybrid$/i, '').replace(/ · on-site$/i, '')
  const suffix =
    entry.type === 'volunteer'
      ? ' (volunteer/hybrid)'
      : entry.type === 'contract'
        ? ' (contract/hybrid)'
        : entry.location.includes('on-site')
          ? ' (on-site)'
          : entry.location.includes('hybrid')
            ? ' (hybrid)'
            : ''

  return `${entry.company} · ${loc}${suffix}`
}
