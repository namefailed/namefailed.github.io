import { describe, it, expect } from 'vitest'
import { resumeAndSkillsLines } from './resume-copy'
import { EXPERIENCE, PROFILE, EDUCATION, CERTIFICATIONS } from './resume-facts'

describe('resume-facts alignment', () => {
  it('résumé output includes canonical profile name and first employer', () => {
    const joined = resumeAndSkillsLines().join('\n')
    expect(joined).toContain(PROFILE.name.toUpperCase())
    expect(joined).toContain(EXPERIENCE[0]!.title)
    expect(joined).toContain(EXPERIENCE[2]!.company) // Vertalo
  })

  it('résumé bullets match shared experience facts', () => {
    const joined = resumeAndSkillsLines().join('\n')
    for (const entry of EXPERIENCE) {
      expect(joined).toContain(entry.bullets[0]!)
    }
  })

  it('education and certifications come from shared facts', () => {
    const joined = resumeAndSkillsLines().join('\n')
    for (const line of EDUCATION) expect(joined).toContain(line.split(' · ')[0]!)
    for (const cert of CERTIFICATIONS) expect(joined).toContain(cert)
  })
})
