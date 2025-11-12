/**
 * TikTok Scraper v3
 * HTML-first scraper with Playwright fallback for stubborn sessions.
 */

import { chromium, type Browser, type BrowserContext } from 'playwright';
import type { TikTokUserProfile, TikTokVideo } from '../types';
import { parseCookieFile, toPlaywrightCookies, type ParsedCookie } from '../utils/cookie-parser';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

export class TikTokScraper {
  private baseUrl = 'https://www.tiktok.com';
  private apiBase = 'https://www.tiktok.com/api';
  private browser: Browser | null = null;
  private cookieJar: ParsedCookie[] = [];

  constructor() {
    // Load cookies from file if available
    const cookieFilePath = this.resolveCookiePath();
    if (cookieFilePath && existsSync(cookieFilePath)) {
      const cookieFileContent = readFileSync(cookieFilePath, 'utf-8');
      const parsedCookies = parseCookieFile(cookieFileContent);
      if (parsedCookies.length > 0) {
        this.cookieJar = parsedCookies;
        console.log(`  📦 Loaded ${parsedCookies.length} cookies from ${cookieFilePath}`);
      }
    }
  }

  /**
   * Fetch profile + videos in ONE browser session.
   * Returns both profile and videos together to avoid opening browser twice.
   */
  async scrapeUser(username: string, maxVideos: number = Infinity): Promise<{
    profile: TikTokUserProfile | null;
    videos: TikTokVideo[];
  }> {
    const isHeadless = process.env.TIKTOK_HEADLESS !== 'false';
    let browser: Browser | null = null;

    try {
      console.log(`  🌐 Opening browser (${isHeadless ? 'headless' : 'visible'})...`);
      browser = await chromium.launch({
        headless: isHeadless,
        args: ['--disable-blink-features=AutomationControlled']
      });

      const context = await browser.newContext({ userAgent: this.buildUserAgent() });
      await this.applyCookieJar(context);

      // Anti-detection
      await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
        window.chrome = { runtime: {} };
      });

      const page = await context.newPage();
      const videos: TikTokVideo[] = [];
      let lastVideoCount = 0;

      // Intercept API responses
      page.on('response', async (response) => {
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
                    console.log(`  ✅ Captured ${videos.length} videos...`);
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

      console.log(`  🌐 Loading @${username}...`);
      try {
        await page.goto(`${this.baseUrl}/@${username}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000
        });
      } catch (error: any) {
        if (error.message?.includes('Timeout') && !isHeadless) {
          console.log('  ⏰ Page load timeout - CAPTCHA detected');
        } else if (error.message?.includes('Timeout')) {
          console.log('  ⚠️  Timeout (run with TIKTOK_HEADLESS=false to solve CAPTCHA)');
        } else {
          throw error;
        }
      }

      // Parse profile from HTML
      const html = await page.content();
      const profile = this.parseProfileFromHtml(html, username);

      // Wait for video API responses
      const initialWait = videos.length === 0 ? 10000 : 5000;
      console.log(`  ⏳ Waiting ${initialWait / 1000}s for API responses...`);
      await this.sleep(initialWait);

      // Extended wait for CAPTCHA solving
      if (videos.length === 0 && !isHeadless) {
        console.log('  🧩 No videos yet - solve CAPTCHA if present');
        console.log('  ⏳ Waiting up to 60s for CAPTCHA solve...');

        for (let i = 0; i < 6; i++) {
          await this.sleep(10000);
          if (videos.length > 0) {
            console.log(`  ✅ Videos captured! (${videos.length} so far)`);
            break;
          }
          console.log(`  ⏳ Still waiting... (${(i + 1) * 10}s, ${videos.length} videos)`);
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
      console.error('  ❌ Scraping failed:', error);
      return { profile: null, videos: [] };
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  /**
   * @deprecated Use scrapeUser() instead to avoid opening browser twice
   */
  async getUserProfile(username: string): Promise<TikTokUserProfile | null> {
    const { profile } = await this.scrapeUser(username, 0);
    return profile;
  }

  /**
   * @deprecated Use scrapeUser() instead to avoid opening browser twice
   */
  async getUserVideos(username: string, _secUid: string, maxVideos: number = Infinity): Promise<TikTokVideo[]> {
    const { videos } = await this.scrapeUser(username, maxVideos);
    return videos;
  }

  private parseProfileFromHtml(html: string, username: string): TikTokUserProfile | null {
    const secUidMatch = html.match(/"secUid":"([^\"]+)"/);
    if (!secUidMatch) {
      console.error('secUid not found in profile page');
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
        console.error('Failed to parse stats:', error);
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
    return resolve(process.cwd(), 'www.tiktok.com_cookies.txt');
  }

  private async applyCookieJar(context: BrowserContext): Promise<void> {
    if (!this.cookieJar.length) {
      return;
    }

    try {
      const cookies = toPlaywrightCookies(this.cookieJar);
      await context.addCookies(cookies);
    } catch (error) {
      console.warn('  ⚠️ Failed to apply cookie jar to browser context:', error);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
