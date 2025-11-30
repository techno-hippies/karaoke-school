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

  test('should navigate to search page', async ({ page }) => {
    await page.goto('/#/search')
    await page.waitForLoadState('networkidle')

    // Search input should be visible
    const searchInput = page.locator('input[placeholder*="Search"]')
    await expect(searchInput).toBeVisible({ timeout: 10000 })
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

    // Click on Search nav
    const searchNav = page.locator('button:has-text("Search")')
    if (await searchNav.first().isVisible({ timeout: 5000 })) {
      await searchNav.first().click()
      await page.waitForTimeout(500)
      expect(page.url()).toContain('search')
    }
  })
})
