/**
 * BMI Songview Scraper Service
 *
 * Provides HTTP API for:
 * - Searching BMI Songview by title + performer
 * - Searching by ISWC
 * - Extracting work metadata (ISWC, writers, publishers, performers, work IDs)
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { chromium, Browser, BrowserContext, Page } from 'playwright';

const app = new Hono();

// Global state
let browser: Browser | null = null;
let browserContext: BrowserContext | null = null;
let contextExpiryTime: number = 0;  // Timestamp when context needs refresh
const CONTEXT_TTL_MS = 10 * 60 * 1000;  // 10 minutes - refresh before cookies expire

interface BMIWriter {
  name: string;
  affiliation: string;
  ipi: string;
}

interface BMIPublisher {
  name: string;
  affiliation: string;
  ipi: string;
  parent_publisher?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
}

interface BMIWorkData {
  title: string;
  iswc: string;
  bmi_work_id: string;
  ascap_work_id: string;
  writers: BMIWriter[];
  publishers: BMIPublisher[];
  performers: string[];
  shares: Record<string, string>;
  status: 'RECONCILED' | 'UNDER_REVIEW' | null;
  status_description?: string | null;
}

interface SearchByTitleRequest {
  title: string;
  performer?: string;
}

interface SearchByISWCRequest {
  iswc: string;
}

/**
 * Initialize Playwright browser and persistent context
 * Context is reused across requests so cookies/session persist
 * Only creates new context if previous one expired
 */
async function getContext(): Promise<BrowserContext> {
  // Check if we need to refresh the context
  const now = Date.now();
  if (browserContext && now < contextExpiryTime) {
    console.log('♻️ Reusing existing browser context (cookies persist)');
    return browserContext;
  }

  // Context expired or doesn't exist - create new one
  if (!browser) {
    console.log('🌐 Launching Playwright browser...');
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
  }

  // Close old context if it exists
  if (browserContext) {
    console.log('🔄 Refreshing browser context (cookies expired)');
    await browserContext.close();
  }

  // Create fresh context with 10 minute TTL
  browserContext = await browser.newContext();
  contextExpiryTime = Date.now() + CONTEXT_TTL_MS;
  console.log('✅ Created new persistent browser context');

  return browserContext;
}

/**
 * Clean title (remove BMI prefixes and normalize whitespace)
 */
function cleanTitle(title: string): string {
  if (!title) return '';

  // Remove "BMI AWARD WINNING" prefixes
  let cleaned = title.replace(/BMI Award Winning Song\s*/gi, '');
  cleaned = cleaned.replace(/BMI Award Winning\s*/gi, '');

  // Normalize whitespace (including newlines)
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}

/**
 * Normalize text for comparison (remove special chars, common words)
 */
function normalizeText(text: string): string {
  if (!text) return '';

  let normalized = text.toUpperCase();

  // Remove "BMI AWARD WINNING" prefixes
  const prefixes = ['BMI AWARD WINNING SONG', 'BMI AWARD WINNING'];
  for (const prefix of prefixes) {
    normalized = normalized.replace(prefix, '').trim();
  }

  // Remove special characters and extra spaces
  normalized = normalized.replace(/[^\w\s]/g, ' ');
  normalized = normalized.replace(/\s+/g, ' ').trim();

  // Remove common words
  const commonWords = new Set(['THE', 'A', 'AN', 'AND', 'OR', 'BUT', 'IN', 'ON', 'AT', 'TO', 'FOR', 'OF', 'WITH', 'BY']);
  const words = normalized.split(' ').filter(w => !commonWords.has(w));

  return words.join(' ');
}

/**
 * Check if two texts match after normalization
 */
function textsMatch(text1: string, text2: string): boolean {
  const norm1 = normalizeText(text1);
  const norm2 = normalizeText(text2);

  if (norm1 === norm2) return true;
  if (norm1.startsWith(norm2) || norm2.startsWith(norm1)) return true;

  return false;
}

/**
 * Check if search artist matches any performer
 */
