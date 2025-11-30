/**
 * MetaMask Tests with Manual Extension Loading
 *
 * This approach bypasses Synpress's cache mechanism and loads
 * MetaMask directly using Playwright's extension support.
 */
import { test as base, chromium, type BrowserContext } from '@playwright/test'
import path from 'path'

// Path to the downloaded MetaMask extension
const METAMASK_PATH = path.join(process.cwd(), '.cache-synpress/metamask-chrome-11.9.1')

// Create a test fixture that loads MetaMask extension
const test = base.extend<{
  context: BrowserContext
  extensionId: string
}>({
  // Override context to load with MetaMask extension
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${METAMASK_PATH}`,
        `--load-extension=${METAMASK_PATH}`,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
    })
    await use(context)
    await context.close()
  },
  // Get the MetaMask extension ID
  extensionId: async ({ context }, use) => {
    // Wait for MetaMask to load
    let extensionId = ''

    // Wait for service worker to be available
    let attempts = 0
    while (attempts < 30) {
      const workers = context.serviceWorkers()
      for (const worker of workers) {
        if (worker.url().includes('chrome-extension://')) {
          extensionId = worker.url().split('/')[2]
          break
        }
      }
      if (extensionId) break
      await new Promise(r => setTimeout(r, 1000))
      attempts++
    }

    await use(extensionId)
  },
})

const { expect } = test

test.describe('MetaMask Manual Loading', () => {
  test.skip('should load MetaMask extension', async ({ context, extensionId }) => {
    expect(extensionId).toBeTruthy()
    console.log('MetaMask Extension ID:', extensionId)

    // Open MetaMask popup
    const metamaskPage = await context.newPage()
    await metamaskPage.goto(`chrome-extension://${extensionId}/home.html`)

    // MetaMask onboarding page should be visible
    await expect(metamaskPage.locator('text=/Get started|Welcome/i')).toBeVisible({ timeout: 30000 })
  })
})
