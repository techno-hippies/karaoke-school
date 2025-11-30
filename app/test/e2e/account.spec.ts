/**
 * E2E Tests: Account Creation & Confirmation
 *
 * Tests account-related UI flows. Note that actual account creation
 * requires WebAuthn/passkeys or social login which is difficult to
 * fully automate. These tests verify the UI states and flows.
 */
import { test, expect } from '@playwright/test'

test.describe('Account UI Flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('should show username validation when creating account', async ({ page }) => {
    // Open auth dialog
    const connectButton = page.locator('button:has-text("Connect")')
    await connectButton.first().click()
    await page.waitForTimeout(500)

    // Click Google option (social login shows username input)
    const googleOption = page.locator('button:has-text("Continue with Google")')
    await googleOption.click()
    await page.waitForTimeout(300)

    // Click Create (which should show username input for social)
    const createButton = page.locator('button:has-text("Create New Account with Google")')
    await createButton.click()
    await page.waitForTimeout(300)

    // Should show username input
    const usernameInput = page.locator('input[placeholder*="Username"]')
    await expect(usernameInput).toBeVisible({ timeout: 5000 })

    // Type an invalid username (too short)
    await usernameInput.fill('abc')

    // The Next button should be disabled
    const nextButton = page.locator('button:has-text("Next")')
    await expect(nextButton).toBeDisabled()

    // Type a valid username (6+ chars)
    await usernameInput.fill('testuser123')

    // Should show format valid message
    const formatValid = page.locator('text=Format valid')
    await expect(formatValid).toBeVisible({ timeout: 2000 })

    // Next button should be enabled
    await expect(nextButton).toBeEnabled()
  })

  test('should validate username format rules', async ({ page }) => {
    // Open auth dialog and go to username input
    const connectButton = page.locator('button:has-text("Connect")')
    await connectButton.first().click()
    await page.waitForTimeout(500)

    const googleOption = page.locator('button:has-text("Continue with Google")')
    await googleOption.click()
    await page.waitForTimeout(300)

    const createButton = page.locator('button:has-text("Create New Account with Google")')
    await createButton.click()
    await page.waitForTimeout(300)

    const usernameInput = page.locator('input[placeholder*="Username"]')
    await expect(usernameInput).toBeVisible()

    // Test valid usernames
    const validUsernames = [
      'testuser',
      'test_user',
      'test123',
      'alice_in_chains',
    ]

    for (const username of validUsernames) {
      await usernameInput.fill(username)
      await page.waitForTimeout(200)
      const formatValid = page.locator('text=Format valid')
      await expect(formatValid).toBeVisible()
    }
  })

  test('should allow navigating back from username input', async ({ page }) => {
    // Open auth dialog
    const connectButton = page.locator('button:has-text("Connect")')
    await connectButton.first().click()
    await page.waitForTimeout(500)

    // Navigate to Google create flow
    const googleOption = page.locator('button:has-text("Continue with Google")')
    await googleOption.click()
    await page.waitForTimeout(300)

    const createButton = page.locator('button:has-text("Create New Account with Google")')
    await createButton.click()
    await page.waitForTimeout(300)

    // Should be at username input
    await expect(page.locator('input[placeholder*="Username"]')).toBeVisible()

    // Click back
    const backButton = page.locator('button:has-text("Back")')
    await backButton.click()
    await page.waitForTimeout(300)

    // Should be back at create/sign in options
    await expect(page.locator('button:has-text("Create New Account with Google")')).toBeVisible()
    await expect(page.locator('button:has-text("Sign In with Google")')).toBeVisible()
  })

  test('should close auth dialog when clicking escape', async ({ page }) => {
    // Open auth dialog
    const connectButton = page.locator('button:has-text("Connect")')
    await connectButton.first().click()
    await page.waitForTimeout(500)

    // Dialog should be visible
    const passkeyOption = page.locator('text=Passkey (Recommended)')
    await expect(passkeyOption).toBeVisible()

    // Press Escape to close
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    // Dialog should be closed
    await expect(passkeyOption).not.toBeVisible()
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
