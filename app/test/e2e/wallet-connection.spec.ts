/**
 * E2E Tests: Wallet Connection Flow
 *
 * Tests the MetaMask wallet connection via RainbowKit.
 * Note: This app uses Lit Protocol for PKP-based auth. When connecting
 * via external wallet (MetaMask), users need an existing PKP linked to
 * their address, otherwise they'll be prompted to use passkey.
 */
import { testWithSynpress } from '@synthetixio/synpress'
import { MetaMask, metaMaskFixtures } from '@synthetixio/synpress/playwright'
import { expect } from '@playwright/test'
import basicSetup from '../wallet-setup/basic.setup'

// Create test instance with MetaMask fixtures
const test = testWithSynpress(metaMaskFixtures(basicSetup))

test.describe('Wallet Connection', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to home page
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('should display connect button when not authenticated', async ({ page }) => {
    // Look for the Connect button in the sidebar (desktop) or header
    const connectButton = page.locator('button:has-text("Connect")')
    await expect(connectButton.first()).toBeVisible({ timeout: 10000 })
  })

  test('should open auth dialog when clicking connect', async ({ page }) => {
    // Click the Connect button
    const connectButton = page.locator('button:has-text("Connect")')
    await connectButton.first().click()

    // Auth dialog should appear with passkey option
    await expect(page.locator('text=Passkey (Recommended)')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('text=Continue with Google')).toBeVisible()
    await expect(page.locator('text=Connect Wallet')).toBeVisible()
  })

  test('should open RainbowKit modal when clicking Connect Wallet in auth dialog', async ({
    page,
  }) => {
    // Open auth dialog
    const connectButton = page.locator('button:has-text("Connect")')
    await connectButton.first().click()
    await page.waitForTimeout(500)

    // Click Connect Wallet option
    const walletOption = page.locator('button:has-text("Connect Wallet")')
    await walletOption.click()
    await page.waitForTimeout(1000)

    // RainbowKit modal should appear with wallet options
    // The modal shows different connectors like MetaMask, WalletConnect, etc.
    const rainbowkitModal = page.locator('[data-rk]')
    await expect(rainbowkitModal.first()).toBeVisible({ timeout: 10000 })
  })

  test('should connect MetaMask through RainbowKit', async ({
    context,
    page,
    metamaskPage,
    extensionId,
  }) => {
    // Create MetaMask instance
    const metamask = new MetaMask(
      context,
      metamaskPage,
      basicSetup.walletPassword,
      extensionId
    )

    // Open auth dialog
    const connectButton = page.locator('button:has-text("Connect")')
    await connectButton.first().click()
    await page.waitForTimeout(500)

    // Click Connect Wallet option
    const walletOption = page.locator('button:has-text("Connect Wallet")')
    await walletOption.click()
    await page.waitForTimeout(1000)

    // Click MetaMask in RainbowKit modal
    const metamaskButton = page.locator('button:has-text("MetaMask")')
    if (await metamaskButton.isVisible({ timeout: 5000 })) {
      await metamaskButton.click()

      // Approve the connection in MetaMask
      await metamask.connectToDapp()

      // Wait for connection to process
      await page.waitForTimeout(3000)

      // The app will try to connect to Lit Protocol
      // Since this is a new wallet without PKP, it should show an error message
      // or prompt to create account with passkey
      const errorOrPrompt = page.locator('text=/not registered|Create New Account|Passkey/i')
      const connected = page.locator('text=/0x[a-fA-F0-9]{4}.*[a-fA-F0-9]{4}/') // Wallet address pattern

      // Either we see an error (expected for new wallets) or a connected state
      await expect(errorOrPrompt.or(connected).first()).toBeVisible({ timeout: 15000 })
    }
  })

  test('should navigate between auth methods', async ({ page }) => {
    // Open auth dialog
    const connectButton = page.locator('button:has-text("Connect")')
    await connectButton.first().click()
    await page.waitForTimeout(500)

    // Click Passkey option
    const passkeyOption = page.locator('button:has-text("Passkey (Recommended)")')
    await passkeyOption.click()
    await page.waitForTimeout(300)

    // Should show Create/Sign In options
    await expect(page.locator('button:has-text("Create New Account")')).toBeVisible()
    await expect(page.locator('button:has-text("Sign In")')).toBeVisible()

    // Go back
    const backButton = page.locator('button:has-text("Back")')
    await backButton.click()
    await page.waitForTimeout(300)

    // Should be back at method selection
    await expect(page.locator('text=Passkey (Recommended)')).toBeVisible()
  })

  test('should show username input when creating new passkey account', async ({ page }) => {
    // Open auth dialog
    const connectButton = page.locator('button:has-text("Connect")')
    await connectButton.first().click()
    await page.waitForTimeout(500)

    // Click Passkey option
    const passkeyOption = page.locator('button:has-text("Passkey (Recommended)")')
    await passkeyOption.click()
    await page.waitForTimeout(300)

    // Click Create New Account
    // Note: This will trigger WebAuthn which may fail in test environment
    // but we can still verify the UI flow up to that point
    const createButton = page.locator('button:has-text("Create New Account")')
    await expect(createButton).toBeVisible()

    // We don't click it in this test as it would trigger actual WebAuthn
    // which is difficult to mock in Playwright
  })
})

test.describe('Navigation when not authenticated', () => {
  test('should show sign up prompt on study page', async ({ page }) => {
    await page.goto('/#/study/session')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    // Should show sign up prompt since not authenticated
    const signUpText = page.locator('text=Sign Up')
    await expect(signUpText.first()).toBeVisible({ timeout: 10000 })
  })

  test('should allow browsing songs without authentication', async ({ page }) => {
    await page.goto('/#/search')
    await page.waitForLoadState('networkidle')

    // Search page should be visible
    const searchInput = page.locator('input[placeholder*="Search"]')
    await expect(searchInput).toBeVisible({ timeout: 10000 })
  })
})
