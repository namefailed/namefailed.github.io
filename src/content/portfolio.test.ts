import { describe, it, expect } from 'vitest'
import {
  projectsLines,
  whoamiAboutLines,
  linksAndContactLines,
  resumeAndSkillsLines,
  resumeWindowSplitPayload,
  PORTFOLIO_PROJECTS,
} from './portfolio'

// ── projectsLines ────────────────────────────────────────────────────────────

describe('projectsLines', () => {
  it('returns a non-empty array', () => {
    const lines = projectsLines()
    expect(lines.length).toBeGreaterThan(0)
  })

  it('contains no undefined entries', () => {
    const lines = projectsLines()
    for (const line of lines) {
      expect(line).not.toBeUndefined()
    }
  })

  it('contains at least one line mentioning a project from PORTFOLIO_PROJECTS', () => {
    const lines = projectsLines()
    const joined = lines.join('\n')
    const firstProject = PORTFOLIO_PROJECTS[0]
    expect(firstProject).toBeDefined()
    // The first project's title should appear somewhere in the output
    expect(joined).toContain(firstProject!.title)
  })
})

// ── whoamiAboutLines ─────────────────────────────────────────────────────────

describe('whoamiAboutLines', () => {
  it('returns a non-empty array', () => {
    const lines = whoamiAboutLines()
    expect(lines.length).toBeGreaterThan(0)
  })

  it('contains no undefined entries', () => {
    const lines = whoamiAboutLines()
    for (const line of lines) {
      expect(line).not.toBeUndefined()
    }
  })

  it('contains at least one non-empty string', () => {
    const lines = whoamiAboutLines()
    const nonEmpty = lines.filter(l => l.trim().length > 0)
    expect(nonEmpty.length).toBeGreaterThan(0)
  })
})

// ── linksAndContactLines ─────────────────────────────────────────────────────

describe('linksAndContactLines', () => {
  it('returns a non-empty array', () => {
    const lines = linksAndContactLines()
    expect(lines.length).toBeGreaterThan(0)
  })

  it('contains no undefined entries', () => {
    const lines = linksAndContactLines()
    for (const line of lines) {
      expect(line).not.toBeUndefined()
    }
  })

  it('contains github or linkedin somewhere in the output', () => {
    const lines = linksAndContactLines()
    const joined = lines.join('\n').toLowerCase()
    const hasContact = joined.includes('github') || joined.includes('linkedin') || joined.includes('email')
    expect(hasContact).toBe(true)
  })
})

// ── resumeAndSkillsLines ─────────────────────────────────────────────────────

describe('resumeAndSkillsLines', () => {
  it('returns a non-empty array', () => {
    const lines = resumeAndSkillsLines()
    expect(lines.length).toBeGreaterThan(0)
  })

  it('contains no undefined entries', () => {
    const lines = resumeAndSkillsLines()
    for (const line of lines) {
      expect(line).not.toBeUndefined()
    }
  })

  it('contains more than 10 lines (full resume)', () => {
    const lines = resumeAndSkillsLines()
    expect(lines.length).toBeGreaterThan(10)
  })
})

// ── resumeWindowSplitPayload ─────────────────────────────────────────────────

describe('resumeWindowSplitPayload', () => {
  it('returns an object with content, resumeLead, resumeBody, resumeSkills arrays', () => {
    const payload = resumeWindowSplitPayload()
    expect(Array.isArray(payload.content)).toBe(true)
    expect(Array.isArray(payload.resumeLead)).toBe(true)
    expect(Array.isArray(payload.resumeBody)).toBe(true)
    expect(Array.isArray(payload.resumeSkills)).toBe(true)
  })

  it('all four arrays are non-empty', () => {
    const payload = resumeWindowSplitPayload()
    expect(payload.content.length).toBeGreaterThan(0)
    expect(payload.resumeLead.length).toBeGreaterThan(0)
    expect(payload.resumeBody.length).toBeGreaterThan(0)
    expect(payload.resumeSkills.length).toBeGreaterThan(0)
  })

  it('no payload array contains undefined', () => {
    const payload = resumeWindowSplitPayload()
    const all = [...payload.content, ...payload.resumeLead, ...payload.resumeBody, ...payload.resumeSkills]
    for (const line of all) {
      expect(line).not.toBeUndefined()
    }
  })

  it('content is the concatenation of resumeLead and resumeBody', () => {
    const payload = resumeWindowSplitPayload()
    expect(payload.content).toEqual([...payload.resumeLead, ...payload.resumeBody])
  })
})

// ── PORTFOLIO_PROJECTS ───────────────────────────────────────────────────────

describe('PORTFOLIO_PROJECTS', () => {
  it('is a non-empty array', () => {
    expect(PORTFOLIO_PROJECTS.length).toBeGreaterThan(0)
  })

  it('every project has a non-empty title and lines array', () => {
    for (const project of PORTFOLIO_PROJECTS) {
      expect(typeof project.title).toBe('string')
      expect(project.title.length).toBeGreaterThan(0)
      expect(Array.isArray(project.lines)).toBe(true)
      expect(project.lines.length).toBeGreaterThan(0)
    }
  })
})
