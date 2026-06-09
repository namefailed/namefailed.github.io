import { test, expect } from '@playwright/test'
import { skipDesktopOnboarding } from './helpers'

test.describe('production build smoke', () => {
  test('desktop shell loads and exposes skip links', async ({ page }) => {
    await skipDesktopOnboarding(page)
    await page.goto('/')
    const skipDesktop = page.getByRole('link', { name: /skip to desktop/i })
    const skipClassic = page.getByRole('link', { name: /skip to classic portfolio/i })
    await expect(skipDesktop).toBeAttached()
    await expect(skipClassic).toBeAttached()
    await skipDesktop.focus()
    await expect(skipDesktop).toBeVisible()
    await expect(page.locator('#desktop-workspace')).toBeAttached()
  })

  test('desktop shell exposes folder tiles and classic view link', async ({ page }) => {
    await skipDesktopOnboarding(page)
    await page.goto('/')
    await expect(page.locator('[data-cmd="portfolio-folder"]')).toBeVisible()
    await expect(page.locator('[data-cmd="apps-folder"]')).toBeVisible()
    await expect(page.locator('[data-cmd="games-folder"]')).toBeVisible()
    await expect(page.getByRole('link', { name: /classic view/i })).toBeAttached()
  })

  test('static brochure loads hero and section nav', async ({ page }) => {
    await page.goto('/static/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.locator('.plain-section-nav')).toBeVisible()
    await expect(page.getByRole('link', { name: /full desktop experience/i })).toBeVisible()
  })

  test('phoeme product page loads hero and primary CTAs', async ({ page }) => {
    await page.goto('/phoeme/')
    await expect(page.getByRole('heading', { level: 1, name: 'Phoneme' })).toBeVisible()
    await expect(page.getByRole('link', { name: /download for windows/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /documentation/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /mrgrey\.site/i })).toBeVisible()
    await expect(page.getByRole('combobox', { name: /color theme/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Philosophy' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Core workflows' })).toBeVisible()
  })
})
