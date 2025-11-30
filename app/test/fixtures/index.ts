/**
 * Custom test fixtures for Karaoke School E2E tests
 *
 * Extends Synpress fixtures with app-specific utilities
 */
import { testWithSynpress } from '@synthetixio/synpress'
import { MetaMask, metaMaskFixtures } from '@synthetixio/synpress/playwright'
import { type BrowserContext, type Page, expect } from '@playwright/test'

import basicSetup from '../wallet-setup/basic.setup'
import baseSepoliaSetup from '../wallet-setup/base-sepolia.setup'

// Test instances with different wallet setups
export const testBasic = testWithSynpress(metaMaskFixtures(basicSetup))
export const testBaseSepolia = testWithSynpress(metaMaskFixtures(baseSepoliaSetup))

// Re-export expect for convenience
export { expect }

/**
 * Helper to create MetaMask instance from test fixtures
 */
export function createMetaMask(
  context: BrowserContext,
  metamaskPage: Page,
  extensionId: string,
  setup: typeof basicSetup | typeof baseSepoliaSetup = basicSetup
) {
  return new MetaMask(context, metamaskPage, setup.walletPassword, extensionId)
}

/**
 * Selectors for common UI elements in the app
 */
export const selectors = {
  // Auth dialog
  authDialog: '[data-testid="auth-dialog"]',
  loginButton: '[data-testid="login-button"]',
  registerButton: '[data-testid="register-button"]',
  connectWalletButton: '[data-testid="connect-wallet-button"]',
  usernameInput: '[data-testid="username-input"]',

  // RainbowKit modal
  rainbowkitModal: '[data-rk]',
  rainbowkitConnectButton: 'button:has-text("Connect Wallet")',
  rainbowkitMetamask: 'button:has-text("MetaMask")',

  // Navigation
  homeLink: 'a[href="/"]',
  studyLink: 'a[href="/study"]',
  walletLink: 'a[href="/wallet"]',
  profileLink: 'a[href="/profile"]',

  // Study session
  studyStartButton: '[data-testid="start-study"]',
  exerciseCard: '[data-testid="exercise-card"]',
  answerOption: '[data-testid="answer-option"]',
  nextButton: '[data-testid="next-button"]',
  skipButton: '[data-testid="skip-button"]',
  studyComplete: '[data-testid="study-complete"]',

  // Karaoke
  karaokeStartButton: '[data-testid="start-karaoke"]',
  karaokePlayer: '[data-testid="karaoke-player"]',
  playButton: '[data-testid="play-button"]',
  pauseButton: '[data-testid="pause-button"]',
  gradeDisplay: '[data-testid="grade-display"]',
  lyricsDisplay: '[data-testid="lyrics-display"]',

  // Feed / Home
  feedPost: '[data-testid="feed-post"]',
  videoCard: '[data-testid="video-card"]',

  // Profile
  profileUsername: '[data-testid="profile-username"]',
  profileStats: '[data-testid="profile-stats"]',
}

/**
 * Wait for the app to be fully loaded
 */
export async function waitForAppReady(page: Page) {
  // Wait for main content to be visible
  await page.waitForLoadState('networkidle')
  // Give React time to hydrate
  await page.waitForTimeout(1000)
}

/**
 * Navigate to a page and wait for it to be ready
 */
export async function navigateTo(page: Page, path: string) {
  await page.goto(path)
  await waitForAppReady(page)
}

/**
 * Check if user is authenticated (has profile link visible)
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  try {
    // Look for indicators of being logged in
    const profileLink = page.locator(selectors.profileLink)
    return await profileLink.isVisible({ timeout: 2000 })
  } catch {
    return false
  }
}

/**
 * Open the auth dialog if not already open
 */
export async function openAuthDialog(page: Page) {
  // Look for a button that opens the auth dialog
  const loginBtn = page.locator('button:has-text("Sign In"), button:has-text("Login"), button:has-text("Connect")')
  if (await loginBtn.first().isVisible()) {
    await loginBtn.first().click()
    await page.waitForTimeout(500)
  }
}

/**
 * Connect wallet via RainbowKit and MetaMask
 */
export async function connectWallet(
  page: Page,
  metamask: MetaMask
) {
  // Click the connect wallet option in auth dialog or header
  const connectBtn = page.locator('button:has-text("Connect Wallet"), button:has-text("Wallet")')
  if (await connectBtn.first().isVisible()) {
    await connectBtn.first().click()
  }

  // Wait for RainbowKit modal
  await page.waitForTimeout(1000)

  // Click MetaMask in RainbowKit
  const metamaskBtn = page.locator('button:has-text("MetaMask")')
  if (await metamaskBtn.first().isVisible()) {
    await metamaskBtn.first().click()
  }

  // Approve the connection in MetaMask
  await metamask.connectToDapp()

  // Wait for connection to complete
  await page.waitForTimeout(2000)
}

/**
 * Grant microphone permissions for karaoke/voice exercises
 */
export async function grantMicrophonePermission(context: BrowserContext) {
  await context.grantPermissions(['microphone'])
}

/**
 * Mock the microphone audio stream (for CI where real mic isn't available)
 */
export async function mockMicrophone(page: Page) {
  await page.evaluate(() => {
    // Create a mock MediaStream with silent audio
    const audioContext = new AudioContext()
    const oscillator = audioContext.createOscillator()
    const destination = audioContext.createMediaStreamDestination()
    oscillator.connect(destination)
    oscillator.start()

    // Override getUserMedia to return our mock stream
    const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices
    )

    navigator.mediaDevices.getUserMedia = async (constraints) => {
      if (constraints?.audio) {
        return destination.stream
      }
      return originalGetUserMedia(constraints)
    }
  })
}
