/**
 * E2E Tests: Account Creation & Confirmation
 *
 * Tests account-related UI flows. Note that actual account creation
 * requires WebAuthn/passkeys or social login which is difficult to
 * fully automate. These tests verify the UI states and flows.
 *
 * Note: Username step has been removed - accounts are created without
 * usernames. Users can claim a username later from their profile.
 */
import { test, expect } from '@playwright/test'

test.describe('Account UI Flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('should show all auth methods in dialog', async ({ page }) => {
    // Open auth dialog
    const connectButton = page.locator('button:has-text("Connect")')
    await connectButton.first().click()
    await page.waitForTimeout(500)

    // All auth methods should be visible
    await expect(page.locator('button:has-text("Passkey")')).toBeVisible()
    await expect(page.locator('button:has-text("Google")')).toBeVisible()
    await expect(page.locator('button:has-text("Discord")')).toBeVisible()
    await expect(page.locator('button:has-text("Connect Wallet")')).toBeVisible()
  })

  test('should navigate to passkey create/signin options', async ({ page }) => {
    // Open auth dialog
    const connectButton = page.locator('button:has-text("Connect")')
    await connectButton.first().click()
    await page.waitForTimeout(500)

    // Click passkey option
    await page.locator('button:has-text("Passkey")').first().click()
    await page.waitForTimeout(300)

    // Should show create/signin options
    await expect(page.locator('button:has-text("Create New Account")')).toBeVisible()
    await expect(page.locator('button:has-text("Sign In")')).toBeVisible()
  })

  test('should allow navigating back from passkey options', async ({ page }) => {
    // Open auth dialog
    const connectButton = page.locator('button:has-text("Connect")')
    await connectButton.first().click()
    await page.waitForTimeout(500)

    // Navigate to passkey flow
    await page.locator('button:has-text("Passkey")').first().click()
    await page.waitForTimeout(300)

    // Should be at create/signin options
    await expect(page.locator('button:has-text("Create New Account")')).toBeVisible()

    // Click back button (uses aria-label="Go back")
    const backButton = page.locator('button[aria-label="Go back"]')
    await backButton.click()
    await page.waitForTimeout(300)

    // Should be back at method selection
    await expect(page.locator('button:has-text("Passkey")')).toBeVisible()
    await expect(page.locator('button:has-text("Google")')).toBeVisible()
  })

  test('should close auth dialog when clicking escape', async ({ page }) => {
    // Open auth dialog
    const connectButton = page.locator('button:has-text("Connect")')
    await connectButton.first().click()
    await page.waitForTimeout(500)

    // Dialog should be visible
    const passkeyOption = page.locator('text=Passkey')
    await expect(passkeyOption.first()).toBeVisible()

    // Press Escape to close
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    // Dialog should be closed
    await expect(passkeyOption.first()).not.toBeVisible()
  })
})

test.describe('Profile Page', () => {
  test('should show sign in prompt when accessing profile without login', async ({ page }) => {
    // Try to navigate to profile page
    await page.goto('/#/profile')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    // Should show some indication to sign in or redirect
    const signInPrompt = page.locator('text=/Sign In|Sign Up|Connect/i')
    await expect(signInPrompt.first()).toBeVisible({ timeout: 10000 })
  })
})
