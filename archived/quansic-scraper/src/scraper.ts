import { chromium, type Browser, type Page, type BrowserContext } from 'playwright';
import chalk from 'chalk';
import type { Artist, Release, Recording, ArtistIdentifiers, NameVariant, ScraperConfig } from './types';
import { FileManager } from './utils/file-manager';

export class QuansicScraper {
  private browser?: Browser;
  private context?: BrowserContext;
  private fileManager: FileManager;
  private config: ScraperConfig;

  constructor(config: ScraperConfig) {
    this.config = {
      headless: true,
      debug: false,
      concurrency: 1,
      retryAttempts: 3,
      timeout: 30000,
      ...config
    };
    this.fileManager = new FileManager(config.outputDir);
  }

  async initialize(): Promise<void> {
    console.log(chalk.cyan('🚀 Initializing Quansic Scraper...'));
    
    await this.fileManager.ensureOutputDir();
    
    this.browser = await chromium.launch({
      headless: this.config.headless,
      args: ['--disable-blink-features=AutomationControlled']
    });

    // Try to load saved session state first
    const authStateFile = 'auth-state.json';
    try {
      const authState = JSON.parse(await Bun.file(authStateFile).text());
      this.context = await this.browser.newContext({
        viewport: { width: 1920, height: 1080 },
        storageState: authState
      });
      console.log(chalk.green('✅ Loaded authenticated session from auth-state.json'));
    } catch (error) {
      console.log(chalk.yellow('⚠️  No auth-state.json found, creating new context'));
      
      this.context = await this.browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });

