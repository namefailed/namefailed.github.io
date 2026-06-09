import { test, expect } from '@playwright/test'

test.describe('production build smoke', () => {
  test('desktop shell loads and exposes skip links', async ({ page }) => {
    await page.goto('/')
    const skipDesktop = page.getByRole('link', { name: /skip to desktop/i })
    const skipClassic = page.getByRole('link', { name: /skip to classic portfolio/i })
    await expect(skipDesktop).toBeAttached()
    await expect(skipClassic).toBeAttached()
    await skipDesktop.focus()
    await expect(skipDesktop).toBeVisible()
    await expect(page.locator('#desktop-workspace')).toBeAttached()
  })

  test('static brochure loads hero and section nav', async ({ page }) => {
    await page.goto('/static/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.locator('.plain-section-nav')).toBeVisible()
    await expect(page.getByRole('link', { name: /full desktop experience/i })).toBeVisible()
  })
})
