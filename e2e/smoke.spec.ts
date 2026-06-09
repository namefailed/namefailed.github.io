import { test, expect } from '@playwright/test'

test.describe('production build smoke', () => {
  test('desktop shell loads and exposes skip link', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('link', { name: /skip to terminal/i })).toBeVisible()
    await expect(page.locator('#desktop')).toBeAttached()
  })

  test('static brochure loads hero and section nav', async ({ page }) => {
    await page.goto('/static/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.locator('.plain-section-nav')).toBeVisible()
    await expect(page.getByRole('link', { name: /full desktop experience/i })).toBeVisible()
  })
})