function artistsMatch(searchArtist: string, performers: string[]): boolean {
  if (!searchArtist || !performers.length) return false;

  const searchNorm = normalizeText(searchArtist);
  const searchParts = new Set(searchNorm.split(' '));

  for (const performer of performers) {
    const perfNorm = normalizeText(performer);
    const perfParts = new Set(perfNorm.split(' '));

    // Match if any significant words overlap
    const overlap = [...searchParts].filter(p => perfParts.has(p));
    if (overlap.length > 0) return true;
  }

  return false;
}

/**
 * Search BMI Songview by title and optional performer
 * Uses persistent browser context so cookies/session are remembered
 */
async function searchByTitle(title: string, performer?: string): Promise<BMIWorkData | null> {
  const context = await getContext();  // Reuses context, not creating new one
  const page = await context.newPage();  // New page within persistent context

  try {
    console.log(`🔍 Searching BMI for: "${title}"${performer ? ` by ${performer}` : ''}`);

    // Construct search URL
    let searchUrl = `https://repertoire.bmi.com/Search/Search?Main_Search_Text=${encodeURIComponent(title.toLowerCase())}`;
    searchUrl += '&Main_Search=Title';
    if (performer) {
      searchUrl += `&Sub_Search_Text=${encodeURIComponent(performer.toLowerCase())}`;
      searchUrl += '&Sub_Search=Performer';
    }
    searchUrl += '&Search_Type=all&View_Count=0&Page_Number=0';

    console.log(`📍 URL: ${searchUrl}`);

    // Navigate
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Handle disclaimer if redirected - cookies remember this, so only needed first time
    if (page.url().includes('Disclaimer')) {
      console.log('📝 Accepting disclaimer (first time in context)...');
      const acceptBtn = await page.waitForSelector('#btnAccept', { timeout: 10000 });
      if (acceptBtn) {
        await acceptBtn.click();
        await page.waitForLoadState('networkidle');
      }
    }

    // Wait for results
    try {
      await page.waitForSelector('#sticky-header-table', { timeout: 10000 });
      await page.waitForSelector('.result-list', { timeout: 10000 });
    } catch (e) {
      console.log('❌ No results found');
      return null;
    }

    // Find all result rows
    const resultRows = await page.locator('.result-list > ul > li').all();
    console.log(`📋 Found ${resultRows.length} results`);

    if (resultRows.length === 0) return null;

    // Find the best matching row
    let selectedRow = null;

    for (let i = 0; i < resultRows.length; i++) {
      const row = resultRows[i];

      const titleElem = row.locator('.song-title');
      const performersList = row.locator('td:nth-child(5) ul');

      const titleCount = await titleElem.count();
      const perfCount = await performersList.count();

      if (titleCount === 0 || perfCount === 0) {
        console.log(`⚠️ Row ${i + 1}: Missing title or performers`);
        continue;
      }

      const rowTitle = await titleElem.innerText();
      const performerItems = await performersList.locator('li').all();
      const performers: string[] = [];
      for (const item of performerItems) {
        performers.push(await item.innerText());
      }

      console.log(`📄 Row ${i + 1}: "${rowTitle}"`);
      console.log(`  🎤 Performers: ${performers.join(', ')}`);

      // Check if titles match
      const titleMatches = textsMatch(rowTitle, title);
      console.log(`  ✓ Title match: ${titleMatches}`);

      if (titleMatches) {
        if (!performer) {
          selectedRow = row;
          console.log(`✅ Selected row ${i + 1} (no performer filter)`);
          break;
        } else {
          const artistMatches = artistsMatch(performer, performers);
          console.log(`  ✓ Artist match: ${artistMatches}`);
          if (artistMatches) {
            selectedRow = row;
            console.log(`✅ Selected row ${i + 1}`);
            break;
          }
        }
      }
    }

    if (!selectedRow) {
      console.log('❌ No matching version found');
      return null;
    }

    // Click the opener to expand details
    const opener = selectedRow.locator('.opener');
    if (await opener.count() > 0) {
      await opener.click();
      console.log('🔽 Expanded details');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
    } else {
      console.log('❌ No opener found');
      return null;
    }

    // Parse the details
    const details = selectedRow.locator('.details-slide');
    if (await details.count() === 0) {
      console.log('❌ No details section');
      return null;
    }

    const result = await parseWorkDetails(page, details);

    // Add title from row if not in details
    if (!result.title) {
      const titleElem = selectedRow.locator('.song-title');
      if (await titleElem.count() > 0) {
        result.title = cleanTitle(await titleElem.innerText());
      }
    }

    return result;

  } catch (error: any) {
    console.error('❌ Search error:', error.message);
    return null;
  } finally {
    await page.close();  // Close page only, context stays open (cookies persist)
  }
}

