// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'

const rootId = 'phoeme-root'

async function mountPage(): Promise<HTMLElement> {
  document.body.innerHTML = `
    <a class="phoeme-skip" href="#content">Skip to content</a>
    <div id="${rootId}"></div>
  `
  vi.resetModules()
  await import('./main.ts')
  const root = document.getElementById(rootId)
  if (!root) throw new Error('expected #phoeme-root to exist')
  return root
}

describe('phoeme main structure', () => {
  beforeEach(() => {
    document.body.replaceChildren()
    document.title = ''
  })

  it('renders pipeline steps, mobile compare labels, FAQ wrappers, and deduped CTA links', async () => {
    const root = await mountPage()

    const steps = [...root.querySelectorAll<HTMLElement>('.pm-pipeline-step')]
    expect(steps.map((el) => el.textContent?.trim())).toEqual(['01', '02', '03', '04'])

    const compareRows = root.querySelectorAll<HTMLElement>('.pm-compare-row')
    expect(compareRows.length).toBeGreaterThan(0)
    for (const row of compareRows) {
      const labels = row.querySelectorAll<HTMLElement>('.pm-compare-mobile-label')
      expect(labels).toHaveLength(2)
      expect(labels[0]?.textContent).toBe('Typical cloud')
      expect(labels[1]?.textContent).toBe('Phoneme')
    }

    const faqWraps = root.querySelectorAll<HTMLElement>('.pm-faq-answer-wrap')
    expect(faqWraps.length).toBeGreaterThan(0)
    for (const wrap of faqWraps) {
      expect(wrap.querySelector('.pm-faq-answer')).not.toBeNull()
    }

    const ctaSection = root.querySelector('.pm-section--cta')
    expect(ctaSection).not.toBeNull()
    const ctaLinks = [...(ctaSection?.querySelectorAll<HTMLAnchorElement>('.pm-actions .pm-button') ?? [])]
    expect(ctaLinks).toHaveLength(2)
    expect(ctaLinks.map((link) => link.textContent?.trim())).toEqual(['Download for Windows', 'Documentation'])
    expect(ctaLinks.some((link) => /github/i.test(link.textContent ?? ''))).toBe(false)
  })
})
