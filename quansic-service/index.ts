/**
 * Quansic Enrichment Service
 *
 * Provides HTTP API for:
 * - Authenticating with Quansic via Playwright
 * - Enriching artist data with ISNI lookups
 * - Session cookie caching
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { chromium, Browser, BrowserContext } from 'playwright';
import { chromium as playwrightExtra } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

const app = new Hono();

// Global state
let browser: Browser | null = null;
let sessionCookie: string | null = null;
let sessionExpiry: number = 0; // Timestamp when session expires
const SESSION_DURATION = 3600000; // 1 hour

// Account pool management
interface AccountCredentials {
  email: string;
  password: string;
  status: 'active' | 'failed' | 'banned';
  lastUsed: number;
  failureCount: number;
  requestCount: number; // Track requests per account
}

const accountPool: AccountCredentials[] = [];
let currentAccountIndex = 0;
const REQUESTS_PER_ACCOUNT = parseInt(process.env.REQUESTS_PER_ACCOUNT || '50'); // Rotate after N requests
const ROTATION_INTERVAL_MS = parseInt(process.env.ROTATION_INTERVAL_MS || '1800000'); // 30 minutes default

interface QuansicArtistData {
  isni: string;
  musicbrainz_mbid?: string;
  ipn: string | null;
  luminate_id: string | null;
  gracenote_id: string | null;
  amazon_id: string | null;
  apple_music_id: string | null;
  name_variants: Array<{ name: string; language?: string }>;
  raw_data: Record<string, unknown>;
}

interface AuthRequest {
  email: string;
  password: string;
}

interface EnrichRequest {
  isni: string;
  musicbrainz_mbid?: string;
  spotify_artist_id?: string;
  force_reauth?: boolean;
}

interface SearchRequest {
  isni: string;
}

interface EnrichRecordingRequest {
  isrc: string;
  spotify_track_id?: string;
  recording_mbid?: string;
  force_reauth?: boolean;
}

interface EnrichWorkRequest {
  iswc: string;
  work_mbid?: string;
  force_reauth?: boolean;
}

/**
 * Initialize Playwright browser with stealth mode (headless Chrome)
 */
async function getBrowser(): Promise<Browser> {
  if (!browser) {
    console.log('🌐 Launching Playwright browser with stealth...');
    // Add stealth plugin
    playwrightExtra.use(StealthPlugin());
    browser = await playwrightExtra.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process'
      ]
    }) as unknown as Browser;
  }
  return browser;
}

/**
 * Generate a random email address
 */
function generateEmail(): string {
  const adjectives = ['happy', 'quick', 'bright', 'clever', 'smooth', 'calm', 'bold', 'wise', 'noble', 'swift'];
  const nouns = ['tiger', 'falcon', 'river', 'mountain', 'ocean', 'storm', 'forest', 'thunder', 'phoenix', 'dragon'];
  const domains = ['tiffincrane.com', 'mailinator.com', 'guerrillamail.com'];

  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 9999);
  const domain = domains[Math.floor(Math.random() * domains.length)];

  return `${adj}${noun}${num}@${domain}`;
}

/**
 * Generate a strong password meeting Quansic requirements
 * Must be at least 8 characters long, have at least one digit and at least one uppercase letter
 */
