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
    'Web developer with 9 years delivering end-to-end — scoping, design, implementation, and handoff. Shipped the full public-facing site for Vertalo (fintech / digital-asset infrastructure) and built across nonprofits, military-adjacent agencies, and independent clients. TypeScript-first; bias toward layouts that survive real conditions: narrow viewports, zoom, reduced-motion, and the next developer who reads the code.',
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
      'Owned the full project lifecycle for 15+ client engagements — discovery, design, development, deployment, and training — no hand-offs, full accountability at every stage.',
      'Shipped responsive, accessible web experiences across TypeScript, React, Vite, Node.js, and CMS platforms; stack chosen per project, not habit.',
      'Managed hosting environments and long-term feature cadence for retainer clients, keeping production healthy well past launch day.',
      'Built lasting client relationships through direct ownership and transparent communication — primary contact from first conversation through post-launch iterations.',
    ],
  },
  {
    title: 'Deputy Web Minister',
    company: 'Society for Creative Anachronism',
    period: 'Feb 2025 – Aug 2025',
    location: 'Killeen–Temple Area · hybrid',
    type: 'volunteer',
    bullets: [
      'Maintained and improved the official website for one of the world\'s largest volunteer-driven historical organizations, ensuring compliance with SCA digital governance policies.',
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
      'Sole front-end developer: designed and built the entire Vertalo.com public site from scratch — responsive, high-performance, and accessible for an institutional audience.',
      'Implemented on Craft CMS, fully integrated with Vertalo\'s React / PostgreSQL / AWS stack; engineered scalable front-end architecture for ongoing content management.',
      'Applied SEO best practices and performance optimisation across all pages; met full accessibility standards for an enterprise client base.',
      'Translated complex blockchain and digital-asset concepts into clear, institutional-grade copy and layout for fund managers and investors.',
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
      'Customised CMS platforms to streamline client content workflows and reduce editorial overhead across multiple concurrent accounts.',
      'Managed hosting, deployments, and support queues; delivered iterative features and bug fixes with minimal downtime across a live production portfolio.',
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
      'Communicated technical resolutions clearly and patiently to non-technical customers; maintained consistently strong CSAT scores.',
      'Documented edge cases and escalated to appropriate teams; contributed resolved patterns to the team knowledge base.',
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
