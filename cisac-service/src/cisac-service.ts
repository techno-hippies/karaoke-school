import { chromium } from 'playwright-extra';
import type { Browser, Page, BrowserContext } from 'playwright';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Solver } from '2captcha-ts';
import type { CISACSearchResult, CISACSearchParams, CISACServiceConfig } from './types.js';

// Apply stealth plugin to hide automation
chromium.use(StealthPlugin());

export class CISACService {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private solver: Solver;
  private config: CISACServiceConfig;

  private readonly BASE_URL = 'https://iswcnet.cisac.org/';

  constructor(config: CISACServiceConfig) {
    this.config = {
      headless: false,
      slowMo: 100,
      timeout: 120000,
      ...config,
    };
    this.solver = new Solver(config.apiKey);
  }

  async init(): Promise<void> {
    console.log('Initializing browser with stealth mode...');
    this.browser = await chromium.launch({
      headless: this.config.headless,
      slowMo: this.config.slowMo,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--no-sandbox',
      ],
    });

    this.context = await this.browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    });

    this.page = await this.context.newPage();
    console.log('Browser initialized with stealth');
  }

  async close(): Promise<void> {
    if (this.page) await this.page.close();
    if (this.context) await this.context.close();
    if (this.browser) await this.browser.close();
    console.log('Browser closed');
  }

  private async solveCaptcha(sitekey: string): Promise<string> {
    console.log('Solving reCAPTCHA with 2captcha...');
    console.log('Sitekey:', sitekey);

    try {
      const response = await this.solver.recaptcha({
        pageurl: this.BASE_URL,
        googlekey: sitekey,
      });

      console.log('Got captcha solution from 2captcha');
      return response.data;
    } catch (error) {
      console.error('Error solving captcha:', error);
      throw new Error(`Failed to solve captcha: ${error}`);
    }
  }

  private async acceptTerms(): Promise<boolean> {
    if (!this.page) throw new Error('Browser not initialized');

    try {
      console.log('Looking for reCAPTCHA iframe...');

      // Wait for the reCAPTCHA iframe to appear
      const captchaFrame = await this.page.waitForSelector('iframe[src*="recaptcha"]', {
        timeout: 10000
      });

      if (!captchaFrame) {
        console.error('Could not find reCAPTCHA iframe');
        return false;
      }

      // Extract sitekey from iframe src
      const src = await captchaFrame.getAttribute('src');
      if (!src) {
        console.error('Could not get iframe src');
        return false;
      }

      const sitekeyMatch = src.match(/k=([^&]+)/);
      if (!sitekeyMatch) {
        console.error('Could not extract sitekey from iframe');
        return false;
      }

      const sitekey = sitekeyMatch[1];
      console.log('Found sitekey:', sitekey);

      // Solve the captcha using 2captcha
      const token = await this.solveCaptcha(sitekey);

      // Inject the token using multiple methods
      console.log('Injecting captcha token with multiple approaches...');

      // First, debug what grecaptcha config looks like
      const configDebug = await this.page.evaluate(() => {
        const config = (window as any).___grecaptcha_cfg;
        if (!config) return { error: 'No ___grecaptcha_cfg found' };

        return {
          hasClients: !!config.clients,
          clientKeys: config.clients ? Object.keys(config.clients) : [],
          count: config.count,
        };
      });
      console.log('Grecaptcha config debug:', JSON.stringify(configDebug, null, 2));

      // Consolidated injection: Set value, dispatch events, override getResponse, call callbacks
      const injectionDebug = await this.page.evaluate((captchaToken) => {
        const debug: any = {};

        // Set the token and dispatch events
        const responseElement = document.querySelector('textarea[name="g-recaptcha-response"]');
        if (responseElement) {
          (responseElement as HTMLTextAreaElement).value = captchaToken;
          responseElement.dispatchEvent(new Event('change', { bubbles: true }));
          responseElement.dispatchEvent(new Event('input', { bubbles: true }));
          debug.textareaSet = true;
        } else {
          debug.textareaSet = false;
          debug.error = 'No textarea found';
        }

        // Override grecaptcha.getResponse (some sites poll this)
        if (typeof (window as any).grecaptcha !== 'undefined') {
          (window as any).grecaptcha.getResponse = () => captchaToken;
          debug.grecaptchaOverride = true;
        }

        // Call any configured callbacks in ___grecaptcha_cfg
        // Following 2captcha documentation: ___grecaptcha_cfg.clients[0].aa.l.callback
        const config = (window as any).___grecaptcha_cfg;
        debug.callbacks = [];
        let callbackCalled = false;

        if (config && config.clients) {
          Object.keys(config.clients).forEach((clientKey) => {
            const client = config.clients[clientKey];

            // Method 1: Try the documented path aa.l.callback first
            if (client.aa && client.aa.l && typeof client.aa.l.callback === 'function') {
              debug.callbacks.push({ client: clientKey, path: 'aa.l.callback', found: true });
              try {
                client.aa.l.callback(captchaToken);
                callbackCalled = true;
                debug.callbacks[debug.callbacks.length - 1].called = true;
              } catch (e: any) {
                debug.callbacks[debug.callbacks.length - 1].error = e.message;
              }
            }

            // Method 2: If not found, search recursively (fallback)
            if (!callbackCalled) {
              const searchCallback = (obj: any, path: string = '', depth: number = 0): void => {
                if (depth > 3 || !obj || typeof obj !== 'object') return;

                if (typeof obj.callback === 'function') {
                  debug.callbacks.push({ client: clientKey, path, found: true });
                  try {
                    obj.callback(captchaToken);
                    callbackCalled = true;
                    debug.callbacks[debug.callbacks.length - 1].called = true;
                  } catch (e: any) {
                    debug.callbacks[debug.callbacks.length - 1].error = e.message;
                  }
                  return;
                }

                for (const key in obj) {
                  if (obj.hasOwnProperty(key)) {
                    searchCallback(obj[key], path ? `${path}.${key}` : key, depth + 1);
                    if (callbackCalled) return;
                  }
                }
              };

              searchCallback(client, clientKey);
            }
          });
        }

        debug.callbackCalled = callbackCalled;

        // Call data-callback if present
        const recaptchaElement = document.querySelector('.g-recaptcha, [data-sitekey]');
        if (recaptchaElement) {
          const callbackName = recaptchaElement.getAttribute('data-callback');
          debug.dataCallback = callbackName;
          if (callbackName && typeof (window as any)[callbackName] === 'function') {
            (window as any)[callbackName](captchaToken);
            debug.dataCallbackExecuted = true;
          }
        }

        return debug;
      }, token);

      console.log('Injection debug:', JSON.stringify(injectionDebug, null, 2));

      console.log('Token injected, waiting for reCAPTCHA to validate and button to enable...');

      // Wait longer for reCAPTCHA to validate the token
      await this.page.waitForTimeout(5000);

      // Take a screenshot for debugging
      await this.page.screenshot({ path: 'cisac-service/after_injection.png' });

      // Scroll down to see if button is below fold
      console.log('Scrolling down...');
      await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await this.page.waitForTimeout(1000);

      await this.page.screenshot({ path: 'cisac-service/after_scroll.png' });

      // Wait for the button to become enabled (reCAPTCHA should validate the token)
      console.log('Waiting for "I agree" button to become enabled...');
      try {
        const button = await this.page.waitForSelector(
          'button:has-text("I agree"):not([disabled])',
          { timeout: 15000, state: 'visible' }
        );

        if (!button) {
          console.error('Button did not become enabled');
          await this.page.screenshot({ path: 'cisac-service/button_not_enabled.png' });
          return false;
        }

        console.log('Button is enabled! Clicking...');

        // Click and wait for navigation to complete
        await Promise.all([
          this.page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }).catch(() => {
            console.log('Navigation promise rejected, but continuing...');
          }),
          button.click()
        ]);

        console.log('Click completed, waiting for React app to load...');

        // Wait for React app to hydrate (the page shows "You need to enable JavaScript to run this app" initially)
        await this.page.waitForTimeout(3000);

        // Wait specifically for the search form or main content to appear
        try {
          await this.page.waitForSelector('#search-form, form[action*="search"], input[name="title"], input#title, [class*="SearchForm"]', {
            timeout: 10000,
            state: 'visible'
          });
          console.log('Search form appeared after navigation');
        } catch (e) {
          console.log('Search form did not appear, checking page state...');
        }

      } catch (e) {
        console.error('Timeout waiting for button to enable:', e);
        await this.page.screenshot({ path: 'cisac-service/button_timeout.png' });
        return false;
      }

      // Debug: Check current URL and page content
      const currentUrl = this.page.url();
      console.log('Current URL after click:', currentUrl);

      await this.page.screenshot({ path: 'cisac-service/after_click.png' });

      // Now we should see the language selection page
      console.log('Waiting for language selection page...');

      // Wait for language buttons to appear
      try {
        await this.page.waitForSelector('a[href="/search"] button:has-text("English")', {
          timeout: 10000,
          state: 'visible'
        });

        console.log('Language selection page loaded, clicking English...');
        await this.page.click('a[href="/search"] button:has-text("English")');

        // Wait for navigation to search page
        await this.page.waitForLoadState('networkidle', { timeout: 15000 });

        console.log('Waiting for React app to fully hydrate...');
        await this.page.waitForTimeout(3000);

        const finalUrl = this.page.url();
        console.log('Final URL after language selection:', finalUrl);

        await this.page.screenshot({ path: 'cisac-service/search_page.png' });

        // Check if we reached the search page
        const hasSearchPage = await this.page.evaluate(() => {
          return !!document.querySelector('#root, [class*="SearchForm"], input[name="title"]');
        });

        if (hasSearchPage) {
          console.log('Successfully reached search page');
          return true;
        } else {
          console.error('Did not reach search page after language selection');
          return false;
        }

      } catch (e) {
        console.error('Error during language selection:', e);
        await this.page.screenshot({ path: 'cisac-service/language_selection_error.png' });
        return false;
      }

    } catch (error) {
      console.error('Error accepting terms:', error);
      await this.page.screenshot({ path: 'cisac-service/error.png' });
      return false;
    }
  }

  private async getAuthToken(): Promise<string> {
    if (!this.page) throw new Error('Page not initialized');

    console.log('Extracting auth token from page...');

    // Wait a bit more for the app to fully load and set the token
    await this.page.waitForTimeout(2000);

    // Debug: check what's in localStorage and sessionStorage
    const debug = await this.page.evaluate(() => {
      const localKeys: string[] = [];
      const sessionKeys: string[] = [];

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) localKeys.push(key);
      }

      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key) sessionKeys.push(key);
      }

      // Check clientAppConfiguration
      const config = localStorage.getItem('clientAppConfiguration');

      return { localKeys, sessionKeys, hasConfig: !!config };
    });
    console.log('Storage debug:', debug);

    // Extract bearer token from localStorage and sessionStorage
    const token = await this.page.evaluate(() => {
      // Check sessionStorage first
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key) {
          const value = sessionStorage.getItem(key);
          if (value) {
            try {
              const parsed = JSON.parse(value);
              if (parsed.access_token) return parsed.access_token;
              if (parsed.token) return parsed.token;
            } catch {
              if (value.startsWith('eyJ')) return value;
            }
          }
        }
      }

      // Check localStorage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const value = localStorage.getItem(key);
          if (value) {
            try {
              const parsed = JSON.parse(value);
              if (parsed.access_token) return parsed.access_token;
              if (parsed.token) return parsed.token;
            } catch {
              if (value.startsWith('eyJ')) return value;
            }
          }
        }
      }

      return null;
    });

    if (token) {
      console.log('Successfully extracted auth token from storage');
      return token;
    }

    // If not in storage, intercept a network request to get the token
    console.log('Token not in storage, waiting for API requests...');

    let interceptedToken: string | null = null;

    // Listen to all requests
    this.page.on('request', (request) => {
      const headers = request.headers();
      if (headers['authorization'] && headers['authorization'].startsWith('Bearer ') && !interceptedToken) {
        interceptedToken = headers['authorization'].replace('Bearer ', '');
        console.log('Intercepted bearer token from request to:', request.url());
      }
    });

    // Wait for page to make initial requests (app loads and gets token)
    console.log('Waiting for app to make API requests...');
    await this.page.waitForTimeout(5000);

    // If still no token, try triggering a search to force an API call
    if (!interceptedToken) {
      console.log('No token yet, triggering a dummy search to capture auth token...');

      try {
        // Type a dummy ISWC in the search field
        const searchInput = await this.page.waitForSelector('input[type="text"], input[name="iswc"], input[placeholder*="ISWC" i]', { timeout: 5000 });
        if (searchInput) {
          await searchInput.fill('T0000000001'); // Dummy ISWC
          await this.page.waitForTimeout(500);

          // Try to submit or trigger search
          const searchButton = await this.page.locator('button[type="submit"], button:has-text("Search")').first();
          if (searchButton) {
            await searchButton.click();
            console.log('Clicked search button, waiting for API request...');
            await this.page.waitForTimeout(3000);
          }
        }
      } catch (e) {
        console.log('Could not trigger search:', e);
      }
    }

    if (!interceptedToken) {
      throw new Error('Failed to extract authentication token - no API requests with Authorization header observed');
    }

    console.log('Successfully intercepted auth token');
    return interceptedToken;
  }

  async searchByIswc(iswc: string): Promise<any> {
    if (!this.page) await this.init();
    if (!this.page) throw new Error('Failed to initialize browser');

    console.log(`Searching CISAC by ISWC: ${iswc}`);

    // Navigate to CISAC and accept terms if needed
    await this.page.goto(this.BASE_URL);
    const hasLandingPage = await this.page.locator('.LandingPage_textContainer__S5S5c, [class*="LandingPage"]').count() > 0;

    if (hasLandingPage) {
      console.log('Found terms page, accepting...');
      const accepted = await this.acceptTerms();
      if (!accepted) {
        throw new Error('Failed to accept terms');
      }
    }

    // Get auth token
    const token = await this.getAuthToken();
    if (!token) {
      throw new Error('Failed to get authentication token');
    }

    console.log('Got auth token, making API request...');

    // Make API request using Playwright's request context
    const response = await this.page.request.get(
      `https://cisaciswcprod.azure-api.net/iswc/searchByIswc?iswc=${iswc}`,
      {
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'Authorization': `Bearer ${token}`,
          'Origin': 'https://iswcnet.cisac.org',
          'Referer': 'https://iswcnet.cisac.org/',
          'Request-Source': 'PORTAL',
        }
      }
    );

    if (!response.ok()) {
      throw new Error(`API request failed: ${response.status()} ${response.statusText()}`);
    }

    const data = await response.json();
    return data;
  }

  async search(params: CISACSearchParams): Promise<CISACSearchResult[]> {
    if (!this.page) await this.init();
    if (!this.page) throw new Error('Failed to initialize browser');

    try {
      console.log(`Searching CISAC for: ${params.title}${params.artist ? ` by ${params.artist}` : ''}`);

      // Navigate to CISAC
      console.log('Navigating to CISAC...');
      await this.page.goto(this.BASE_URL);

      // Check if we need to accept terms
      const hasLandingPage = await this.page.locator('.LandingPage_textContainer__S5S5c, [class*="LandingPage"]').count() > 0;

      if (hasLandingPage) {
        console.log('Found terms page, accepting...');
        const accepted = await this.acceptTerms();
        if (!accepted) {
          throw new Error('Failed to accept terms');
        }
      } else {
        console.log('No terms page found, already on search page');
      }

      // Wait for search form
      console.log('Looking for search form...');
      await this.page.waitForSelector('#search-form, form[action*="search"]', { timeout: 10000 });

      // Fill in search form
      console.log('Filling search form...');
      await this.page.fill('#title, input[name="title"]', params.title);

      if (params.artist) {
        await this.page.fill('#artist, input[name="artist"]', params.artist);
      }

      // Submit search
      console.log('Submitting search...');
      await this.page.click('button[type="submit"]');

      // Wait for results
      console.log('Waiting for results...');
      await this.page.waitForSelector('table, .results', { timeout: 10000 });

      // Extract results
      const results = await this.page.evaluate(() => {
        const rows = document.querySelectorAll('table tbody tr, .result-row');
        return Array.from(rows).map(row => {
          const cells = row.querySelectorAll('td, .cell');
          return {
            iswc: cells[0]?.textContent?.trim() || '',
            title: cells[1]?.textContent?.trim() || '',
            creators: cells[2]?.textContent?.trim() || '',
            status: cells[3]?.textContent?.trim() || '',
          };
        }).filter(result => result.iswc); // Filter out empty results
      });

      console.log(`Found ${results.length} results`);
      return results;

    } catch (error) {
      console.error('Error searching CISAC:', error);
      if (this.page) {
        await this.page.screenshot({ path: 'cisac-service/search_error.png' });
      }
      throw error;
    }
  }
}