function generatePassword(): string {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const digits = '0123456789';
  const special = '!@#$%^&*';

  // Ensure requirements are met
  let password = '';
  password += uppercase[Math.floor(Math.random() * uppercase.length)]; // At least one uppercase
  password += digits[Math.floor(Math.random() * digits.length)]; // At least one digit
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += special[Math.floor(Math.random() * special.length)];

  // Fill remaining characters
  const allChars = lowercase + uppercase + digits + special;
  for (let i = password.length; i < 12; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

/**
 * Register a new Quansic account
 */
async function registerAccount(email: string, password: string): Promise<boolean> {
  const browser = await getBrowser();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log(`📝 Registering new account: ${email}...`);

    // Navigate to registration page
    await page.goto('https://explorer.quansic.com/app-register', {
      waitUntil: 'domcontentloaded',
      timeout: 90000
    });

    // Wait for form to be visible
    await page.waitForSelector('input[name="email"]', { timeout: 30000 });

    // Fill in registration form
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.fill('input[name="confirmPassword"]', password);
    await page.fill('input[name="name"]', 'Music Researcher');
    await page.fill('input[name="company"]', 'Research Institute');

    // Check the terms and conditions checkbox (click the label, not the input)
    await page.click('label.mat-checkbox-layout');

    // Wait a bit for form validation
    await page.waitForTimeout(1000);

    // Wait for the form to be fully ready (all inputs filled and checkbox checked)
    await page.waitForTimeout(2000);

    // Find and click the submit button
    // Try multiple approaches to find the button
    let buttonClicked = false;

    // First try: wait for any button to become enabled
    try {
      await page.waitForSelector('button.mat-raised-button:not([disabled])', { timeout: 5000 });
      await Promise.all([
        page.waitForURL(/explorer\.quansic\.com\/(?!app-register)/, {
          waitUntil: 'domcontentloaded',
          timeout: 90000
        }),
        page.click('button.mat-raised-button:not([disabled])')
      ]);
      buttonClicked = true;
    } catch (e) {
      console.log('Failed with mat-raised-button selector, trying alternatives...');
    }

    // Second try: Look for button by text content
    if (!buttonClicked) {
      try {
        const buttons = await page.$$('button');
        for (const button of buttons) {
          const text = await button.textContent();
          if (text && (text.toLowerCase().includes('register') || text.toLowerCase().includes('sign up') || text.toLowerCase().includes('create account'))) {
            await Promise.all([
              page.waitForURL(/explorer\.quansic\.com\/(?!app-register)/, {
                waitUntil: 'domcontentloaded',
                timeout: 90000
              }),
              button.click()
            ]);
            buttonClicked = true;
            break;
          }
        }
      } catch (e) {
        console.log('Failed to find button by text content');
      }
    }

    if (!buttonClicked) {
      throw new Error('Could not find registration button');
    }

    console.log(`✅ Account registered successfully: ${email}`);
    return true;

  } catch (error: any) {
    console.error(`❌ Registration failed for ${email}:`, error.message);
    return false;
  } finally {
    await context.close();
  }
}

/**
 * Initialize account pool with all accounts from env vars
 * Supports: QUANSIC_EMAIL, QUANSIC_EMAIL_2, QUANSIC_EMAIL_3, etc.
 */
function initializeAccountPool() {
  let accountIndex = 1;

  // Load primary account
  const email = process.env.QUANSIC_EMAIL;
  const password = process.env.QUANSIC_PASSWORD;

  if (email && password) {
    accountPool.push({
      email,
      password,
      status: 'active',
      lastUsed: 0,
      failureCount: 0,
      requestCount: 0
    });
    console.log(`📋 Account 1: ${email}`);
  }

  // Load additional accounts (QUANSIC_EMAIL_2, QUANSIC_EMAIL_3, etc.)
  while (true) {
    accountIndex++;
    const extraEmail = process.env[`QUANSIC_EMAIL_${accountIndex}`];
    const extraPassword = process.env[`QUANSIC_PASSWORD_${accountIndex}`];

    if (!extraEmail || !extraPassword) {
      break;
    }

    accountPool.push({
      email: extraEmail,
      password: extraPassword,
      status: 'active',
      lastUsed: 0,
      failureCount: 0,
      requestCount: 0
    });
    console.log(`📋 Account ${accountIndex}: ${extraEmail}`);
  }

  console.log(`✅ Initialized account pool with ${accountPool.length} account(s)`);
  console.log(`🔄 Rotation settings: ${REQUESTS_PER_ACCOUNT} requests or ${ROTATION_INTERVAL_MS / 60000} minutes per account`);
}

/**
 * Get next available account from pool with proactive rotation
 */
async function getNextAccount(): Promise<AccountCredentials> {
  if (accountPool.length === 0) {
    throw new Error('No accounts configured. Set QUANSIC_EMAIL and QUANSIC_PASSWORD environment variables.');
  }

  const currentAccount = accountPool[currentAccountIndex];

  // Check if current account needs rotation
  const shouldRotate =
    currentAccount.requestCount >= REQUESTS_PER_ACCOUNT ||
    (Date.now() - currentAccount.lastUsed) > ROTATION_INTERVAL_MS ||
    currentAccount.status !== 'active';

  if (shouldRotate && accountPool.length > 1) {
    console.log(`🔄 Rotating from ${currentAccount.email} (requests: ${currentAccount.requestCount}, status: ${currentAccount.status})`);

    // Find next active account
    let nextIndex = (currentAccountIndex + 1) % accountPool.length;
    let attempts = 0;

    while (attempts < accountPool.length) {
      const nextAccount = accountPool[nextIndex];
      if (nextAccount.status === 'active' && nextAccount.failureCount < 3) {
        currentAccountIndex = nextIndex;
        console.log(`✅ Rotated to ${nextAccount.email}`);
        return nextAccount;
      }
      nextIndex = (nextIndex + 1) % accountPool.length;
      attempts++;
    }

    // All accounts are failed, reset counters and try again
    console.log('⚠️ All accounts failed, resetting failure counts...');
    accountPool.forEach(acc => {
      if (acc.status === 'failed') {
        acc.status = 'active';
        acc.failureCount = 0;
        acc.requestCount = 0;
      }
    });
  }

  return accountPool[currentAccountIndex];
}

/**
 * Mark current account as failed and get next account
 */
async function rotateAccount(): Promise<AccountCredentials> {
  if (accountPool.length > 0 && currentAccountIndex < accountPool.length) {
    const currentAccount = accountPool[currentAccountIndex];
    currentAccount.failureCount++;

    if (currentAccount.failureCount >= 3) {
      currentAccount.status = 'banned';
      console.log(`🚫 Account marked as banned: ${currentAccount.email}`);
    } else {
      currentAccount.status = 'failed';
      console.log(`⚠️ Account marked as failed: ${currentAccount.email} (${currentAccount.failureCount}/3)`);
    }
  }

  return await getNextAccount();
}

/**
 * Human-like random delay
 */
async function humanDelay(minMs: number = 800, maxMs: number = 2500): Promise<void> {
  const delay = Math.random() * (maxMs - minMs) + minMs;
  await new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Simulate human typing with random speed
 */
async function humanType(page: any, selector: string, text: string): Promise<void> {
  await page.click(selector); // Focus the input
  await humanDelay(300, 800); // Think before typing

  for (const char of text) {
    await page.keyboard.type(char);
    // Random typing speed: 50-200ms per character
    await new Promise(resolve => setTimeout(resolve, Math.random() * 150 + 50));
  }

  await humanDelay(200, 600); // Pause after typing
}

/**
 * Move mouse in human-like path before clicking
 */
async function humanClick(page: any, selector: string): Promise<void> {
  const element = await page.$(selector);
  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }

  const box = await element.boundingBox();
  if (!box) {
    throw new Error(`Cannot get bounding box for: ${selector}`);
  }

  // Move mouse to random position near element
  const targetX = box.x + (box.width * 0.3) + (Math.random() * box.width * 0.4);
  const targetY = box.y + (box.height * 0.3) + (Math.random() * box.height * 0.4);

  await page.mouse.move(targetX, targetY, { steps: 10 + Math.floor(Math.random() * 15) });
  await humanDelay(100, 400); // Pause before clicking
  await element.click();
}

/**
 * Authenticate with Quansic and get session cookie
 */
async function authenticate(email: string, password: string, retryWithNewAccount = true): Promise<string> {
  const browser = await getBrowser();

  // Randomize browser fingerprint
  const viewportWidth = 1366 + Math.floor(Math.random() * 554); // 1366-1920
  const viewportHeight = 768 + Math.floor(Math.random() * 312); // 768-1080
  const timezones = ['America/New_York', 'America/Chicago', 'America/Los_Angeles', 'America/Denver', 'Europe/London'];
  const locales = ['en-US', 'en-GB', 'en-CA'];

  const context = await browser.newContext({
    viewport: { width: viewportWidth, height: viewportHeight },
    locale: locales[Math.floor(Math.random() * locales.length)],
    timezoneId: timezones[Math.floor(Math.random() * timezones.length)],
    deviceScaleFactor: 1 + Math.random() * 0.5,
  });

  const page = await context.newPage();

  try {
    console.log(`🔐 Authenticating with Quansic (${email})...`);

    // Navigate to login page (use domcontentloaded for Akash compatibility)
    console.log('📄 Navigating to login page...');
    await page.goto('https://explorer.quansic.com/app-login', {
      waitUntil: 'domcontentloaded',
      timeout: 90000
    });

    // Human-like reading delay
    await humanDelay(1500, 3000);

    // Wait for form to be visible
    console.log('⏳ Waiting for email field...');
    await page.waitForSelector('input[name="email"]', { timeout: 30000 });

    // Scroll a bit (humans often do this)
    await page.mouse.wheel(0, Math.random() * 100);
    await humanDelay(500, 1200);

    // Fill in credentials with human typing
    console.log('✍️ Typing email...');
    await humanType(page, 'input[name="email"]', email);

    await humanDelay(600, 1400); // Pause between fields

    console.log('✍️ Typing password...');
    await humanType(page, 'input[name="password"]', password);

    // Pause before submitting (humans review what they typed)
    await humanDelay(1000, 2500);

    console.log('🖱️ Clicking login button...');
    // Click login button with mouse movement
    await humanClick(page, 'button:has-text("Login")');

    // Wait for either navigation or error message
    console.log('⏳ Waiting for response...');
    try {
      await page.waitForURL(/explorer\.quansic\.com\/(?!app-login)/, {
        waitUntil: 'domcontentloaded',
        timeout: 10000  // Shorter timeout to check for errors faster
      });
      console.log('✅ Navigation completed');
    } catch (navError) {
      // Check if we're still on login page - might be an error
      const currentUrl = page.url();
      console.log(`⚠️ Still on URL: ${currentUrl}`);

      // Take screenshot for debugging
      await page.screenshot({ path: '/tmp/quansic-login-debug.png' });
      console.log('📸 Screenshot saved to /tmp/quansic-login-debug.png');

      // Check for error messages
      const errorText = await page.textContent('body').catch(() => '');
      if (errorText.toLowerCase().includes('invalid') ||
          errorText.toLowerCase().includes('incorrect') ||
          errorText.toLowerCase().includes('error') ||
          errorText.toLowerCase().includes('failed') ||
          errorText.toLowerCase().includes('authentication')) {
        // Extract specific error message if visible
        const errorMsg = await page.textContent('.error, .alert, [class*="error"], [class*="alert"]').catch(() => '');
        throw new Error(`Login failed - ${errorMsg || 'Authentication error detected'}. Check screenshot at /tmp/quansic-login-debug.png`);
      }

      // If no error found, wait a bit longer
      console.log('⏳ No immediate error found, waiting longer for navigation...');
      await page.waitForURL(/explorer\.quansic\.com\/(?!app-login)/, {
        waitUntil: 'domcontentloaded',
        timeout: 80000
      });
      console.log('✅ Navigation completed (after extended wait)');
    }

    // Extract cookies
    const cookies = await context.cookies();
    const sessionCookieStr = cookies
      .map(c => `${c.name}=${c.value}`)
      .join('; ');

    console.log('✅ Authentication successful');

    // Mark account as active on success
    if (accountPool.length > 0 && currentAccountIndex < accountPool.length) {
      accountPool[currentAccountIndex].status = 'active';
      accountPool[currentAccountIndex].lastUsed = Date.now();
      accountPool[currentAccountIndex].failureCount = 0;
    }

    return sessionCookieStr;

  } catch (error: any) {
    console.error('❌ Authentication failed:', error.message);

    // If timeout or navigation error, try rotating to a new account
    if (retryWithNewAccount && (error.message.includes('Timeout') || error.message.includes('forURL'))) {
      console.log('🔄 Timeout detected, rotating to new account...');

      try {
        const newAccount = await rotateAccount();
        return await authenticate(newAccount.email, newAccount.password, false);
      } catch (rotateError: any) {
        console.error('❌ Account rotation failed:', rotateError.message);
        throw new Error(`Failed to authenticate after account rotation: ${rotateError.message}`);
      }
    }

    throw new Error(`Quansic authentication failed: ${error.message}`);
  } finally {
    await context.close();
  }
}

/**
 * Check if current session is valid
 */
function isSessionValid(): boolean {
  return sessionCookie !== null && Date.now() < sessionExpiry;
}

/**
 * Ensure we have a valid session cookie
 */
async function ensureSession(forceReauth = false): Promise<string> {
  if (!forceReauth && isSessionValid() && sessionCookie) {
    // Increment request count for current account
    if (accountPool[currentAccountIndex]) {
      accountPool[currentAccountIndex].requestCount++;
    }
    return sessionCookie;
  }

  // Initialize account pool on first use
  if (accountPool.length === 0) {
    initializeAccountPool();
  }

  // Get an account to use (will rotate if needed)
  const account = await getNextAccount();

  sessionCookie = await authenticate(account.email, account.password);
  sessionExpiry = Date.now() + SESSION_DURATION;

  // Reset request count on new session
  account.requestCount = 0;
  account.lastUsed = Date.now();

  return sessionCookie;
}

/**
 * Fetch artist party data from Quansic
 */
async function getArtistParty(isni: string, cookie: string): Promise<any> {
  const cleanIsni = isni.replace(/\s/g, '');
  const url = `https://explorer.quansic.com/api/q/lookup/party/Quansic::isni::${cleanIsni}`;

  const response = await fetch(url, {
    headers: {
      'cookie': cookie,
      'accept': 'application/json',
      'user-agent': 'Mozilla/5.0',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Quansic API error ${response.status} for ISNI ${cleanIsni}:`, errorText.substring(0, 200));

    if (response.status === 401 || response.status === 403) {
      throw new Error('SESSION_EXPIRED');
    }
    throw new Error(`Quansic API error: ${response.status}`);
  }

  const data = await response.json();
  return data.results;
}

/**
 * Fetch artist name variants
 */
async function getArtistNameVariants(isni: string, cookie: string): Promise<Array<{ name: string; language?: string }>> {
  const cleanIsni = isni.replace(/\s/g, '');
  const url = `https://explorer.quansic.com/api/q/lookup/party/Quansic::isni::${cleanIsni}/nameVariants`;

  const response = await fetch(url, {
    headers: {
      'cookie': cookie,
      'accept': 'application/json',
      'user-agent': 'Mozilla/5.0',
    },
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('SESSION_EXPIRED');
    }
    console.warn(`Failed to fetch name variants for ${isni}: ${response.status}`);
    return [];
  }

  const data = await response.json();
  const variants = data.results?.nameVariants || [];

  return variants.map((v: any) => ({
    name: v.fullname || v.name,
    language: v.language,
  }));
}

/**
 * Search for artist party by ISNI using entity search
 */
async function searchByISNI(isni: string, cookie: string): Promise<any> {
  const cleanIsni = isni.replace(/\s/g, '');
  const url = 'https://explorer.quansic.com/api/log/entitySearch';

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'cookie': cookie,
      'accept': 'application/json',
      'content-type': 'application/json',
      'user-agent': 'Mozilla/5.0',
    },
    body: JSON.stringify({
      entityType: 'isni',
      searchTerm: cleanIsni,
    }),
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('SESSION_EXPIRED');
    }
    const errorText = await response.text();
    console.error(`Entity search failed (${response.status}):`, errorText.substring(0, 200));
    return null;
  }

  const responseText = await response.text();
  if (!responseText || responseText.trim() === '') {
    return null;
  }

  let data;
  try {
    data = JSON.parse(responseText);
  } catch (e) {
    console.error('Failed to parse entity search response');
    return null;
  }

  const parties = data.results?.parties;

  if (parties && parties.length > 0) {
    console.log(`Found via entity search! Primary ISNI: ${parties[0].ids.isnis[0]}`);
    return { party: parties[0] };
  }

  return null;
}

/**
 * Search for artist party by Spotify ID using direct search endpoint
 * Fallback when ISNI lookups fail (handles secondary ISNIs)
 */
async function searchBySpotifyId(spotifyId: string, cookie: string): Promise<any> {
  const url = `https://explorer.quansic.com/api/q/search/party/spotifyId/${spotifyId}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'cookie': cookie,
      'accept': 'application/json',
      'user-agent': 'Mozilla/5.0',
    },
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('SESSION_EXPIRED');
    }
    const errorText = await response.text();
    console.error(`Spotify entity search failed (${response.status}):`, errorText.substring(0, 200));
    return null;
  }

  const responseText = await response.text();
  if (!responseText || responseText.trim() === '') {
    console.log('Spotify entity search returned empty response');
    return null;
  }

  let data;
  try {
    data = JSON.parse(responseText);
  } catch (e) {
    console.error('Failed to parse Spotify entity search response');
    return null;
  }

  console.log(`Spotify search response:`, JSON.stringify(data).substring(0, 500));
  const parties = data.results?.parties;

  if (parties && parties.length > 0) {
    // If multiple parties, prefer the one with more complete data
    const bestParty = parties.reduce((best: any, current: any) => {
      const bestIsnis = best?.ids?.isnis?.length || 0;
      const currentIsnis = current?.ids?.isnis?.length || 0;
      return currentIsnis > bestIsnis ? current : best;
    }, parties[0]);

    console.log(`Found via Spotify search! Primary ISNI: ${bestParty.ids.isnis?.[0] || 'N/A'} (from ${parties.length} results)`);
    return { party: bestParty };
  }

  return null;
}

/**
 * Enrich artist with complete Quansic data
 */
async function enrichArtist(
  isni: string,
  musicbrainzMbid?: string,
  spotifyArtistId?: string,
  forceReauth = false
): Promise<QuansicArtistData> {
  console.log(`Enriching ISNI ${isni}...`);

  const cookie = await ensureSession(forceReauth);
  let party = null;
  let actualIsni = isni;

  try {
    // Try direct ISNI lookup first
    party = await getArtistParty(isni, cookie);
  } catch (error: any) {
    // Session expired, retry with new session
    if (error.message === 'SESSION_EXPIRED') {
      console.log('Session expired, re-authenticating...');
      const newCookie = await ensureSession(true);
      party = await getArtistParty(isni, newCookie);
    } else if (error.message.includes('404')) {
      // If direct lookup fails, try entity search (finds secondary ISNIs)
      console.log(`Direct lookup failed, trying entity search for ${isni}...`);
      party = await searchByISNI(isni, cookie);

      // Extract the primary ISNI from Quansic data
      if (party?.party?.ids?.isnis?.length > 0) {
        actualIsni = party.party.ids.isnis[0];
        console.log(`Found via search! Primary Quansic ISNI: ${actualIsni}`);
      }

      // If still no party and we have Spotify ID, try Spotify search
      if (!party && spotifyArtistId) {
        console.log(`ISNI search failed, trying Spotify ID: ${spotifyArtistId}...`);
        party = await searchBySpotifyId(spotifyArtistId, cookie);

        // Extract the primary ISNI from Spotify search result
        if (party?.party?.ids?.isnis?.length > 0) {
          actualIsni = party.party.ids.isnis[0];
          console.log(`Found via Spotify! Primary ISNI: ${actualIsni}`);
        }
      }
    }

    // If still no party data, re-throw the error
    if (!party) {
      throw error;
    }
  }

  const nameVariants = await getArtistNameVariants(actualIsni, cookie);
  const ids = party.party?.ids || {};

  return {
    isni: actualIsni.replace(/\s/g, ''),
    musicbrainz_mbid: musicbrainzMbid,
    ipn: ids.ipns?.[0] || null,
    luminate_id: ids.luminateIds?.[0] || null,
    gracenote_id: ids.gracenoteIds?.[0] || null,
    amazon_id: ids.amazonIds?.[0] || null,
    apple_music_id: ids.appleIds?.[0] || null,
    name_variants: nameVariants,
    raw_data: party,
  };
}

/**
 * Enrich recording with ISRC lookup
 * Returns recording + work + contributors
 */
async function enrichRecording(isrc: string, spotifyTrackId?: string, recordingMbid?: string, forceReauth = false) {
  console.log(`Enriching ISRC ${isrc}...`);

  const cookie = await ensureSession(forceReauth);
  const cleanIsrc = isrc.replace(/\s/g, '');
  const url = `https://explorer.quansic.com/api/q/lookup/recording/isrc/${cleanIsrc}`;

  const response = await fetch(url, {
    headers: {
      'cookie': cookie,
      'accept': 'application/json',
      'user-agent': 'Mozilla/5.0',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Quansic ISRC lookup error ${response.status}:`, errorText.substring(0, 200));

    if (response.status === 401 || response.status === 403) {
      throw new Error('SESSION_EXPIRED');
    }
    if (response.status === 404) {
      throw new Error(`ISRC not found: ${cleanIsrc}`);
    }
    throw new Error(`Quansic API error: ${response.status}`);
  }

  const data = await response.json();
  const recording = data.results?.recording;

  if (!recording) {
    throw new Error('No recording data in response');
  }

  // Fetch work data separately (not included in recording endpoint)
  let work = null;
  const worksUrl = `https://explorer.quansic.com/api/q/lookup/recording/isrc/${cleanIsrc}/works/0`;

  try {
    const worksResponse = await fetch(worksUrl, {
      headers: {
        'cookie': cookie,
        'accept': 'application/json',
        'user-agent': 'Mozilla/5.0',
        'x-instance': 'default',
      },
    });

    if (worksResponse.ok) {
      const worksData = await worksResponse.json();
      if (worksData.results?.data?.length > 0) {
        work = worksData.results.data[0]; // First work
        console.log(`✓ Found work: ${work.iswc} - ${work.title}`);
      }
    } else {
      console.log(`No work data found for ${cleanIsrc} (${worksResponse.status})`);
    }
  } catch (error: any) {
    console.log(`Failed to fetch work data: ${error.message}`);
  }

  return {
    isrc: cleanIsrc,
    spotify_track_id: spotifyTrackId,
    recording_mbid: recordingMbid,

    // Recording metadata
    title: recording.title,
    subtitle: recording.subtitle || null,
    duration_ms: recording.durationMs || null,
    release_date: recording.releaseDate || null,

    // Work data (embedded)
    iswc: work?.iswc?.replace(/\s/g, '') || null,
    work_title: work?.title || null,

    // Artists (MainArtist contributors)
    artists: recording.contributors?.filter((c: any) => c.contributorType === 'MainArtist').map((a: any) => ({
      name: a.name,
      isni: a.ids?.isnis?.[0] || null,
      ipi: a.ids?.ipis?.[0] || null,
      role: a.contributorType,
      ids: a.ids || {},
    })) || [],

    // Composers (from work)
    composers: work?.contributors?.map((c: any) => ({
      name: c.name,
      isni: c.ids?.isnis?.[0] || null,
      ipi: c.ids?.ipis?.[0] || null,
      role: c.role,
      birthdate: c.birthdate || null,
    })) || [],

    // Platform IDs
    platform_ids: {
      spotify: recording.spotifyId || null,
      apple: recording.appleId || null,
      musicbrainz: recording.musicBrainzId || null,
      luminate: recording.luminateId || null,
      gracenote: recording.gracenoteId || null,
    },

    // Quality score
    q2_score: recording.q2Score || null,

    raw_data: {
      recording: data.results,
      works: work ? [work] : [],
    },
  };
}

/**
 * Enrich work with ISWC lookup
 * Returns work + composers + all recordings (for verification)
 */
async function enrichWork(iswc: string, workMbid?: string, forceReauth = false) {
  console.log(`Enriching ISWC ${iswc}...`);

  const cookie = await ensureSession(forceReauth);
  const cleanIswc = iswc.replace(/[-.\s]/g, '');  // Remove dashes, dots, and spaces
  const url = `https://explorer.quansic.com/api/q/lookup/work/iswc/${cleanIswc}`;

  const response = await fetch(url, {
    headers: {
      'cookie': cookie,
      'accept': 'application/json',
      'user-agent': 'Mozilla/5.0',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Quansic ISWC lookup error ${response.status}:`, errorText.substring(0, 200));

    if (response.status === 401 || response.status === 403) {
      throw new Error('SESSION_EXPIRED');
    }
    if (response.status === 404) {
      throw new Error(`ISWC not found: ${cleanIswc}`);
    }
    throw new Error(`Quansic API error: ${response.status}`);
  }

  const data = await response.json();
  const work = data.results?.work;

  if (!work) {
    throw new Error('No work data in response');
  }

  return {
    iswc: cleanIswc,
    work_mbid: workMbid,

    title: work.title,

    // Composers/Writers
    contributors: work.contributors?.map((c: any) => ({
      name: c.name,
      isni: c.ids?.isnis?.[0] || null,
      ipi: c.ids?.ipis?.[0] || null,
      role: c.role,
      birthdate: c.birthdate || null,
      nationality: c.nationality || null,
    })) || [],

    // Verification metadata
    recording_count: work.recordings?.length || 0,
    q1_score: work.q1Score || null,

    // Sample recordings (first 5, for verification)
    sample_recordings: work.recordings?.slice(0, 5).map((r: any) => ({
      isrc: r.isrc,
      title: r.title,
      subtitle: r.subtitle,
      artists: r.contributors?.filter((c: any) => c.contributorType === 'MainArtist').map((a: any) => a.name) || [],
    })) || [],

    raw_data: data.results,
  };
}

// Middleware
app.use('*', cors());

// Routes
app.get('/health', (c) => {
  const activeAccounts = accountPool.filter(a => a.status === 'active').length;
  const failedAccounts = accountPool.filter(a => a.status === 'failed').length;
  const bannedAccounts = accountPool.filter(a => a.status === 'banned').length;

  return c.json({
    status: 'healthy',
    uptime: process.uptime(),
    session_valid: isSessionValid(),
    session_expires_in: sessionExpiry > 0 ? Math.max(0, sessionExpiry - Date.now()) : 0,
    account_pool: {
      total: accountPool.length,
      active: activeAccounts,
      failed: failedAccounts,
      banned: bannedAccounts,
      current_account: accountPool[currentAccountIndex]?.email || 'none'
    },
    service: 'quansic-enrichment-service',
    version: '1.2.0'
  });
});

app.post('/auth', async (c) => {
  try {
    const body: AuthRequest = await c.req.json();
    const { email, password } = body;

    if (!email || !password) {
      return c.json({ error: 'email and password required' }, 400);
    }

    const cookie = await authenticate(email, password);
    sessionCookie = cookie;
    sessionExpiry = Date.now() + SESSION_DURATION;

    return c.json({
      success: true,
      message: 'Authenticated successfully',
      session_expires_in: SESSION_DURATION
    });
  } catch (error: any) {
    console.error('Auth error:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.get('/session-status', (c) => {
  return c.json({
    valid: isSessionValid(),
    expires_in: sessionExpiry > 0 ? Math.max(0, sessionExpiry - Date.now()) : 0,
    has_cookie: sessionCookie !== null
  });
});

app.get('/account-pool', (c) => {
  const poolStatus = accountPool.map((account, index) => ({
    index,
    email: account.email,
    status: account.status,
    failure_count: account.failureCount,
    request_count: account.requestCount,
    requests_until_rotation: Math.max(0, REQUESTS_PER_ACCOUNT - account.requestCount),
    last_used: account.lastUsed > 0 ? new Date(account.lastUsed).toISOString() : 'never',
    is_current: index === currentAccountIndex
  }));

  return c.json({
    current_index: currentAccountIndex,
    total_accounts: accountPool.length,
    rotation_threshold: REQUESTS_PER_ACCOUNT,
    rotation_interval_minutes: ROTATION_INTERVAL_MS / 60000,
    accounts: poolStatus
  });
});

app.post('/enrich', async (c) => {
  try {
    const body: EnrichRequest = await c.req.json();
    const { isni, musicbrainz_mbid, spotify_artist_id, force_reauth } = body;

    if (!isni) {
      return c.json({ error: 'isni required' }, 400);
    }

    console.log(`📊 Enrichment request: ISNI ${isni}${spotify_artist_id ? ` (Spotify: ${spotify_artist_id})` : ''}`);

    const enriched = await enrichArtist(isni, musicbrainz_mbid, spotify_artist_id, force_reauth);

    return c.json({
      success: true,
      data: enriched
    });
  } catch (error: any) {
    console.error('Enrichment error:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.post('/search', async (c) => {
  try {
    const body: SearchRequest = await c.req.json();
    const { isni } = body;

    if (!isni) {
      return c.json({ error: 'isni required' }, 400);
    }

    console.log(`🔍 Search request: ISNI ${isni}`);

    const cookie = await ensureSession();
    const result = await searchByISNI(isni, cookie);

    if (!result) {
      return c.json({ error: 'No results found' }, 404);
    }

    return c.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('Search error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// POST /enrich-recording - Enrich recording by ISRC
app.post('/enrich-recording', async (c) => {
  try {
    const body = await c.req.json<EnrichRecordingRequest>();
    const { isrc, spotify_track_id, recording_mbid, force_reauth } = body;

    if (!isrc) {
      return c.json({ error: 'isrc is required' }, 400);
    }

    console.log(`🎵 Recording enrichment: ISRC ${isrc}`);

    let result;
    try {
      result = await enrichRecording(isrc, spotify_track_id, recording_mbid, force_reauth);
    } catch (error: any) {
      // Handle session expiration gracefully
      if (error.message === 'SESSION_EXPIRED' && !force_reauth) {
        console.log(`Session expired for ISRC ${isrc}, retrying with reauth...`);
        result = await enrichRecording(isrc, spotify_track_id, recording_mbid, true);
      } else {
        throw error;
      }
    }

    if (!result) {
      return c.json({ error: 'No recording found for this ISRC' }, 404);
    }

    return c.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('Recording enrichment error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// POST /enrich-work - Enrich work by ISWC
app.post('/enrich-work', async (c) => {
  try {
    const body = await c.req.json<EnrichWorkRequest>();
    const { iswc, work_mbid, force_reauth } = body;

    if (!iswc) {
      return c.json({ error: 'iswc is required' }, 400);
    }

    console.log(`📝 Work enrichment: ISWC ${iswc}`);

    const result = await enrichWork(iswc, work_mbid, force_reauth);

    if (!result) {
      return c.json({ error: 'No work found for this ISWC' }, 404);
    }

    return c.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('Work enrichment error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Cleanup on shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 Shutting down...');
  if (browser) {
    await browser.close();
  }
  process.exit(0);
});

// Start server
const port = Number(process.env.PORT) || 3000;
console.log(`🚀 Quansic Enrichment Service running on port ${port}`);
console.log(`🌐 Playwright browser will be initialized on first auth request`);

export default {
  port,
  fetch: app.fetch,
};
