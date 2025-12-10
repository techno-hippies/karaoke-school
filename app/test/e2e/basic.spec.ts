/**
 * Basic E2E Tests (No MetaMask required)
 *
 * These tests verify the app loads correctly without wallet integration.
 * Useful for testing basic functionality and verifying Playwright setup.
 */
import { test, expect } from '@playwright/test'

test.describe('Basic App Tests', () => {
  test('should load the homepage', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // App should have rendered
    const body = await page.textContent('body')
    expect(body).toBeTruthy()

    // Should see the app title or navigation
    const hasContent =
      await page.locator('text=K School').isVisible().catch(() => false) ||
      await page.locator('text=Home').isVisible().catch(() => false) ||
      await page.locator('text=Connect').isVisible().catch(() => false)

    expect(hasContent).toBe(true)
  })

  test('should navigate to songs page', async ({ page }) => {
    await page.goto('/#/songs')
    await page.waitForLoadState('networkidle')

    // Songs page should load - check for song content or page structure
    const pageLoaded = await page.locator('body').textContent()
    expect(pageLoaded).toBeTruthy()

    // Should be on the songs route
    expect(page.url()).toContain('songs')
  })

  test('should show auth dialog when clicking connect', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Find and click connect button
    const connectButton = page.locator('button:has-text("Connect")')
    await connectButton.first().click({ timeout: 10000 })

    // Auth dialog should appear
    await page.waitForTimeout(500)
    const passkeyOption = page.locator('text=Passkey')
    await expect(passkeyOption.first()).toBeVisible({ timeout: 5000 })
  })

  test('should navigate between tabs', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Click on Songs nav (renamed from Search)
    const songsNav = page.locator('button:has-text("Songs")')
    if (await songsNav.first().isVisible({ timeout: 5000 })) {
      await songsNav.first().click()
      await page.waitForTimeout(500)
      expect(page.url()).toContain('songs')
    }
  })
})
