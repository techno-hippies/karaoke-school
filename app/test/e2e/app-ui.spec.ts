/**
 * App UI Tests (No MetaMask Required)
 *
 * These tests verify the app's UI functionality without wallet integration.
 * They test navigation, dialogs, forms, and user flows that don't require
 * actual blockchain transactions.
 */
import { test, expect } from '@playwright/test'

test.describe('Homepage', () => {
  test('should load and display app shell', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // App title should be visible
    await expect(page.locator('text=K School')).toBeVisible({ timeout: 15000 })
  })

  test('should show navigation elements', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Navigation buttons should be present
    const homeButton = page.locator('button:has-text("Home")')
    const searchButton = page.locator('button:has-text("Search")')
    const studyButton = page.locator('button:has-text("Study")')

    await expect(homeButton.first()).toBeVisible({ timeout: 10000 })
    await expect(searchButton.first()).toBeVisible()
    await expect(studyButton.first()).toBeVisible()
  })

  test('should show connect button when not authenticated', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const connectButton = page.locator('button:has-text("Connect")')
    await expect(connectButton.first()).toBeVisible({ timeout: 10000 })
  })
})

test.describe('Auth Dialog', () => {
  test('should open auth dialog when clicking connect', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const connectButton = page.locator('button:has-text("Connect")')
    await connectButton.first().click()
    await page.waitForTimeout(500)

    // Auth options should appear
    await expect(page.locator('text=Passkey')).toBeVisible({ timeout: 5000 })
  })

  test('should show all auth methods', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const connectButton = page.locator('button:has-text("Connect")')
    await connectButton.first().click()
    await page.waitForTimeout(500)

    // All auth options should be visible
    await expect(page.locator('text=Passkey (Recommended)')).toBeVisible()
    await expect(page.locator('text=Continue with Google')).toBeVisible()
    await expect(page.locator('text=Continue with Discord')).toBeVisible()
    await expect(page.locator('button:has-text("Connect Wallet")')).toBeVisible()
  })

  test('should navigate to passkey create/signin options', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Open dialog
    await page.locator('button:has-text("Connect")').first().click()
    await page.waitForTimeout(500)

    // Click passkey option
    await page.locator('button:has-text("Passkey (Recommended)")').click()
    await page.waitForTimeout(300)

    // Should show create/signin options
    await expect(page.locator('button:has-text("Create New Account")')).toBeVisible()
    await expect(page.locator('button:has-text("Sign In")')).toBeVisible()
  })

  test('should show username input for Google signup', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Open dialog and navigate to Google
    await page.locator('button:has-text("Connect")').first().click()
    await page.waitForTimeout(500)
    await page.locator('button:has-text("Continue with Google")').click()
    await page.waitForTimeout(300)
    await page.locator('button:has-text("Create New Account with Google")').click()
    await page.waitForTimeout(300)

    // Username input should appear
    const usernameInput = page.locator('input[placeholder*="Username"]')
    await expect(usernameInput).toBeVisible()
  })

  test('should validate username format', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Navigate to username input
    await page.locator('button:has-text("Connect")').first().click()
    await page.waitForTimeout(500)
    await page.locator('button:has-text("Continue with Google")').click()
    await page.waitForTimeout(300)
    await page.locator('button:has-text("Create New Account with Google")').click()
    await page.waitForTimeout(300)

    const usernameInput = page.locator('input[placeholder*="Username"]')
    const nextButton = page.locator('button:has-text("Next")')

    // Short username should disable next button
    await usernameInput.fill('abc')
    await expect(nextButton).toBeDisabled()

    // Valid username should enable next and show validation
    await usernameInput.fill('testuser123')
    await expect(page.locator('text=Format valid')).toBeVisible()
    await expect(nextButton).toBeEnabled()
  })

  test('should close dialog on escape', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await page.locator('button:has-text("Connect")').first().click()
    await page.waitForTimeout(500)

    await expect(page.locator('text=Passkey')).toBeVisible()

    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    await expect(page.locator('text=Passkey')).not.toBeVisible()
  })
})

test.describe('Navigation', () => {
  test('should navigate to search page', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await page.locator('button:has-text("Search")').first().click()
    await page.waitForTimeout(500)

    expect(page.url()).toContain('search')
    await expect(page.locator('input[placeholder*="Search"]')).toBeVisible()
  })

  test('should navigate to study page', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await page.locator('button:has-text("Study")').first().click()
    await page.waitForTimeout(500)

    expect(page.url()).toContain('study')
  })

  test('should navigate to wallet page', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await page.locator('button:has-text("Wallet")').first().click()
    await page.waitForTimeout(500)

    expect(page.url()).toContain('wallet')
  })
})

test.describe('Search', () => {
  test('should display search input', async ({ page }) => {
    await page.goto('/#/search')
    await page.waitForLoadState('networkidle')

    const searchInput = page.locator('input[placeholder*="Search"]')
    await expect(searchInput).toBeVisible({ timeout: 10000 })
  })

  test('should allow typing in search', async ({ page }) => {
    await page.goto('/#/search')
    await page.waitForLoadState('networkidle')

    const searchInput = page.locator('input[placeholder*="Search"]')
    await searchInput.fill('toxic')
    await expect(searchInput).toHaveValue('toxic')
  })
})

test.describe('Study Session - Unauthenticated', () => {
  test('should show sign up prompt', async ({ page }) => {
    await page.goto('/#/study/session')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Should show sign up prompt
    await expect(page.locator('text=Sign Up').first()).toBeVisible({ timeout: 10000 })
  })

  test('should show description for unauthenticated users', async ({ page }) => {
    await page.goto('/#/study/session')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Page should load with some content
    const bodyText = await page.textContent('body')
    expect(bodyText).toBeTruthy()

    // Should show sign up prompt
    const signUpText = page.locator('text=Sign Up')
    await expect(signUpText.first()).toBeVisible({ timeout: 10000 })
  })
})

test.describe('Responsive Design', () => {
  test('should render properly on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // On mobile, the main content should be visible and page should load
    const pageBody = await page.textContent('body')
    expect(pageBody).toBeTruthy()

    // Connect button should still be accessible
    const connectButton = page.locator('button:has-text("Connect")')
    // It exists in DOM (may be in footer on mobile)
    expect(await connectButton.count()).toBeGreaterThan(0)
  })

  test('should show desktop sidebar on large screens', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Desktop layout should have sidebar navigation visible
    const bodyText = await page.textContent('body')
    expect(bodyText).toBeTruthy()

    // Navigation elements should be visible
    const homeButton = page.locator('button:has-text("Home")')
    await expect(homeButton.first()).toBeVisible({ timeout: 10000 })
  })
})
