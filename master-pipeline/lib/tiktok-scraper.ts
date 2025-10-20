/**
 * Automated TikTok Music Page Scraper
 * Uses Playwright to extract segment URLs without manual browser interaction
 */

import { chromium } from 'playwright';

export interface TikTokSegmentResult {
  url: string;
  musicId: string;
  songName: string;
  artistName: string;
  segmentUrl: string;
  duration: number;
}

/**
 * Scrape TikTok music page to extract canonical segment URL
 * Runs headless browser automation
 *
 * @param tiktokUrl TikTok music page URL (e.g. https://www.tiktok.com/music/...)
 * @returns Segment URL and metadata
 */
export async function scrapeTikTokMusicPage(
  tiktokUrl: string
): Promise<TikTokSegmentResult> {
  console.log(`🔍 Scraping TikTok music page: ${tiktokUrl}`);

  // Parse URL
  const match = tiktokUrl.match(/\/music\/(.+?)-(\d+)/);
  if (!match) {
    throw new Error(`Invalid TikTok music URL: ${tiktokUrl}`);
  }

  const songName = match[1].replace(/%20/g, ' ').replace(/-/g, ' ');
  const musicId = match[2];

  // Launch headless browser
  console.log('🌐 Launching browser...');
  const browser = await chromium.launch({
    headless: true,
  });

  try {
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    const page = await context.newPage();

    // Navigate to TikTok music page
    console.log('📄 Loading page...');
    await page.goto(tiktokUrl, { waitUntil: 'networkidle', timeout: 30000 });

    // Wait for video element to load
    console.log('🎬 Waiting for video element...');
    await page.waitForSelector('video', { timeout: 10000 });

    // Extract video URL
    const segmentUrl = await page.evaluate(() => {
      const video = document.querySelector('video');
      return video ? video.src || video.currentSrc : null;
    });

    if (!segmentUrl) {
      throw new Error('Failed to extract video URL from page');
    }

    // Extract artist name from page title
    const pageTitle = await page.title();
    // Title format: "Artist - Song Name | TikTok"
    const artistMatch = pageTitle.match(/^(.+?)\s+-\s+/);
    const artistName = artistMatch ? artistMatch[1] : 'Unknown Artist';

    await browser.close();

    console.log(`✅ Found segment URL`);
    console.log(`   Artist: ${artistName}`);
    console.log(`   Song: ${songName}`);
    console.log(`   URL: ${segmentUrl}`);

    return {
      url: tiktokUrl,
      musicId,
      songName,
      artistName,
      segmentUrl,
      duration: 60, // Standard TikTok segment length
    };
  } catch (error) {
    await browser.close();
    throw error;
  }
}
