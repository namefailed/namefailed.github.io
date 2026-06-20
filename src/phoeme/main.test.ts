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

  it('sets the document title and renders the footer with brand, nav, stack chips, and credit link', async () => {
    const root = await mountPage()

    expect(document.title).toBe('Phoneme — Local-first voice transcription for Windows')

    const footer = root.querySelector<HTMLElement>('.pm-footer')
    expect(footer).not.toBeNull()
    expect(footer?.getAttribute('role')).toBe('contentinfo')
    expect(footer?.querySelector('.pm-footer-name')?.textContent).toBe('Phoneme')
    expect(footer?.querySelector('.pm-footer-tagline')?.textContent).toBe(
      'Local-first voice transcription for Windows',
    )

    // Footer nav mirrors all three CTAs (including the ghost GitHub link).
    const navLinks = [...(footer?.querySelectorAll<HTMLAnchorElement>('.pm-footer-nav-link') ?? [])]
    expect(navLinks.map((a) => a.textContent)).toEqual(['Download for Windows', 'Documentation', 'GitHub'])
    for (const a of navLinks) {
      expect(a.target).toBe('_blank')
      expect(a.rel).toBe('noopener noreferrer')
    }

    const chips = [...(footer?.querySelectorAll<HTMLElement>('.pm-footer-stack-item') ?? [])].map(
      (li) => li.textContent,
    )
    expect(chips).toEqual(['Rust', 'Tauri 2', 'TypeScript', 'Lit', 'whisper.cpp', 'SQLite', 'ONNX'])

    expect(footer?.querySelector('.pm-footer-license')?.textContent).toBe('MIT / Apache-2.0')
    const credit = footer?.querySelector('.pm-footer-credit')
    expect(credit?.textContent).toBe('Built by Matt Grey / namefailed.')
    const creditLink = credit?.querySelector<HTMLAnchorElement>('.pm-footer-credit-link')
    expect(creditLink?.href).toBe('https://github.com/namefailed')
  })

  it('renders inline code from backtick-delimited rich copy', async () => {
    const root = await mountPage()

    // PHOEME_WORKFLOWS bodies contain backticks like `Ctrl+Alt+I`, which the
    // rich-text path turns into <code class="pm-code"> nodes.
    const codes = [...root.querySelectorAll<HTMLElement>('.pm-card-body .pm-code')]
    expect(codes.length).toBeGreaterThan(0)
    expect(codes.map((c) => c.textContent)).toContain('Ctrl+Alt+I')
    expect(codes.every((c) => c.tagName === 'CODE')).toBe(true)
  })

  it('falls back to the remote hero screenshot when the local image errors', async () => {
    const root = await mountPage()

    const img = root.querySelector<HTMLImageElement>('.pm-shot-img')
    expect(img).not.toBeNull()
    // The page ships with the local fallback image, so the first error swaps to
    // the remote GitHub screenshot.
    expect(img?.getAttribute('src')).toBe('/img/portfolio-phoneme.png')

    img?.dispatchEvent(new Event('error'))
    expect(img?.getAttribute('src')).toBe(
      'https://raw.githubusercontent.com/namefailed/phoneme/master/docs/screenshots/main.png',
    )

    // The listener is registered { once: true }: a second error must not change src.
    img?.dispatchEvent(new Event('error'))
    expect(img?.getAttribute('src')).toBe(
      'https://raw.githubusercontent.com/namefailed/phoneme/master/docs/screenshots/main.png',
    )
  })
})

