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
  /** Role category — drives the colour strip on the card */
  type?: 'freelance' | 'contract' | 'fulltime' | 'volunteer'
  /** Highlight with a "Featured" badge */
  featured?: boolean
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
    title: 'Freelance Web Developer / Designer',
    company: 'Self-employed',
    period: 'Jan 2017 – present',
    location: 'Remote / hybrid',
    type: 'freelance',
    bullets: [
      'Delivered end-to-end web projects for small businesses and nonprofits: scoping, design, development, deployment, and client training.',
      'Stack varies by project — TypeScript, React, Vite, vanilla JS/CSS, Node.js, CMS platforms.',
      'Sole point of contact across all phases; long-term repeat client relationships built on direct communication and full ownership.',
    ],
  },
  {
    title: 'Deputy Web Minister',
    company: 'Society for Creative Anachronism',
    period: 'Feb 2025 – Aug 2025',
    location: 'Killeen–Temple Area · hybrid',
    type: 'volunteer',
    bullets: [
      'Maintained and updated the official SCA website for a large volunteer-driven historical recreation organization.',
      'Kept officer rosters, event listings, and announcements accurate and compliant with SCA digital policies.',
      'Coordinated with the Web Minister and regional officers to publish timely, consistent updates across multiple branches.',
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
      'Designed and built the entire public-facing Vertalo.com website from the ground up — responsive, performant, and accessible.',
      'Implemented on Craft CMS, integrated with Vertalo\'s React / PostgreSQL / AWS stack.',
      'Translated complex blockchain and digital-asset concepts into clear, institutional-grade web copy and layout.',
      'Collaborated directly with leadership on messaging, UX structure, SEO, and content throughout the contract.',
    ],
  },
  {
    title: 'Web Developer',
    company: 'milMedia Group',
    period: 'Jun 2018 – Jan 2020',
    location: 'Killeen, TX · on-site',
    type: 'fulltime',
    bullets: [
      'Built and maintained marketing sites for military-adjacent clients using HTML, CSS, JavaScript, and React.',
      'WordPress theming, CMS customization, hosting management, and cross-browser QA under tight deadlines.',
      'Represented the company at conventions; coordinated with designers, editors, and stakeholders across campaigns.',
    ],
  },
  {
    title: 'Technical Support Specialist',
    company: 'Sykes Enterprises',
    period: 'Sep 2017 – Jan 2018',
    location: 'Remote',
    type: 'fulltime',
    bullets: [
      'Tier-2 technical support: diagnosed hardware, OS, and application-layer issues for customers.',
      'Documented resolutions and escalated edge cases; maintained strong satisfaction scores throughout.',
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
