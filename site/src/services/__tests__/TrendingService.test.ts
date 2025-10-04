/**
 * TrendingService Tests
 *
 * Tests for trending service helper functions
 */

import { describe, it, expect } from 'vitest';
import {
  formatTrendingScore,
  getTrendingBadge,
  isHotTrending,
  type TrendingEntry
} from '../TrendingService';
import { TimeWindow } from '../TrendingQueueService';

describe('TrendingService Helpers', () => {
  describe('formatTrendingScore', () => {
    it('should format small scores', () => {
      expect(formatTrendingScore(0)).toBe('0');
      expect(formatTrendingScore(50)).toBe('50');
      expect(formatTrendingScore(999)).toBe('999');
    });

    it('should format thousands', () => {
      expect(formatTrendingScore(1000)).toBe('1.0K');
      expect(formatTrendingScore(1500)).toBe('1.5K');
      expect(formatTrendingScore(12345)).toBe('12.3K');
      expect(formatTrendingScore(999999)).toBe('1000.0K');
    });

    it('should format millions', () => {
      expect(formatTrendingScore(1000000)).toBe('1.0M');
      expect(formatTrendingScore(1234567)).toBe('1.2M');
      expect(formatTrendingScore(10000000)).toBe('10.0M');
    });
  });

  describe('getTrendingBadge', () => {
    it('should return null for non-trending (rank 0)', () => {
      expect(getTrendingBadge(0, TimeWindow.Hourly)).toBeNull();
    });

    it('should return #1 badge for first place', () => {
      expect(getTrendingBadge(1, TimeWindow.Hourly)).toBe('#1 trending now');
      expect(getTrendingBadge(1, TimeWindow.Daily)).toBe('#1 trending today');
      expect(getTrendingBadge(1, TimeWindow.Weekly)).toBe('#1 trending this week');
    });

    it('should return numbered badge for top 3', () => {
      expect(getTrendingBadge(2, TimeWindow.Hourly)).toBe('#2 trending now');
      expect(getTrendingBadge(3, TimeWindow.Daily)).toBe('#3 trending today');
    });

    it('should return Top 10 badge for ranks 4-10', () => {
      expect(getTrendingBadge(4, TimeWindow.Hourly)).toBe('Top 10 now');
      expect(getTrendingBadge(5, TimeWindow.Daily)).toBe('Top 10 today');
      expect(getTrendingBadge(10, TimeWindow.Weekly)).toBe('Top 10 this week');
    });

    it('should return Top 50 badge for ranks 11-50', () => {
      expect(getTrendingBadge(11, TimeWindow.Hourly)).toBe('Top 50 now');
      expect(getTrendingBadge(25, TimeWindow.Daily)).toBe('Top 50 today');
      expect(getTrendingBadge(50, TimeWindow.Weekly)).toBe('Top 50 this week');
    });

    it('should return null for ranks > 50', () => {
      expect(getTrendingBadge(51, TimeWindow.Hourly)).toBeNull();
      expect(getTrendingBadge(100, TimeWindow.Daily)).toBeNull();
    });
  });

  describe('isHotTrending', () => {
    it('should identify hot trending (recent + high completion rate)', () => {
      const entry: TrendingEntry = {
        songHash: '0x123',
        clicks: 100,
        plays: 80,
        completions: 50,
        trendingScore: 1000,
        lastUpdated: Math.floor(Date.now() / 1000) - 1800 // 30 min ago
      };

      expect(isHotTrending(entry)).toBe(true);
    });

    it('should not be hot if completion rate is low', () => {
      const entry: TrendingEntry = {
        songHash: '0x123',
        clicks: 100,
        plays: 80,
        completions: 10, // Low completion rate (12.5%)
        trendingScore: 1000,
        lastUpdated: Math.floor(Date.now() / 1000) - 1800
      };

      expect(isHotTrending(entry)).toBe(false);
    });

    it('should not be hot if too old', () => {
      const entry: TrendingEntry = {
        songHash: '0x123',
        clicks: 100,
        plays: 80,
        completions: 50,
        trendingScore: 1000,
        lastUpdated: Math.floor(Date.now() / 1000) - 7200 // 2 hours ago
      };

      expect(isHotTrending(entry)).toBe(false);
    });

    it('should handle edge case with zero plays', () => {
      const entry: TrendingEntry = {
        songHash: '0x123',
        clicks: 100,
        plays: 0,
        completions: 0,
        trendingScore: 100,
        lastUpdated: Math.floor(Date.now() / 1000) - 1800
      };

      // Should not crash, should return false (0 completion rate)
      expect(isHotTrending(entry)).toBe(false);
    });
  });
});