describe('phoeme FAQ accordion', () => {
  beforeEach(() => {
    document.body.replaceChildren()
    document.title = ''
  })

  function faqButtons(root: HTMLElement): HTMLButtonElement[] {
    return [...root.querySelectorAll<HTMLButtonElement>('.pm-faq-question')]
  }

  function panelFor(root: HTMLElement, button: HTMLButtonElement): HTMLElement {
    const id = button.getAttribute('aria-controls')
    if (!id) throw new Error('faq button missing aria-controls')
    const panel = root.querySelector<HTMLElement>(`#${id}`)
    if (!panel) throw new Error(`faq panel ${id} not found`)
    return panel
  }

  it('renders every FAQ button collapsed with wired aria attributes', async () => {
    const root = await mountPage()
    const buttons = faqButtons(root)
    expect(buttons.length).toBe(7)

    buttons.forEach((button, index) => {
      expect(button.type).toBe('button')
      expect(button.id).toBe(`pm-faq-question-${index}`)
      expect(button.getAttribute('aria-expanded')).toBe('false')
      expect(button.getAttribute('aria-controls')).toBe(`pm-faq-${index}`)
      const panel = panelFor(root, button)
      expect(panel.getAttribute('aria-hidden')).toBe('true')
      expect(panel.getAttribute('aria-labelledby')).toBe(`pm-faq-question-${index}`)
      expect(panel.style.maxHeight).toBe('')
    })
  })

  it('opens a panel on click and sets an inline maxHeight from scrollHeight', async () => {
    const root = await mountPage()
    const [first] = faqButtons(root)
    if (!first) throw new Error('expected a first FAQ button')
    const panel = panelFor(root, first)

    // happy-dom reports scrollHeight 0, so the inline value is "0px" — the point
    // is that a non-empty pixel value gets written when open.
    Object.defineProperty(panel, 'scrollHeight', { configurable: true, value: 240 })

    first.click()

    expect(first.getAttribute('aria-expanded')).toBe('true')
    expect(panel.getAttribute('aria-hidden')).toBe('false')
    expect(panel.style.maxHeight).toBe('240px')
  })

  it('toggles the same panel closed on a second click and clears maxHeight', async () => {
    const root = await mountPage()
    const [first] = faqButtons(root)
    if (!first) throw new Error('expected a first FAQ button')
    const panel = panelFor(root, first)
    Object.defineProperty(panel, 'scrollHeight', { configurable: true, value: 180 })

    first.click()
    expect(first.getAttribute('aria-expanded')).toBe('true')

    first.click()
    expect(first.getAttribute('aria-expanded')).toBe('false')
    expect(panel.getAttribute('aria-hidden')).toBe('true')
    expect(panel.style.maxHeight).toBe('')
  })

  it('collapses any previously open panel when another opens (single-open accordion)', async () => {
    const root = await mountPage()
    const buttons = faqButtons(root)
    const [first, second] = buttons
    if (!first || !second) throw new Error('expected at least two FAQ buttons')
    const firstPanel = panelFor(root, first)
    const secondPanel = panelFor(root, second)
    Object.defineProperty(firstPanel, 'scrollHeight', { configurable: true, value: 120 })
    Object.defineProperty(secondPanel, 'scrollHeight', { configurable: true, value: 200 })

    first.click()
    expect(first.getAttribute('aria-expanded')).toBe('true')
    expect(firstPanel.style.maxHeight).toBe('120px')

    second.click()
    // Opening the second collapses the first via the buttons.forEach reset loop.
    expect(second.getAttribute('aria-expanded')).toBe('true')
    expect(secondPanel.style.maxHeight).toBe('200px')
    expect(first.getAttribute('aria-expanded')).toBe('false')
    expect(firstPanel.getAttribute('aria-hidden')).toBe('true')
    expect(firstPanel.style.maxHeight).toBe('')
  })

  it('moves focus with ArrowDown/ArrowRight wrapping past the last button', async () => {
    const root = await mountPage()
    const buttons = faqButtons(root)
    const last = buttons.length - 1

    buttons[0]?.focus()
    buttons[0]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    expect(document.activeElement).toBe(buttons[1])

    buttons[0]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    expect(document.activeElement).toBe(buttons[1])

    // Wrap-around: ArrowDown on the last button focuses the first.
    buttons[last]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    expect(document.activeElement).toBe(buttons[0])
  })

  it('moves focus with ArrowUp/ArrowLeft wrapping before the first button', async () => {
    const root = await mountPage()
    const buttons = faqButtons(root)
    const last = buttons.length - 1

    // Wrap-around: ArrowUp on the first button focuses the last.
    buttons[0]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }))
    expect(document.activeElement).toBe(buttons[last])

    buttons[2]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))
    expect(document.activeElement).toBe(buttons[1])
  })

  it('jumps to first and last with Home and End', async () => {
    const root = await mountPage()
    const buttons = faqButtons(root)
    const last = buttons.length - 1

    buttons[2]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }))
    expect(document.activeElement).toBe(buttons[last])

    buttons[last]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }))
    expect(document.activeElement).toBe(buttons[0])
  })

  it('ignores keys that are not navigation keys without moving focus or preventing default', async () => {
    const root = await mountPage()
    const buttons = faqButtons(root)

    buttons[1]?.focus()
    const event = new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true })
    buttons[1]?.dispatchEvent(event)

    expect(document.activeElement).toBe(buttons[1])
    expect(event.defaultPrevented).toBe(false)
  })

  it('calls preventDefault for handled navigation keys', async () => {
    const root = await mountPage()
    const buttons = faqButtons(root)

    const event = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })
    buttons[0]?.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
  })
})

describe('phoeme mount guard', () => {
  beforeEach(() => {
    document.body.replaceChildren()
    document.title = ''
  })

  it('does nothing when the #phoeme-root host is absent', async () => {
    // No #phoeme-root in the DOM: mount() must early-return without painting.
    document.body.innerHTML = '<div id="not-the-root"></div>'
    vi.resetModules()
    await import('./main.ts')

    expect(document.querySelector('.pm-main')).toBeNull()
    expect(document.querySelector('.pm-footer')).toBeNull()
    expect(document.title).toBe('')
  })
})
