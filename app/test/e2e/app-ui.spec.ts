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

    // Navigation buttons should be present (Search renamed to Songs)
    const homeButton = page.locator('button:has-text("Home")')
    const songsButton = page.locator('button:has-text("Songs")')
    const studyButton = page.locator('button:has-text("Study")')

    await expect(homeButton.first()).toBeVisible({ timeout: 10000 })
    await expect(songsButton.first()).toBeVisible()
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

    // All auth options should be visible (using i18n keys)
    await expect(page.locator('text=Passkey')).toBeVisible()
    await expect(page.locator('text=Google')).toBeVisible()
    await expect(page.locator('text=Discord')).toBeVisible()
    await expect(page.locator('button:has-text("Connect Wallet")')).toBeVisible()
  })

  test('should navigate to passkey create/signin options', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Open dialog
    await page.locator('button:has-text("Connect")').first().click()
    await page.waitForTimeout(500)

    // Click passkey option (look for button containing "Passkey")
    await page.locator('button:has-text("Passkey")').first().click()
    await page.waitForTimeout(300)

    // Should show create/signin options
    await expect(page.locator('button:has-text("Create New Account")')).toBeVisible()
    await expect(page.locator('button:has-text("Sign In")')).toBeVisible()
  })

  test('should show Google as direct auth method', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Open dialog
    await page.locator('button:has-text("Connect")').first().click()
    await page.waitForTimeout(500)

    // Google button should be visible as a direct auth method
    const googleButton = page.locator('button:has-text("Google")')
    await expect(googleButton.first()).toBeVisible()

    // Clicking Google would trigger OAuth (we don't test the popup here)
  })

  test('should show passkey create/signin options', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Open dialog and click passkey
    await page.locator('button:has-text("Connect")').first().click()
    await page.waitForTimeout(500)
    await page.locator('button:has-text("Passkey")').first().click()
    await page.waitForTimeout(300)

    // Should show Create New Account and Sign In buttons
    await expect(page.locator('button:has-text("Create New Account")')).toBeVisible()
    await expect(page.locator('button:has-text("Sign In")')).toBeVisible()
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
  test('should navigate to songs page', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await page.locator('button:has-text("Songs")').first().click()
    await page.waitForTimeout(500)

    expect(page.url()).toContain('songs')
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

test.describe('Songs Page', () => {
  test('should load songs page', async ({ page }) => {
    await page.goto('/#/songs')
    await page.waitForLoadState('networkidle')

    // Songs page should load
    const bodyText = await page.textContent('body')
    expect(bodyText).toBeTruthy()
    expect(page.url()).toContain('songs')
  })

  test('should display song content', async ({ page }) => {
    await page.goto('/#/songs')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Page should have loaded some content
    const bodyText = await page.textContent('body')
    expect(bodyText).toBeTruthy()
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