      // Load cookies if provided (fallback)
      if (this.config.cookiesFile) {
        const cookies = await this.fileManager.loadCookies(this.config.cookiesFile);
        if (cookies.length > 0) {
          await this.context.addCookies(cookies);
          console.log(chalk.green(`✅ Loaded ${cookies.length} cookies`));
        }
      }
    }
  }

  async scrapeArtist(artistIdentifier: string): Promise<Artist | null> {
    const page = await this.context!.newPage();
    page.setDefaultTimeout(this.config.timeout!);
    
    try {
      // Determine URL format (could be ISNI, MusicBrainz ID, etc.)
      const url = this.buildArtistUrl(artistIdentifier);
      console.log(chalk.blue(`📋 Scraping artist: ${artistIdentifier}`));
      console.log(chalk.gray(`   URL: ${url}`));

      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: this.config.timeout });
      
      // Wait for Angular to load
      console.log(chalk.gray('   Waiting for Angular to load...'));
      await page.waitForTimeout(3000);
      
      // Try multiple selectors to detect if the page loaded
      const selectors = ['app-artist', 'app-party', '.entity-page', 'h2'];
      let hasContent = false;
      
      for (const selector of selectors) {
        const count = await page.locator(selector).count();
        if (count > 0) {
          console.log(chalk.gray(`   Found ${selector}: ${count} elements`));
          hasContent = true;
        }
      }
      
      if (!hasContent) {
        console.log(chalk.yellow(`⚠️  No content found for ${artistIdentifier}`));
        
        // Save screenshot for debugging
        if (this.config.debug) {
          await page.screenshot({ path: `output/debug/${artistIdentifier}_error.png` });
          const html = await page.content();
          console.log(chalk.gray('   HTML preview:', html.substring(0, 500)));
        }
        return null;
      }

      // Extract basic info - works with both app-artist and app-party
      const artist: Artist = {
        id: artistIdentifier,
        name: await this.extractText(page, '.name h2') || await this.extractText(page, 'h2') || artistIdentifier,
        type: 'Person',
        identifiers: await this.extractIdentifiers(page),
        alsoKnownAs: [],
        nameVariants: []
      };

      // Extract additional info - try both selector patterns
      artist.comments = await this.extractText(page, 'artist-comments em') || await this.extractText(page, '.comments em');
      artist.nationality = await this.extractInfoField(page, 'Nationality');
      artist.dateOfBirth = await this.extractInfoField(page, 'Date of Birth');
      artist.dateOfDeath = await this.extractInfoField(page, 'Date of Death');
      
      // Extract image - try multiple selectors
      const imageUrl = await page.locator('app-artist-cover img').getAttribute('src').catch(() => null) 
        || await page.locator('.cover img').getAttribute('src').catch(() => null);
      if (imageUrl && !imageUrl.includes('default')) {
        artist.image = imageUrl;
      }

      // Extract relationships
      artist.alsoKnownAs = await this.extractRelationships(page, 'Also Known As');
      artist.isMemberOf = await this.extractRelationships(page, 'Is Member Of');
      
      // Extract name variants
      artist.nameVariants = await this.extractNameVariants(page);

      // Save raw HTML for debugging
      if (this.config.debug) {
        const html = await page.content();
        await this.fileManager.saveRawHtml(html, artistIdentifier, 'artist');
      }

      // Now get releases and recordings
      artist.releases = await this.scrapeReleases(page, artistIdentifier);
      artist.recordings = await this.scrapeRecordings(page, artistIdentifier);

      return artist;

    } catch (error) {
      console.error(chalk.red(`❌ Error scraping artist ${artistIdentifier}:`), error);
      return null;
    } finally {
      await page.close();
    }
  }

  private async extractIdentifiers(page: Page): Promise<ArtistIdentifiers> {
    const identifiers: ArtistIdentifiers = {};

    const extractId = async (label: string): Promise<string | undefined> => {
      try {
        const element = await page.locator(`span:has-text("${label}")`).locator('..').locator('.identifier');
        const text = await element.textContent();
        // Remove "content_copy" and any "+N" suffix that appears from the copy button
        const cleaned = text?.trim().replace(/content_copy.*$/, '').trim();
        return cleaned || undefined;
      } catch {
        return undefined;
      }
    };

    const extractMultipleIds = async (label: string): Promise<string[] | undefined> => {
      try {
        const elements = await page.locator(`span:has-text("${label}")`).locator('..').locator('.identifier').all();
        const ids: string[] = [];
        for (const el of elements) {
          const text = await el.textContent();
          if (text) {
            // Remove "content_copy" and any "+N" suffix
            const cleaned = text.trim().replace(/content_copy.*$/, '').trim();
            if (cleaned) ids.push(cleaned);
          }
        }
        return ids.length > 0 ? ids : undefined;
      } catch {
        return undefined;
      }
    };

    identifiers.isni = await extractId('ISNI');
    identifiers.ipi = await extractMultipleIds('IPI');
    identifiers.ipn = await extractId('IPN');
    identifiers.discogsId = await extractMultipleIds('Discogs ID');
    identifiers.musicbrainzId = await extractId('MusicBrainz ID');
    identifiers.wikidataId = await extractId('Wikidata ID');
    identifiers.spotifyId = await extractId('Spotify ID');
    identifiers.appleId = await extractId('Apple ID');
    identifiers.deezerId = await extractId('Deezer ID');
    identifiers.amazonId = await extractMultipleIds('Amazon ID');

    return identifiers;
  }

  private async scrapeReleases(page: Page, artistId: string): Promise<Release[]> {
    console.log(chalk.cyan('   📀 Scraping releases...'));
    
    // Click on Releases tab
    await page.locator('div[role="tab"]:has-text("Releases")').click();
    await page.waitForTimeout(2000);

    const releases: Release[] = [];
    
    try {
      // Wait for the table to load
      await page.waitForSelector('mat-table', { timeout: 5000 });
      
      // Get all rows
      const rows = await page.locator('mat-row').all();
      
      for (const row of rows) {
        const release: Release = {
          upc: '',
          title: ''
        };

        // Extract UPC
        const upcElement = await row.locator('.cdk-column-upc .identifier');
        release.upc = await upcElement.textContent() || '';

        // Extract title
        const titleElement = await row.locator('.cdk-column-title a');
        release.title = await titleElement.textContent() || '';

        // Extract year
        const yearElement = await row.locator('.cdk-column-year');
        const year = await yearElement.textContent();
        if (year?.trim()) {
          release.year = year.trim();
        }

        // Extract type
        const typeElement = await row.locator('.cdk-column-type span');
        const type = await typeElement.textContent();
        if (type?.trim()) {
          release.type = type.trim();
        }

        // Extract visual/cover image
        const imgElement = await row.locator('.cdk-column-visual img');
        const imgSrc = await imgElement.getAttribute('src');
        if (imgSrc && !imgSrc.includes('default')) {
          release.visual = imgSrc;
        }

        if (release.upc) {
          releases.push(release);
        }
      }

      console.log(chalk.green(`   ✅ Found ${releases.length} releases`));
    } catch (error) {
      console.log(chalk.yellow('   ⚠️  Could not load releases'));
    }

    if (this.config.debug) {
      const html = await page.content();
      await this.fileManager.saveRawHtml(html, artistId, 'releases');
    }

    return releases;
  }

  private async scrapeRecordings(page: Page, artistId: string): Promise<Recording[]> {
    console.log(chalk.cyan('   🎵 Scraping recordings...'));
    
    // Click on Recordings tab
    try {
      await page.locator('div[role="tab"]:has-text("Recordings")').click();
    } catch {
      // Try alternative selector
      await page.locator('mat-tab-label:has-text("Recordings")').click();
    }
    
    await page.waitForTimeout(3000);

    const recordings: Recording[] = [];
    
    try {
      // Wait for the table to load
      await page.waitForSelector('mat-table', { timeout: 5000 });
      
      // Get all rows
      const rows = await page.locator('mat-row').all();
      
      for (const row of rows) {
        const recording: Recording = {
          isrc: '',
          title: ''
        };

        // Extract ISRC
        const isrcElement = await row.locator('.cdk-column-isrc .identifier');
        recording.isrc = await isrcElement.textContent() || '';

        // Extract title
        const titleElement = await row.locator('.cdk-column-title a');
        recording.title = await titleElement.textContent() || '';

        // Extract duration
        const durationElement = await row.locator('.cdk-column-duration');
        const duration = await durationElement.textContent();
        if (duration?.trim()) {
          recording.duration = duration.trim();
        }

        // Extract year
        const yearElement = await row.locator('.cdk-column-year');
        const year = await yearElement.textContent();
        if (year?.trim()) {
          recording.year = year.trim();
        }

        if (recording.isrc) {
          recordings.push(recording);
        }
      }

      console.log(chalk.green(`   ✅ Found ${recordings.length} recordings`));
    } catch (error) {
      console.log(chalk.yellow('   ⚠️  Could not load recordings'));
    }

    if (this.config.debug) {
      const html = await page.content();
      await this.fileManager.saveRawHtml(html, artistId, 'recordings');
    }

    return recordings;
  }

  private async extractRelationships(page: Page, relationshipType: string): Promise<string[]> {
    const relationships: string[] = [];
    try {
      const section = await page.locator(`div:has-text("${relationshipType}")`).first();
      const links = await section.locator('party-link a').all();
      
      for (const link of links) {
        const text = await link.textContent();
        if (text) relationships.push(text.trim());
      }
    } catch {
      // No relationships found
    }
    return relationships;
  }

  private async extractNameVariants(page: Page): Promise<NameVariant[]> {
    const variants: NameVariant[] = [];
    try {
      const section = await page.locator('namevariants .grid div').all();
      
      for (const element of section) {
        const text = await element.textContent();
        if (text) {
          const match = text.match(/^(.+?)(?:\s+\(([^)]+)\))?$/);
          if (match) {
            variants.push({
              name: match[1].trim(),
              language: match[2]?.trim()
            });
          }
        }
      }
    } catch {
      // No name variants found
    }
    return variants;
  }

  private async extractText(page: Page, selector: string): Promise<string | undefined> {
    try {
      const element = await page.locator(selector).first();
      const text = await element.textContent();
      return text?.trim();
    } catch {
      return undefined;
    }
  }

  private async extractInfoField(page: Page, fieldName: string): Promise<string | undefined> {
    try {
      const element = await page.locator(`span:has-text("${fieldName}")`).locator('..');
      const text = await element.textContent();
      const value = text?.replace(fieldName, '').trim();
      return value || undefined;
    } catch {
      return undefined;
    }
  }

  private buildArtistUrl(identifier: string): string {
    // Support different identifier formats
    if (identifier.startsWith('http')) {
      return identifier;
    } else if (identifier.match(/^\d{16}$/)) {
      // ISNI format
      return `https://explorer.quansic.com/app-party/Quansic::isni::${identifier}`;
    } else if (identifier.includes('::')) {
      // Already formatted
      return `https://explorer.quansic.com/app-party/${identifier}`;
    } else {
      // Default to ISNI
      return `https://explorer.quansic.com/app-party/Quansic::isni::${identifier}`;
    }
  }

  async scrapeArtists(artistIdentifiers: string[]): Promise<void> {
    const processed: string[] = [];
    const failed: string[] = [];

    for (const identifier of artistIdentifiers) {
      const artist = await this.scrapeArtist(identifier);
      
      if (artist) {
        await this.fileManager.saveArtist(artist);
        processed.push(identifier);
      } else {
        failed.push(identifier);
      }

      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    await this.fileManager.saveProgress(processed, failed);
    
    console.log(chalk.green('\n📊 Scraping complete!'));
    console.log(chalk.cyan(`   ✅ Processed: ${processed.length}`));
    console.log(chalk.yellow(`   ❌ Failed: ${failed.length}`));
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
    }
  }
}