/**
 * Search BMI Songview by ISWC
 * Uses persistent browser context so cookies/session are remembered
 */
async function searchByISWC(iswc: string): Promise<BMIWorkData | null> {
  const context = await getContext();  // Reuses context, not creating new one
  const page = await context.newPage();  // New page within persistent context

  try {
    console.log(`🔍 Searching BMI by ISWC: ${iswc}`);

    // Construct search URL
    let searchUrl = `https://repertoire.bmi.com/Search/Search?Main_Search_Text=${encodeURIComponent(iswc)}`;
    searchUrl += '&Main_Search=ISWC';
    searchUrl += '&Sub_Search=Please%20Select';
    searchUrl += '&Search_Type=all&View_Count=0&Page_Number=0';

    // Navigate
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Handle disclaimer if redirected - cookies remember this, so only needed first time
    if (page.url().includes('Disclaimer')) {
      console.log('📝 Accepting disclaimer (first time in context)...');
      const acceptBtn = await page.waitForSelector('#btnAccept', { timeout: 10000 });
      if (acceptBtn) {
        await acceptBtn.click();
        await page.waitForLoadState('networkidle');
      }
    }

    // Wait for results
    try {
      await page.waitForSelector('#sticky-header-table', { timeout: 10000 });
      await page.waitForSelector('.result-list', { timeout: 10000 });
    } catch (e) {
      console.log('❌ ISWC not found');
      return null;
    }

    const resultRows = await page.locator('.result-list > ul > li').all();
    if (resultRows.length === 0) return null;

    // For ISWC search, use first result (should be exact match)
    const selectedRow = resultRows[0];
    console.log('✅ Found ISWC match');

    // Expand details
    const opener = selectedRow.locator('.opener');
    if (await opener.count() > 0) {
      await opener.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
    } else {
      return null;
    }

    const details = selectedRow.locator('.details-slide');
    if (await details.count() === 0) return null;

    const result = await parseWorkDetails(page, details);

    // Add title from row
    const titleElem = selectedRow.locator('.song-title');
    if (await titleElem.count() > 0) {
      result.title = cleanTitle(await titleElem.innerText());
    }

    return result;

  } catch (error: any) {
    console.error('❌ ISWC search error:', error.message);
    return null;
  } finally {
    await page.close();  // Close page only, context stays open (cookies persist)
  }
}

/**
 * Parse work details from expanded section
 */
