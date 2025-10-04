/**
 * Trending Service
 *
 * Query TrendingTrackerV1 contract for trending songs
 *
 * Usage:
 * ```ts
 * const service = new TrendingService(provider);
 *
 * // Get hourly trending
 * const hourly = await service.getTrendingSongs(TimeWindow.Hourly, 10);
 *
 * // Get specific song trending data
 * const songData = await service.getSongTrending(
 *   TimeWindow.Daily,
 *   ContentSource.Genius,
 *   "123456"
 * );
 * ```
 */

import { ethers } from 'ethers';
import { TimeWindow } from './TrendingQueueService';
import { ContentSource } from '../types/song';

export interface TrendingEntry {
  songHash: string;
  clicks: number;
  plays: number;
  completions: number;
  trendingScore: number;
  lastUpdated: number;
}

export interface TrendingSong {
  source: ContentSource;
  songId: string;
  trendingScore: number;
  clicks: number;
  plays: number;
  completions: number;
  lastUpdated: number;
}

const TRENDING_TRACKER_ABI = [
  'function getTrendingSongs(uint8 timeWindow, uint256 limit) external view returns (tuple(uint8 source, string songId, uint32 trendingScore, uint32 clicks, uint32 plays, uint32 completions, uint64 lastUpdated)[] memory)',
  'function getSongTrending(uint8 timeWindow, uint8 source, string calldata songId) external view returns (tuple(bytes32 songHash, uint32 clicks, uint32 plays, uint32 completions, uint32 trendingScore, uint64 lastUpdated))',
  'function getCurrentWindowId(uint8 timeWindow) public view returns (uint256)',
  'function getSongHash(uint8 source, string calldata songId) public pure returns (bytes32)',
  'function trustedTracker() public view returns (address)',
  'function owner() public view returns (address)',
  'function paused() public view returns (bool)',
  'function clickWeight() public view returns (uint8)',
  'function playWeight() public view returns (uint8)',
  'function completionWeight() public view returns (uint8)'
];

export class TrendingService {
  private contract: ethers.Contract;

  constructor(
    provider: ethers.providers.Provider,
    contractAddress: string
  ) {
    this.contract = new ethers.Contract(
      contractAddress,
      TRENDING_TRACKER_ABI,
      provider
    );
  }

  /**
   * Get top N trending songs for a time window
   */
  async getTrendingSongs(
    timeWindow: TimeWindow,
    limit: number = 10
  ): Promise<TrendingSong[]> {
    try {
      const results = await this.contract.getTrendingSongs(timeWindow, limit);

      return results.map((item: any) => ({
        source: item.source as ContentSource,
        songId: item.songId,
        trendingScore: item.trendingScore,
        clicks: item.clicks,
        plays: item.plays,
        completions: item.completions,
        lastUpdated: item.lastUpdated
      })).sort((a: TrendingSong, b: TrendingSong) => b.trendingScore - a.trendingScore); // Sort by score descending

    } catch (error) {
      console.error('[TrendingService] Failed to get trending songs:', error);
      return [];
    }
  }

  /**
   * Get trending data for a specific song
   */
  async getSongTrending(
    timeWindow: TimeWindow,
    source: ContentSource,
    songId: string
  ): Promise<TrendingEntry | null> {
    try {
      const result = await this.contract.getSongTrending(timeWindow, source, songId);

      return {
        songHash: result.songHash,
        clicks: result.clicks,
        plays: result.plays,
        completions: result.completions,
        trendingScore: result.trendingScore,
        lastUpdated: result.lastUpdated
      };

    } catch (error) {
      console.error('[TrendingService] Failed to get song trending:', error);
      return null;
    }
  }

  /**
   * Get current window ID for a time window type
   */
  async getCurrentWindowId(timeWindow: TimeWindow): Promise<number> {
    try {
      const windowId = await this.contract.getCurrentWindowId(timeWindow);
      return windowId.toNumber();
    } catch (error) {
      console.error('[TrendingService] Failed to get current window ID:', error);
      return 0;
    }
  }

  /**
   * Get song hash (for debugging)
   */
  async getSongHash(source: ContentSource, songId: string): Promise<string> {
    try {
      return await this.contract.getSongHash(source, songId);
    } catch (error) {
      console.error('[TrendingService] Failed to get song hash:', error);
      return '';
    }
  }

  /**
   * Get contract configuration
   */
  async getConfig(): Promise<{
    trustedTracker: string;
    owner: string;
    paused: boolean;
    clickWeight: number;
    playWeight: number;
    completionWeight: number;
  }> {
    try {
      const [trustedTracker, owner, paused, clickWeight, playWeight, completionWeight] = await Promise.all([
        this.contract.trustedTracker(),
        this.contract.owner(),
        this.contract.paused(),
        this.contract.clickWeight(),
        this.contract.playWeight(),
        this.contract.completionWeight()
      ]);

      return {
        trustedTracker,
        owner,
        paused,
        clickWeight,
        playWeight,
        completionWeight
      };
    } catch (error) {
      console.error('[TrendingService] Failed to get config:', error);
      throw error;
    }
  }

  /**
   * Check if a song is trending in a specific window
   */
  async isTrending(
    timeWindow: TimeWindow,
    source: ContentSource,
    songId: string,
    minScore: number = 10
  ): Promise<boolean> {
    const data = await this.getSongTrending(timeWindow, source, songId);
    return data ? data.trendingScore >= minScore : false;
  }

  /**
   * Get trending rank for a song (1-based, 0 if not in top list)
   */
  async getTrendingRank(
    timeWindow: TimeWindow,
    source: ContentSource,
    songId: string,
    limit: number = 100
  ): Promise<number> {
    const trending = await this.getTrendingSongs(timeWindow, limit);
    const index = trending.findIndex(s => s.source === source && s.songId === songId);
    return index >= 0 ? index + 1 : 0;
  }
}

/**
 * Helper to format trending score for display
 */
export function formatTrendingScore(score: number): string {
  if (score >= 1000000) {
    return `${(score / 1000000).toFixed(1)}M`;
  }
  if (score >= 1000) {
    return `${(score / 1000).toFixed(1)}K`;
  }
  return score.toString();
}

/**
 * Helper to get trending badge text
 */
export function getTrendingBadge(rank: number, timeWindow: TimeWindow): string | null {
  if (rank === 0) return null;

  const windowText = timeWindow === TimeWindow.Hourly ? 'now' :
                     timeWindow === TimeWindow.Daily ? 'today' :
                     'this week';

  if (rank === 1) return `#1 trending ${windowText}`;
  if (rank <= 3) return `#${rank} trending ${windowText}`;
  if (rank <= 10) return `Top 10 ${windowText}`;
  if (rank <= 50) return `Top 50 ${windowText}`;
  return null;
}

/**
 * Helper to determine if trending is "hot" (recent surge)
 */
export function isHotTrending(entry: TrendingEntry): boolean {
  const age = Date.now() / 1000 - entry.lastUpdated;
  const hourAge = age / 3600;

  // Consider "hot" if updated in last hour and has high completion rate
  const completionRate = entry.completions / (entry.plays || 1);
  return hourAge < 1 && completionRate > 0.5;
}
