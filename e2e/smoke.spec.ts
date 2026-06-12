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
    await expect(page.getByRole('link', { name: /desktop/i })).toBeVisible()
    await expect(page.getByRole('combobox', { name: /color theme/i })).toBeVisible()
  })

  test('phoeme product page loads marketing layout and links', async ({ page }) => {
    await page.goto('/phoeme/')
    await expect(
      page.getByRole('heading', { level: 1, name: /turn voice into a searchable local archive/i }),
    ).toBeVisible()
    await expect(page.getByRole('link', { name: /download for windows/i }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /documentation/i }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /← mrgrey\.site/i })).toBeVisible()
    await expect(page.getByRole('combobox', { name: /color theme/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /ways to use it/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /from audio to action/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /built for local control/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /cloud dictation is not the only model/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /is phoneme free/i })).toBeVisible()
  })

  test('phoeme page exposes landmarks, skip link, and safe external links', async ({ page }) => {
    await page.goto('/phoeme/')

    // Exactly one main and one h1; footer is a contentinfo landmark (outside main).
    await expect(page.getByRole('main')).toHaveCount(1)
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
    const footer = page.getByRole('contentinfo')
    await expect(footer).toBeVisible()

    // Skip link targets the main content region.
    await expect(page.getByRole('link', { name: /skip to content/i })).toHaveAttribute(
      'href',
      '#content',
    )

    // External CTAs open safely.
    const download = page.getByRole('link', { name: /download for windows/i }).first()
    await expect(download).toHaveAttribute('target', '_blank')
    await expect(download).toHaveAttribute('rel', /noopener/)
    await expect(download).toHaveAttribute('rel', /noreferrer/)

    // Structured data is present for crawlers.
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(1)
  })

  test('phoeme comparison table renders both columns and all rows', async ({ page }) => {
    await page.goto('/phoeme/')

    const compare = page.locator('.pm-section--compare')
    await expect(compare).toBeVisible()

    // Two labelled columns: typical cloud vs Phoneme.
    await expect(compare.locator('.pm-compare-head-cloud')).toHaveText(/typical cloud/i)
    await expect(compare.locator('.pm-compare-head-phoneme')).toHaveText(/phoneme/i)

    // Every comparison point renders a paired cloud/phoneme row.
    const rows = compare.locator('.pm-compare-row')
    await expect(rows).toHaveCount(4)
    for (let i = 0; i < 4; i++) {
      await expect(rows.nth(i).locator('.pm-compare-col--cloud')).toBeVisible()
      await expect(rows.nth(i).locator('.pm-compare-col--phoneme')).toBeVisible()
    }
  })

  test('phoeme footer exposes nav, tech stack, and credit', async ({ page }) => {
    await page.goto('/phoeme/')

    const footer = page.getByRole('contentinfo')
    await expect(footer).toBeVisible()

    // Footer nav repeats the primary CTAs as safe external links.
    const footerNav = footer.getByRole('navigation', { name: /footer/i })
    await expect(footerNav).toBeVisible()
    const navLinks = footerNav.getByRole('link')
    expect(await navLinks.count()).toBeGreaterThanOrEqual(3)
    const firstNavLink = navLinks.first()
    await expect(firstNavLink).toHaveAttribute('target', '_blank')
    await expect(firstNavLink).toHaveAttribute('rel', /noopener/)

    // Tech stack chips and a build credit link are present.
    await expect(footer.locator('.pm-footer-stack-item').first()).toBeVisible()
    await expect(footer.getByRole('link', { name: /^namefailed$/i })).toHaveAttribute(
      'href',
      'https://github.com/namefailed',
    )
  })

  test('phoeme FAQ accordion is keyboard accessible', async ({ page }) => {
    await page.goto('/phoeme/')
    const question = page.getByRole('button', { name: /is phoneme free/i })

    await expect(question).toHaveAttribute('aria-expanded', 'false')
    const panelId = await question.getAttribute('aria-controls')
    expect(panelId).toBeTruthy()
    const panel = page.locator(`#${panelId}`)
    await expect(panel).toBeHidden()

    // Activate with the keyboard.
    await question.focus()
    await page.keyboard.press('Enter')
    await expect(question).toHaveAttribute('aria-expanded', 'true')
    await expect(panel).toBeVisible()

    // Toggling closed hides the panel again.
    await page.keyboard.press('Enter')
    await expect(question).toHaveAttribute('aria-expanded', 'false')
    await expect(panel).toBeHidden()
  })
})
