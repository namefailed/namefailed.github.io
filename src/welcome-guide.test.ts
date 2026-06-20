// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mountWelcomeGuide, GUIDE_KEY } from './welcome-guide'

const TIP_IDS = ['open', 'hire', 'terminal', 'drag', 'keys']

function getCard(): HTMLElement | null {
  return document.body.querySelector<HTMLElement>('.welcome-guide')
}

describe('welcome-guide', () => {
  beforeEach(() => {
    localStorage.clear()
    document.body.replaceChildren()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    localStorage.clear()
    document.body.replaceChildren()
  })

  it('exports the expected storage key', () => {
    expect(GUIDE_KEY).toBe('mrgrey-guide-seen')
  })

  it('mounts a card on first visit when the guide has not been seen', () => {
    mountWelcomeGuide()
    const card = getCard()
    expect(card).not.toBeNull()
    expect(card!.getAttribute('role')).toBe('complementary')
    expect(card!.getAttribute('aria-label')).toBe('Welcome guide')
  })

  it('does not mount when the guide has already been seen', () => {
    localStorage.setItem(GUIDE_KEY, '1')
    mountWelcomeGuide()
    expect(getCard()).toBeNull()
  })

  it('renders header with title and dismiss button', () => {
    mountWelcomeGuide()
    const card = getCard()!
    const title = card.querySelector('.welcome-guide-title')
    expect(title!.textContent).toContain("Hey — I'm Matt")

    const closeBtn = card.querySelector<HTMLButtonElement>('.welcome-guide-close')
    expect(closeBtn).not.toBeNull()
    expect(closeBtn!.type).toBe('button')
    expect(closeBtn!.getAttribute('aria-label')).toBe('Dismiss guide')
    expect(closeBtn!.textContent).toBe('✕')
  })

  it('renders one list item per tip, in order, with glyph bullets', () => {
    mountWelcomeGuide()
    const card = getCard()!
    const tips = [...card.querySelectorAll<HTMLElement>('.welcome-guide-tip')]
    expect(tips.map((li) => li.dataset.tip)).toEqual(TIP_IDS)

    // Each tip starts with its glyph bullet (not yet a checkmark).
    for (const li of tips) {
      const bullet = li.querySelector('.wg-bullet')!
      expect(bullet.getAttribute('aria-hidden')).toBe('true')
      expect(bullet.textContent).not.toBe('✓')
      expect(bullet.textContent!.length).toBeGreaterThan(0)
      expect(li.classList.contains('wg-tip--done')).toBe(false)
    }
  })

  it('renders the classic résumé link with a resolved href', () => {
    mountWelcomeGuide()
    const card = getCard()!
    const link = card.querySelector<HTMLAnchorElement>('.welcome-guide-classic-link')
    expect(link).not.toBeNull()
    expect(link!.textContent).toBe('Classic résumé view →')
    // href resolves to a static portfolio path.
    expect(link!.getAttribute('href')).toContain('static')
  })

  it('persists the seen flag and fades out the card when the close button is clicked', () => {
    mountWelcomeGuide()
    const card = getCard()!
    const closeBtn = card.querySelector<HTMLButtonElement>('.welcome-guide-close')!

    closeBtn.click()

    expect(localStorage.getItem(GUIDE_KEY)).toBe('1')
    // Immediate (delay 0) dismiss adds the fade-out class right away.
    expect(card.classList.contains('welcome-guide--out')).toBe(true)
    expect(document.body.contains(card)).toBe(true)

    // Card is removed after the 380ms fade.
    vi.advanceTimersByTime(380)
    expect(document.body.contains(card)).toBe(false)
  })

  it('dispatches mrgrey-guide-dismissed when dismissed', () => {
    mountWelcomeGuide()
    const onDismissed = vi.fn()
    window.addEventListener('mrgrey-guide-dismissed', onDismissed)

    getCard()!.querySelector<HTMLButtonElement>('.welcome-guide-close')!.click()
    expect(onDismissed).toHaveBeenCalledTimes(1)

    window.removeEventListener('mrgrey-guide-dismissed', onDismissed)
  })

  it('marks the open tip done and auto-dismisses after delay on first window open', () => {
    mountWelcomeGuide()
    const card = getCard()!

    window.dispatchEvent(new Event('mrgrey-first-window'))

    const openTip = card.querySelector<HTMLElement>('[data-tip="open"]')!
    expect(openTip.classList.contains('wg-tip--done')).toBe(true)
    expect(openTip.querySelector('.wg-bullet')!.textContent).toBe('✓')

    // Seen flag persisted immediately; fade-out is delayed by 1200ms.
    expect(localStorage.getItem(GUIDE_KEY)).toBe('1')
    expect(card.classList.contains('welcome-guide--out')).toBe(false)

    vi.advanceTimersByTime(1200)
    expect(card.classList.contains('welcome-guide--out')).toBe(true)
    vi.advanceTimersByTime(380)
    expect(document.body.contains(card)).toBe(false)
  })

  it('marks the terminal tip done on first terminal command', () => {
    mountWelcomeGuide()
    const card = getCard()!

    window.dispatchEvent(new Event('mrgrey-terminal-cmd'))

    const termTip = card.querySelector<HTMLElement>('[data-tip="terminal"]')!
    expect(termTip.classList.contains('wg-tip--done')).toBe(true)
    expect(termTip.querySelector('.wg-bullet')!.textContent).toBe('✓')
    expect(localStorage.getItem(GUIDE_KEY)).toBe('1')
  })

  it('removes the terminal listener after the first-window path fires', () => {
    mountWelcomeGuide()
    const card = getCard()!

    window.dispatchEvent(new Event('mrgrey-first-window'))
    // Terminal command should now be a no-op: terminal tip stays undone.
    window.dispatchEvent(new Event('mrgrey-terminal-cmd'))

    const termTip = card.querySelector<HTMLElement>('[data-tip="terminal"]')!
    expect(termTip.classList.contains('wg-tip--done')).toBe(false)
    expect(termTip.querySelector('.wg-bullet')!.textContent).not.toBe('✓')
  })

  it('removes the first-window listener after the terminal path fires', () => {
    mountWelcomeGuide()
    const card = getCard()!

    window.dispatchEvent(new Event('mrgrey-terminal-cmd'))
    // First-window should now be a no-op: open tip stays undone.
    window.dispatchEvent(new Event('mrgrey-first-window'))

    const openTip = card.querySelector<HTMLElement>('[data-tip="open"]')!
    expect(openTip.classList.contains('wg-tip--done')).toBe(false)
  })

  it('ignores a second dismiss once already dismissed', () => {
    mountWelcomeGuide()
    const card = getCard()!
    const onDismissed = vi.fn()
    window.addEventListener('mrgrey-guide-dismissed', onDismissed)

    const closeBtn = card.querySelector<HTMLButtonElement>('.welcome-guide-close')!
    closeBtn.click()
    closeBtn.click()
    closeBtn.click()

    // Dismiss event only fires once despite repeated clicks.
    expect(onDismissed).toHaveBeenCalledTimes(1)

    window.removeEventListener('mrgrey-guide-dismissed', onDismissed)
  })

  it('does not re-mount or duplicate the card after it has been dismissed once', () => {
    mountWelcomeGuide()
    getCard()!.querySelector<HTMLButtonElement>('.welcome-guide-close')!.click()
    vi.advanceTimersByTime(380)

    // Storage now flags the guide as seen, so a fresh mount is a no-op.
    mountWelcomeGuide()
    expect(getCard()).toBeNull()
  })
})
