/**
 * TikTok Scraper v2
 * Fetches user profile and videos using TikTok's public API
 * Now with database integration
 */

import type { TikTokUserProfile, TikTokVideo, TikTokAPIResponse } from '../types';

export class TikTokScraper {
  private baseUrl = 'https://www.tiktok.com';
  private apiBase = 'https://www.tiktok.com/api';

  /**
   * Fetch user profile information
   */
  async getUserProfile(username: string): Promise<TikTokUserProfile | null> {
    try {
      const url = `${this.baseUrl}/@${username}`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
      });

      if (!response.ok) {
        console.error(`Failed to fetch profile: HTTP ${response.status}`);
        return null;
      }

      const html = await response.text();

      // Extract secUid (required for API calls)
      const secUidMatch = html.match(/"secUid":"([^"]+)"/);
      if (!secUidMatch) {
        console.error('secUid not found in profile page');
        return null;
      }

      const secUid = secUidMatch[1];

      // Extract user ID
      const userIdMatch = html.match(/"id":"(\d+)"/);
      const userId = userIdMatch ? userIdMatch[1] : '';

      // Extract nickname
      const nicknameMatch = html.match(/"nickname":"([^"]+)"/);
      const nickname = nicknameMatch ? nicknameMatch[1] : username;

      // Extract bio
      const bioMatch = html.match(/"signature":"([^"]+)"/);
      const bio = bioMatch ? bioMatch[1] : '';

      // Extract avatar
      const avatarMatch = html.match(/"avatarMedium":"([^"]+)"/);
      const avatar = avatarMatch ? avatarMatch[1] : '';

      // Extract stats
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
        } catch (e) {
          console.error('Failed to parse stats:', e);
        }
      }

      return {
        username,
        secUid,
        userId,
        nickname,
        bio,
        avatar,
        stats,
      };
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  }

  /**
   * Fetch user videos
   * @param maxVideos - Maximum videos to fetch (default: unlimited)
   */
  async getUserVideos(
    secUid: string,
    maxVideos: number = Infinity
  ): Promise<TikTokVideo[]> {
    const videos: TikTokVideo[] = [];
    let cursor = 0;
    let hasMore = true;

    try {
      while (hasMore && videos.length < maxVideos) {
        const params = new URLSearchParams({
          aid: '1988',
          app_language: 'en',
          app_name: 'tiktok_web',
          browser_language: 'en-US',
          browser_name: 'Mozilla',
          browser_online: 'true',
          browser_platform: 'Linux x86_64',
          browser_version: '5.0',
          channel: 'tiktok_web',
          cookie_enabled: 'true',
          device_platform: 'web_pc',
          user_is_login: 'false',
          secUid: secUid,
          count: '30',
          cursor: cursor.toString(),
        });

        const url = `${this.apiBase}/post/item_list/?${params.toString()}`;

        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
            'Accept': 'application/json',
            'Referer': `${this.baseUrl}/@user`,
          },
        });

        if (!response.ok) {
          console.error(`API error: HTTP ${response.status}`);
          break;
        }

        const data: TikTokAPIResponse = await response.json();

        if (!data.itemList || data.itemList.length === 0) {
          break;
        }

        videos.push(...data.itemList);

        hasMore = data.hasMore || false;
        cursor = data.cursor || 0;

        // Rate limiting
        await this.sleep(500);
      }

      return videos.slice(0, maxVideos);
    } catch (error) {
      console.error('Error fetching videos:', error);
      return videos;
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
