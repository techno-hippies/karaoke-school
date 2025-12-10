/**
 * Browser controller using CDP via Playwright
 *
 * Connects to an existing Chrome instance or launches one.
 * Uses CDP for low-level control without Playwright's overhead.
 */

import { chromium, type Browser, type Page, type BrowserContext } from 'playwright-core'

export interface BrowserConfig {
  headless?: boolean
  userDataDir?: string
  executablePath?: string
  cdpUrl?: string // Connect to existing Chrome via CDP
}

export class BrowserController {
  private browser: Browser | null = null
  private context: BrowserContext | null = null
  private page: Page | null = null
  private config: BrowserConfig

  constructor(config: BrowserConfig = {}) {
    this.config = config
  }

  async launch(): Promise<void> {
    if (this.config.cdpUrl) {
      // Connect to existing Chrome instance
      console.log(`[Browser] Connecting to ${this.config.cdpUrl}`)
      this.browser = await chromium.connectOverCDP(this.config.cdpUrl)
      const contexts = this.browser.contexts()
      this.context = contexts[0] || await this.browser.newContext()
    } else {
      // Launch new browser
      console.log('[Browser] Launching new browser')
      this.browser = await chromium.launch({
        headless: this.config.headless ?? false,
        executablePath: this.config.executablePath,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--no-sandbox',
        ],
      })

      this.context = await this.browser.newContext({
        viewport: { width: 1280, height: 720 },
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      })
    }

    const pages = this.context.pages()
    this.page = pages[0] || await this.context.newPage()
    console.log('[Browser] Ready')
  }

  async close(): Promise<void> {
    await this.browser?.close()
    this.browser = null
    this.context = null
    this.page = null
  }

  getPage(): Page {
    if (!this.page) throw new Error('Browser not launched')
    return this.page
  }

  async navigate(url: string): Promise<void> {
    const page = this.getPage()
    console.log(`[Browser] Navigating to ${url}`)
    await page.goto(url, { waitUntil: 'networkidle' })
  }

  async click(selector: string): Promise<void> {
    const page = this.getPage()
    console.log(`[Browser] Clicking ${selector}`)
    await page.click(selector)
  }

  async waitForSelector(selector: string, timeout = 10000): Promise<void> {
    const page = this.getPage()
    await page.waitForSelector(selector, { timeout })
  }

  async evaluate<T>(fn: () => T): Promise<T> {
    const page = this.getPage()
    return page.evaluate(fn)
  }

  async screenshot(path: string): Promise<void> {
    const page = this.getPage()
    await page.screenshot({ path })
  }

  /**
   * Inject localStorage data (for pre-seeding sessions)
   */
  async setLocalStorage(data: Record<string, string>): Promise<void> {
    const page = this.getPage()
    await page.evaluate((entries) => {
      for (const [key, value] of Object.entries(entries)) {
        localStorage.setItem(key, value)
      }
    }, data)
  }

  /**
   * Get localStorage data
   */
  async getLocalStorage(keys: string[]): Promise<Record<string, string | null>> {
    const page = this.getPage()
    return page.evaluate((keys) => {
      const result: Record<string, string | null> = {}
      for (const key of keys) {
        result[key] = localStorage.getItem(key)
      }
      return result
    }, keys)
  }
}
