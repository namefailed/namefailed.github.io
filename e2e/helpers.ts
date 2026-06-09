import type { Page } from '@playwright/test'

/** Skip boot splash / guide / toasts so smoke tests hit the live shell quickly. */
export async function skipDesktopOnboarding(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const keys = [
      'mrgrey-boot-seen',
      'mrgrey-guide-seen',
      'mrgrey-toasts-seen',
      'mrgrey-hint-portfolio-folder',
      'mrgrey-hint-apps-folder',
      'mrgrey-hint-games-folder',
    ]
    for (const key of keys) localStorage.setItem(key, '1')
  })
}
