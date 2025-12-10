/**
 * Authentication actions
 */

import type { Page } from 'playwright-core'

/**
 * Check if user is logged in by looking for PKP wallet indicators
 */
export async function isLoggedIn(page: Page): Promise<boolean> {
  try {
    // Check localStorage for Lit session
    const hasSession = await page.evaluate(() => {
      const keys = Object.keys(localStorage)
      return keys.some(k =>
        k.includes('karaoke-school:session') ||
        k.includes('karaoke-school:pkp') ||
        k.includes('karaoke-school:auth') ||
        k.includes('lit-session') ||
        k.includes('pkp') ||
        k.includes('wallet')
      )
    })

    if (hasSession) return true

    // Check for logged-in UI elements
    const walletButton = await page.$('[data-wallet-connected]')
    if (walletButton) return true

    // Check for avatar or profile elements that indicate logged in state
    const profileElement = await page.$('[data-user-profile]')
    if (profileElement) return true

    return false
  } catch {
    return false
  }
}

/**
 * Pre-seed a Lit session into localStorage.
 *
 * This allows the agent to skip the login flow by injecting
 * a previously saved session.
 */
export async function injectSession(
  page: Page,
  sessionData: Record<string, string>
): Promise<void> {
  await page.evaluate((data) => {
    for (const [key, value] of Object.entries(data)) {
      localStorage.setItem(key, value)
    }
  }, sessionData)

  console.log('[Browser] Injected session data')

  // Reload to pick up the session
  await page.reload({ waitUntil: 'networkidle' })
}

/**
 * Export current session from localStorage.
 *
 * Use this to save a session after manual login.
 */
export async function exportSession(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() => {
    const session: Record<string, string> = {}
    const keys = Object.keys(localStorage)

    for (const key of keys) {
      // Only export auth-related keys
      if (
        key.includes('karaoke-school:') ||
        key.includes('lit') ||
        key.includes('pkp') ||
        key.includes('wallet') ||
        key.includes('session') ||
        key.includes('auth')
      ) {
        const value = localStorage.getItem(key)
        if (value) session[key] = value
      }
    }

    return session
  })
}

/**
 * Open auth dialog (if not logged in)
 */
export async function openAuthDialog(page: Page): Promise<boolean> {
  try {
    // Look for sign in button
    const signInButton = await page.$('button:has-text("Sign In")')
    if (signInButton) {
      await signInButton.click()
      await page.waitForTimeout(500)
      return true
    }
    return false
  } catch {
    return false
  }
}
