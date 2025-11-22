#!/usr/bin/env bun
/**
 * Batch TikTok Scraper v2 (Stealth Edition)
 * Scrapes multiple creators from CSV in a single browser session with stealth to minimize CAPTCHAs
 *
 * Usage:
 *   bun src/scripts/batch-scrape-tiktok.ts ../tiktoks_to_scrape.csv [maxVideosPerCreator]
 *   TIKTOK_HEADLESS=false bun src/scripts/batch-scrape-tiktok.ts ../tiktoks_to_scrape.csv 10
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { chromium } from 'playwright-extra';
import type { Browser, BrowserContext } from 'playwright';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { parseCookieFile, toPlaywrightCookies, type ParsedCookie } from '../utils/cookie-parser';
import type { TikTokUserProfile, TikTokVideo } from '../types';
import { upsertCreatorSQL, upsertVideoSQL, convertTikTokVideo } from '../db/tiktok';
import { query } from '../db/connection';
import { ensureCreatorAvatarCached } from '../lib/avatar-cache';

// Enable stealth plugin
chromium.use(StealthPlugin());

const DELAY_BETWEEN_CREATORS = 5000; // 5 seconds between creators (more human-like)
const PAGE_LOAD_TIMEOUT = 60000; // 60 seconds
const API_WAIT_TIME = 12000; // 12 seconds to wait for API responses (increased)
const RANDOM_DELAY_MAX = 2000; // Random delay up to 2 seconds

class BatchTikTokScraper {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: any = null; // Reuse same page for all creators
  private cookieJar: ParsedCookie[] = [];

  constructor() {
    // Load cookies from file if available
    const cookieFilePath = this.resolveCookiePath();
    if (cookieFilePath && existsSync(cookieFilePath)) {
      const cookieFileContent = readFileSync(cookieFilePath, 'utf-8');
      const parsedCookies = parseCookieFile(cookieFileContent);
      if (parsedCookies.length > 0) {
        this.cookieJar = parsedCookies;
        console.log(`📦 Loaded ${parsedCookies.length} cookies from ${cookieFilePath}`);
      }
    }
  }

  async init() {
    const isHeadless = process.env.TIKTOK_HEADLESS !== 'false';
    console.log(`🌐 Opening browser with enhanced stealth (${isHeadless ? 'headless' : 'visible'})...`);

    this.browser = await chromium.launch({
      headless: isHeadless,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-site-isolation-trials',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--start-maximized',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    });

    this.context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'en-US',
      timezoneId: 'America/New_York',
      permissions: ['geolocation', 'notifications'],
      colorScheme: 'light',
      deviceScaleFactor: 1,
      hasTouch: false,
      isMobile: false,
      javaScriptEnabled: true,
      bypassCSP: true,
      ignoreHTTPSErrors: true,
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Cache-Control': 'max-age=0',
        'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-User': '?1',
        'Sec-Fetch-Dest': 'document',
        'Upgrade-Insecure-Requests': '1',
        'DNT': '1',
        'Connection': 'keep-alive'
      }
    });

    await this.applyCookieJar();

    // Create single page that will be reused
    this.page = await this.context.newPage();

    // Additional stealth: Add custom JavaScript to mask automation
    await this.page.addInitScript(() => {
      // Override the permissions API
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters: any) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: 'denied' } as PermissionStatus) :
          originalQuery(parameters)
      );

      // Mock WebGL vendor and renderer
      const getParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function(parameter) {
        if (parameter === 37445) return 'Intel Inc.';
        if (parameter === 37446) return 'Intel Iris OpenGL Engine';
        return getParameter.call(this, parameter);
      };

      // Add realistic plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => [
          { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
          { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
          { name: 'Native Client', filename: 'internal-nacl-plugin' }
        ]
      });

      // Add realistic language
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en']
      });

      // Mock battery API
      Object.defineProperty(navigator, 'getBattery', {
        value: () => Promise.resolve({
          charging: true,
          chargingTime: 0,
          dischargingTime: Infinity,
          level: 1
        })
      });
    });

    console.log('✅ Browser initialized with enhanced stealth mode');
  }

  async scrapeCreator(username: string, maxVideos: number = Infinity): Promise<{
    profile: TikTokUserProfile | null;
    videos: TikTokVideo[];
  }> {
    if (!this.context || !this.page) {
      throw new Error('Browser not initialized. Call init() first.');
    }

    const videos: TikTokVideo[] = [];
    let lastVideoCount = 0;

    // Remove old response listeners
    this.page.removeAllListeners('response');

    try {
      // Intercept API responses
      this.page.on('response', async (response: any) => {
        const url = response.url();
        if (url.includes('/api/post/item_list')) {
          try {
            const text = await response.text();
            if (text && text.length > 100) {
              const data = JSON.parse(text);
              if (data.itemList && Array.isArray(data.itemList)) {
                for (const item of data.itemList) {
                  videos.push(this.normalizeVideo(item));
                  if (videos.length > lastVideoCount) {
                    console.log(`    ✅ Captured ${videos.length} videos...`);
                    lastVideoCount = videos.length;
                  }
                  if (videos.length >= maxVideos) break;
                }
              }
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      });

      // Add random delay before navigation (human-like behavior)
      const randomDelay = Math.floor(Math.random() * RANDOM_DELAY_MAX);
      if (randomDelay > 0) {
        await this.sleep(randomDelay);
      }

      // Clear previous page state (but keep cookies) - wrap in try/catch
      try {
        await this.page.evaluate(() => {
          try {
            localStorage.clear();
            sessionStorage.clear();
          } catch (e) {
            // Ignore if storage not accessible
          }
        });
      } catch (e) {
        // Page might not be loaded yet, skip storage clear
      }

      console.log(`  🌐 Loading @${username}...`);
      try {
        // Navigate with referer to look like clicking from TikTok homepage
        await this.page.goto(`https://www.tiktok.com/@${username}`, {
          waitUntil: 'networkidle',
          timeout: PAGE_LOAD_TIMEOUT,
          referer: 'https://www.tiktok.com/'
        });

        // Wait a bit for dynamic content
        await this.sleep(1000 + Math.floor(Math.random() * 1000));

        // Simulate human behavior: random mouse movement
        await this.page.mouse.move(
          Math.floor(Math.random() * 1920),
          Math.floor(Math.random() * 1080)
        );

        // Small delay
        await this.sleep(300 + Math.floor(Math.random() * 500));

        // Random scroll
        await this.page.evaluate(() => {
          window.scrollBy(0, Math.floor(Math.random() * 500));
        });

        // Another small delay
        await this.sleep(200 + Math.floor(Math.random() * 300));

      } catch (error: any) {
        if (error.message?.includes('Timeout')) {
          console.log('    ⏰ Page load timeout - may need CAPTCHA');
        } else {
          throw error;
        }
      }

      // Parse profile from HTML
      const html = await this.page.content();
      const profile = this.parseProfileFromHtml(html, username);

      // Infinite scroll to load ALL videos
      console.log(`  📜 Scrolling to load all videos...`);
      let previousVideoCount = 0;
      let noNewVideosCount = 0;
      const maxScrollAttempts = 50; // Prevent infinite loops
      let scrollAttempt = 0;

      while (scrollAttempt < maxScrollAttempts && (maxVideos === Infinity || videos.length < maxVideos)) {
        // Scroll to bottom
        await this.page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight);
        });

        // Wait for new videos to load
        await this.sleep(2000 + Math.floor(Math.random() * 1000));

        // Check if we got new videos
        if (videos.length === previousVideoCount) {
          noNewVideosCount++;
          console.log(`    ⏳ No new videos (${noNewVideosCount}/3)...`);

          // If no new videos after 3 attempts, we've reached the end
          if (noNewVideosCount >= 3) {
            console.log(`    ✅ Reached end of videos`);
            break;
          }
        } else {
          noNewVideosCount = 0; // Reset counter when we get new videos
          previousVideoCount = videos.length;
        }

        scrollAttempt++;
      }

      // Final wait for any remaining API responses
      console.log(`  ⏳ Waiting ${API_WAIT_TIME / 1000}s for final API responses...`);
      await this.sleep(API_WAIT_TIME);

      // Extended wait if no videos captured (possible CAPTCHA)
      if (videos.length === 0 && process.env.TIKTOK_HEADLESS === 'false') {
        console.log('  🧩 No videos yet - solve CAPTCHA if present');
        console.log('  ⏳ Waiting up to 60s for CAPTCHA solve...');

        for (let i = 0; i < 6; i++) {
          await this.sleep(10000);
          if (videos.length > 0) {
            console.log(`    ✅ Videos captured! (${videos.length} so far)`);
            break;
          }
          console.log(`    ⏳ Still waiting... (${(i + 1) * 10}s)`);
        }

        if (videos.length > 0) {
          console.log('  ⏳ Waiting 10s for additional videos...');
          await this.sleep(10000);
        }
      }

      return {
        profile,
        videos: videos.slice(0, maxVideos)
      };
    } catch (error) {
      console.error(`    ❌ Scraping error:`, error);
      return {
        profile: null,
        videos: []
      };
    }
    // Don't close page - reuse it for next creator
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
    }
  }

  private parseProfileFromHtml(html: string, username: string): TikTokUserProfile | null {
    const secUidMatch = html.match(/"secUid":"([^\"]+)"/);
    if (!secUidMatch) {
      console.error('    ⚠️  secUid not found in profile page');
      return null;
    }

    const userIdMatch = html.match(/"id":"(\d+)"/);
    const nicknameMatch = html.match(/"nickname":"([^\"]+)"/);
    const bioMatch = html.match(/"signature":"([^\"]*)"/);
    const avatarMatch = html.match(/"avatarMedium":"([^\"]+)"/);
    const statsMatch = html.match(/"stats":\s*({[^}]+})/);

    let stats = {
      followerCount: 0,
      followingCount: 0,
      videoCount: 0,
    };

    if (statsMatch) {
      try {
        const parsedStats = JSON.parse(statsMatch[1]);
        stats = {
          followerCount: parsedStats.followerCount || 0,
          followingCount: parsedStats.followingCount || 0,
          videoCount: parsedStats.videoCount || 0,
        };
      } catch (error) {
        console.error('    ⚠️  Failed to parse stats:', error);
      }
    }

    return {
      username,
      secUid: secUidMatch[1],
      userId: userIdMatch ? userIdMatch[1] : '',
      nickname: nicknameMatch ? nicknameMatch[1] : username,
      bio: bioMatch ? bioMatch[1] : '',
      avatar: avatarMatch ? avatarMatch[1] : null,
      stats,
    };
  }

  private normalizeVideo(item: any): TikTokVideo {
    const safeNumber = (value: unknown): number => {
      if (typeof value === 'number') return value;
      if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
      }
      return 0;
    };

    return {
      id: item?.id?.toString() ?? '',
      desc: item?.desc ?? '',
      createTime: safeNumber(item?.createTime),
      video: {
        playAddr: item?.video?.playAddr ?? '',
        downloadAddr: item?.video?.downloadAddr ?? '',
        cover: item?.video?.cover ?? '',
        duration: safeNumber(item?.video?.duration),
      },
      author: {
        id: item?.author?.id?.toString() ?? '',
        uniqueId: item?.author?.uniqueId ?? '',
        nickname: item?.author?.nickname ?? '',
      },
      music: {
        title: item?.music?.title ?? '',
        authorName: item?.music?.authorName,
        playUrl: item?.music?.playUrl,
        coverMedium: item?.music?.coverMedium,
        isCopyrighted: item?.music?.isCopyrighted,
        original: item?.music?.original,
        tt2dsp: item?.music?.tt2dsp,
      },
      stats: {
        playCount: safeNumber(item?.stats?.playCount),
        shareCount: safeNumber(item?.stats?.shareCount),
        commentCount: safeNumber(item?.stats?.commentCount),
        diggCount: safeNumber(item?.stats?.diggCount),
      },
    };
  }

  private buildUserAgent(): string {
    return 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  }

  private resolveCookiePath(): string | null {
    const override = process.env.TIKTOK_COOKIE_FILE?.trim();
    if (override && override.length > 0) {
      return resolve(process.cwd(), override);
    }
    const defaultPath = resolve(process.cwd(), 'www.tiktok.com_cookies.txt');
    return existsSync(defaultPath) ? defaultPath : null;
  }

  private async applyCookieJar(): Promise<void> {
    if (!this.context || !this.cookieJar.length) {
      return;
    }

    try {
      const cookies = toPlaywrightCookies(this.cookieJar);
      await this.context.addCookies(cookies);
    } catch (error) {
      console.warn('  ⚠️  Failed to apply cookie jar to browser context:', error);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: bun src/scripts/batch-scrape-tiktok.ts <csv_file> [maxVideosPerCreator]');
    console.error('Example: bun src/scripts/batch-scrape-tiktok.ts ../tiktoks_to_scrape.csv 10');
    process.exit(1);
  }

  const csvPath = resolve(args[0]);
  const maxVideosPerCreator = args[1] ? parseInt(args[1]) : Infinity;

  // Read usernames from CSV
  const csvContent = readFileSync(csvPath, 'utf-8');
  const usernames = csvContent
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.includes('non english')) // Skip comments
    .map(line => line.replace(/^@/, '')); // Remove @ if present

  console.log(`📋 Found ${usernames.length} creators to scrape`);
  console.log(`🎯 Max videos per creator: ${maxVideosPerCreator === Infinity ? 'all' : maxVideosPerCreator}`);
  console.log('');

  const scraper = new BatchTikTokScraper();
  await scraper.init();

  let successCount = 0;
  let failCount = 0;
  let totalVideos = 0;

  for (let i = 0; i < usernames.length; i++) {
    const username = usernames[i];
    console.log(`\n[${i + 1}/${usernames.length}] 🎯 Scraping @${username}...`);

    try {
      // Scrape creator
      const { profile, videos } = await scraper.scrapeCreator(username, maxVideosPerCreator);

      if (!profile) {
        console.log(`  ❌ Failed to fetch profile for @${username}`);
        failCount++;
        continue;
      }

      console.log(`  ✅ Profile: ${profile.nickname} (@${profile.username})`);
      console.log(`     - Followers: ${profile.stats.followerCount.toLocaleString()}`);
      console.log(`     - Videos: ${profile.stats.videoCount.toLocaleString()}`);
      console.log(`  ✅ Captured: ${videos.length} videos`);

      // Cache avatar
      console.log('  🖼️  Caching avatar...');
      const [existingCreator] = await query<{
        avatar_url: string | null;
        avatar_source_url: string | null;
        avatar_uploaded_at: string | null;
      }>(`SELECT avatar_url, avatar_source_url, avatar_uploaded_at FROM tiktok_creators WHERE username = $1 LIMIT 1`, [username]);

      const avatarResult = await ensureCreatorAvatarCached({
        username,
        sourceUrl: profile.avatar,
        existingAvatarUrl: existingCreator?.avatar_url || null,
        existingSourceUrl: existingCreator?.avatar_source_url || null,
        existingUploadedAt: existingCreator?.avatar_uploaded_at || null,
      });

      if (avatarResult.avatarUrl) {
        profile.avatar = avatarResult.avatarUrl;
      } else if (existingCreator?.avatar_url) {
        profile.avatar = existingCreator.avatar_url;
      } else {
        profile.avatar = null;
      }

      if (avatarResult.uploaded) {
        console.log(`     ✓ Uploaded new avatar → ${avatarResult.avatarUrl}`);
      } else if (avatarResult.avatarUrl) {
        console.log('     ✓ Reusing cached Grove avatar');
      }

      // Store creator in DB
      console.log('  💾 Storing creator...');
      const creatorSQL = upsertCreatorSQL(profile, {
        avatarSourceUrl: avatarResult.avatarSourceUrl,
        avatarUploadedAt: avatarResult.avatarUploadedAt,
      });
      await query(creatorSQL);
      console.log(`  ✅ Creator stored`);

      // Store videos in DB
      if (videos.length > 0) {
        console.log('  💾 Storing videos...');
        for (const video of videos) {
          const convertedVideo = convertTikTokVideo(video, username);
          const videoSQL = upsertVideoSQL(convertedVideo);
          await query(videoSQL);
        }
        console.log(`  ✅ Stored ${videos.length} videos`);
        totalVideos += videos.length;
      }

      successCount++;

      // Delay between creators (except last one)
      if (i < usernames.length - 1) {
        console.log(`  ⏳ Waiting ${DELAY_BETWEEN_CREATORS / 1000}s before next creator...`);
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_CREATORS));
      }
    } catch (error) {
      console.error(`  ❌ Failed to scrape @${username}:`, error);
      failCount++;
    }
  }

  await scraper.close();

  console.log('\n📊 Summary:');
  console.log(`   - Total creators: ${usernames.length}`);
  console.log(`   - Successful: ${successCount}`);
  console.log(`   - Failed: ${failCount}`);
  console.log(`   - Total videos: ${totalVideos}`);
  console.log('\n✅ Batch scraping complete!');
  console.log('\n💡 Next steps:');
  console.log('   1. Upload videos to Grove: bun src/tasks/tiktok/upload-grove.ts --limit=100');
  console.log('   2. Check status: SELECT COUNT(*) FROM tiktok_videos WHERE grove_video_url IS NULL;');
}

main()
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });

function existsSync(path: string): boolean {
  try {
    readFileSync(path);
    return true;
  } catch {
    return false;
  }
}