async function parseWorkDetails(page: Page, details: any): Promise<BMIWorkData> {
  const result: BMIWorkData = {
    title: '',
    iswc: '',
    bmi_work_id: '',
    ascap_work_id: '',
    writers: [],
    publishers: [],
    performers: [],
    shares: {},
    status: null,
    status_description: null
  };

  // Get ISWC
  const iswcRow = details.locator('table:has-text("ISWC") tr.soc-details-row');
  if (await iswcRow.count() > 0) {
    result.iswc = (await iswcRow.innerText()).trim();
    console.log(`  📋 ISWC: ${result.iswc}`);
  }

  // Get work IDs and shares
  const workRows = await details.locator('tr.soc-details-row').all();
  for (const row of workRows) {
    const rowText = await row.innerText();
    const cells = rowText.split('\t');

    if (cells.length >= 4 && cells[3].trim()) {
      if (cells[0].includes('BMI')) {
        result.bmi_work_id = cells[3].trim();
        console.log(`  🆔 BMI Work ID: ${result.bmi_work_id}`);
      } else if (cells[0].includes('ASCAP')) {
        result.ascap_work_id = cells[3].trim();
        console.log(`  🆔 ASCAP Work ID: ${result.ascap_work_id}`);
      }
    }

    if (cells.length >= 2 && cells[1].includes('%')) {
      result.shares[cells[0].trim()] = cells[1].trim();
    }
  }

  // Get writers
  const writersTable = details.locator('.details-content-block-03:has-text("Writers / Composers") table');
  if (await writersTable.count() > 0) {
    const writerRows = await writersTable.locator('tbody tr').all();
    for (const row of writerRows) {
      const cells = await row.locator('td').all();
      if (cells.length >= 3) {
        const name = await cells[0].innerText();
        const affiliation = await cells[1].innerText();
        const ipi = await cells[2].innerText();
        result.writers.push({
          name: name.trim(),
          affiliation: affiliation.trim(),
          ipi: ipi.trim()
        });
      }
    }
    console.log(`  ✍️ Writers: ${result.writers.length}`);
  }

  // Get publishers
  const publishersTable = details.locator('.details-content-block-03:has-text("Publishers") table.style-01');
  if (await publishersTable.count() > 0) {
    const pubRows = await publishersTable.locator('tbody tr').all();
    for (const row of pubRows) {
      const nameCell = row.locator('td .e-header');
      if (await nameCell.count() === 0) continue;

      const nameElem = nameCell.locator('a.expander');
      if (await nameElem.count() === 0) continue;

      const name = await nameElem.innerText();
      const cells = await row.locator('td').all();

      if (cells.length >= 3) {
        const affiliation = await cells[1].innerText();
        const ipi = await cells[2].innerText();

        result.publishers.push({
          name: name.trim(),
          affiliation: affiliation.trim(),
          ipi: ipi.trim()
        });
      }
    }
    console.log(`  🏢 Publishers: ${result.publishers.length}`);
  }

  // Get performers
  const performersBlock = details.locator('.details-content-block-03:has-text("Performers")');
  if (await performersBlock.count() > 0) {
    const performerItems = await performersBlock.locator('ul.items-list li').all();
    for (const item of performerItems) {
      const performer = await item.innerText();
      result.performers.push(performer.trim());
    }
    console.log(`  🎤 Performers: ${result.performers.length}`);
  }

  // Try to get status
  try {
    const statusBtn = details.locator('.button-status');
    if (await statusBtn.count() > 0) {
      const statusText = await statusBtn.innerText();
      if (statusText.includes('Reconciled')) {
        result.status = 'RECONCILED';
      } else if (statusText.includes('Under Review')) {
        result.status = 'UNDER_REVIEW';
      }
      console.log(`  📊 Status: ${result.status}`);
    }
  } catch (e) {
    // Status not critical
  }

  return result;
}

// Middleware
app.use('*', cors());

// Routes
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    uptime: process.uptime(),
    service: 'bmi-songview-service',
    version: '1.0.0'
  });
});

app.post('/search/title', async (c) => {
  try {
    const body = await c.req.json<SearchByTitleRequest>();
    const { title, performer } = body;

    if (!title) {
      return c.json({ error: 'title is required' }, 400);
    }

    const result = await searchByTitle(title, performer);

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

app.post('/search/iswc', async (c) => {
  try {
    const body = await c.req.json<SearchByISWCRequest>();
    const { iswc } = body;

    if (!iswc) {
      return c.json({ error: 'iswc is required' }, 400);
    }

    const result = await searchByISWC(iswc);

    if (!result) {
      return c.json({ error: 'ISWC not found' }, 404);
    }

    return c.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('ISWC search error:', error);
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
console.log(`🚀 BMI Songview Service running on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};
