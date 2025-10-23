/**
 * TikTok Video Parser
 * Extracts music metadata (including Spotify track ID) from TikTok video URLs
 */

import { $ } from 'bun';
import { join } from 'path';

export interface TikTokVideoMusic {
  id: string;
  title: string;
  authorName: string;
  isCopyrighted: boolean;
  spotifyTrackId?: string;
  spotifyUrl?: string;
}

export interface TikTokVideoData {
  videoId: string;
  videoUrl: string;
  description: string;
  createTime: number;
  stats: {
    playCount: number;
    likeCount: number;
    commentCount: number;
    shareCount: number;
  };
  music: TikTokVideoMusic;
}

/**
 * Parse TikTok video URL to extract video ID
 */
export function parseTikTokUrl(url: string): string | null {
  // Match patterns:
  // - https://www.tiktok.com/@user/video/1234567890
  // - https://vm.tiktok.com/abc123/
  // - https://www.tiktok.com/t/abc123/

  const patterns = [
    /tiktok\.com\/@[^\/]+\/video\/(\d+)/,
    /vm\.tiktok\.com\/([A-Za-z0-9]+)/,
    /tiktok\.com\/t\/([A-Za-z0-9]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

/**
 * Fetch TikTok video data by scraping the HTML page
 * This matches the pattern used in archived/pkp-lens-flow/services/crawler/tiktok_crawler.py
 */
export async function fetchTikTokVideoData(videoUrl: string): Promise<TikTokVideoData> {
  const videoId = parseTikTokUrl(videoUrl);

  if (!videoId) {
    throw new Error(`Invalid TikTok URL: ${videoUrl}`);
  }

  // Fetch the HTML page
  const response = await fetch(videoUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    },
  });

  if (!response.ok) {
    throw new Error(`TikTok fetch error: ${response.status}`);
  }

  const html = await response.text();

  // Extract JSON data from script tag
  // Pattern: <script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">{...}</script>
  const scriptMatch = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>(.*?)<\/script>/s);

  if (!scriptMatch) {
    throw new Error('Could not find embedded JSON data in TikTok page');
  }

  let data: any;
  try {
    data = JSON.parse(scriptMatch[1]);
  } catch (error) {
    throw new Error('Failed to parse TikTok embedded JSON');
  }

  // Navigate to video data
  // Structure: __DEFAULT_SCOPE__["webapp.video-detail"].itemInfo.itemStruct
  const videoDetail = data?.__DEFAULT_SCOPE__?.['webapp.video-detail'];

  if (!videoDetail?.itemInfo?.itemStruct) {
    // TikTok may have blocked the request - check status
    if (videoDetail?.statusCode) {
      throw new Error(
        `TikTok returned error: ${videoDetail.statusCode} - ${videoDetail.statusMsg || 'No message'}`
      );
    }
    throw new Error('Video data not found in page');
  }

  const item = videoDetail.itemInfo.itemStruct;

  // Extract Spotify track ID from music metadata
  const music = item.music || {};
  const tt2dsp = music.tt2dsp || {};
  const songInfos = tt2dsp.tt_to_dsp_song_infos || [];

  let spotifyTrackId: string | undefined;
  let spotifyUrl: string | undefined;

  for (const info of songInfos) {
    // Note: Keys are capitalized in TikTok's response
    if (info.Platform === 3) { // Spotify platform ID
      spotifyTrackId = info.SongId;
      spotifyUrl = `https://open.spotify.com/track/${spotifyTrackId}`;
      break;
    }
  }

  return {
    videoId: item.id,
    videoUrl,
    description: item.desc || '',
    createTime: item.createTime,
    stats: {
      playCount: item.stats?.playCount || 0,
      likeCount: item.stats?.diggCount || 0,
      commentCount: item.stats?.commentCount || 0,
      shareCount: item.stats?.shareCount || 0,
    },
    music: {
      id: music.id,
      title: music.title || '',
      authorName: music.authorName || '',
      isCopyrighted: music.original === false && music.isCopyrighted === true,
      spotifyTrackId,
      spotifyUrl,
    },
  };
}

/**
 * Fetch TikTok video data using Python scraper (fallback method)
 * Uses hrequests with browser rendering for reliable access
 */
export async function fetchTikTokVideoDataViaPython(videoUrl: string): Promise<TikTokVideoData> {
  const scriptPath = join(import.meta.dir, 'tiktok-video-scraper.py');

  try {
    const result = await $`python3 ${scriptPath} ${videoUrl}`.text();
    const data = JSON.parse(result);
    return data as TikTokVideoData;
  } catch (error: any) {
    throw new Error(`Python scraper failed: ${error.message}`);
  }
}

/**
 * Main function: fetch video data with fallback
 */
export async function getTikTokVideoData(videoUrl: string): Promise<TikTokVideoData> {
  try {
    return await fetchTikTokVideoData(videoUrl);
  } catch (error) {
    console.error('Direct fetch failed:', error);
    console.warn('Trying Python scraper fallback...');
    return await fetchTikTokVideoDataViaPython(videoUrl);
  }
}

// CLI usage
if (import.meta.main) {
  const videoUrl = process.argv[2];

  if (!videoUrl) {
    console.error('Usage: bun lib/tiktok-video-parser.ts <tiktok_video_url>');
    process.exit(1);
  }

  try {
    const data = await getTikTokVideoData(videoUrl);
    console.log(JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}
