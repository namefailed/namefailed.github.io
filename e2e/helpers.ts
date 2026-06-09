import type { Page } from '@playwright/test'

/** Skip onboarding so smoke tests hit the live shell quickly. */
export async function skipDesktopOnboarding(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const keys = [
      'mrgrey-boot-seen',
      'mrgrey-first-run-done',
      'mrgrey-guide-seen',
      'mrgrey-toasts-seen',
      'mrgrey-hint-portfolio-folder',
      'mrgrey-hint-apps-folder',
      'mrgrey-hint-games-folder',
      'mrgrey-p5-tip-seen',
    ]
    for (const key of keys) localStorage.setItem(key, '1')
  })
}
