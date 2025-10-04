/**
 * TrendingQueueService Tests
 *
 * Tests for event tracking and queue management
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  TimeWindow,
  trackClick,
  trackPlay,
  trackCompletion,
  getQueue,
  getQueueStats,
  needsSync
} from '../TrendingQueueService';
import { ContentSource } from '../../types/song';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    }
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock
});

describe('TrendingQueueService', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  afterEach(() => {
    localStorageMock.clear();
  });

  describe('Event Tracking', () => {
    it('should track click events', () => {
      trackClick(ContentSource.Genius, '123456');
      const queue = getQueue();

      expect(queue).toHaveLength(1);
      expect(queue[0]).toMatchObject({
        source: ContentSource.Genius,
        songId: '123456',
        eventType: 'click'
      });
      expect(queue[0].timestamp).toBeGreaterThan(0);
    });

    it('should track play events', () => {
      trackPlay(ContentSource.Native, 'heat-of-the-night');
      const queue = getQueue();

      expect(queue).toHaveLength(1);
      expect(queue[0]).toMatchObject({
        source: ContentSource.Native,
        songId: 'heat-of-the-night',
        eventType: 'play'
      });
    });

    it('should track completion events', () => {
      trackCompletion(ContentSource.Native, 'heat-of-the-night');
      const queue = getQueue();

      expect(queue).toHaveLength(1);
      expect(queue[0]).toMatchObject({
        source: ContentSource.Native,
        songId: 'heat-of-the-night',
        eventType: 'completion'
      });
    });

    it('should track multiple events', () => {
      trackClick(ContentSource.Genius, '123456');
      trackPlay(ContentSource.Genius, '123456');
      trackCompletion(ContentSource.Genius, '123456');

      const queue = getQueue();
      expect(queue).toHaveLength(3);
      expect(queue[0].eventType).toBe('click');
      expect(queue[1].eventType).toBe('play');
      expect(queue[2].eventType).toBe('completion');
    });
  });

  describe('Queue Stats', () => {
    it('should return empty stats for empty queue', () => {
      const stats = getQueueStats();

      expect(stats).toEqual({
        totalEvents: 0,
        clicks: 0,
        plays: 0,
        completions: 0,
        oldestEvent: null,
        newestEvent: null
      });
    });

    it('should calculate correct stats', () => {
      // Add test events
      trackClick(ContentSource.Genius, '123456');
      trackClick(ContentSource.Genius, '789012');
      trackPlay(ContentSource.Native, 'song-1');
      trackPlay(ContentSource.Native, 'song-2');
      trackPlay(ContentSource.Native, 'song-3');
      trackCompletion(ContentSource.Native, 'song-1');

      const stats = getQueueStats();

      expect(stats.totalEvents).toBe(6);
      expect(stats.clicks).toBe(2);
      expect(stats.plays).toBe(3);
      expect(stats.completions).toBe(1);
      expect(stats.oldestEvent).toBeGreaterThan(0);
      expect(stats.newestEvent).toBeGreaterThan(0);
      expect(stats.newestEvent).toBeGreaterThanOrEqual(stats.oldestEvent!);
    });
  });

  describe('Sync Logic', () => {
    it('should not need sync when queue is empty', () => {
      expect(needsSync()).toBe(false);
    });

    it('should need sync when queue is large', () => {
      // Add 51 events (over default threshold of 50)
      for (let i = 0; i < 51; i++) {
        trackClick(ContentSource.Genius, `song-${i}`);
      }

      expect(needsSync()).toBe(true);
    });

    it('should need sync when events are old', () => {
      // Add an old event by modifying the queue directly
      const queue = [{
        source: ContentSource.Native,
        songId: 'old-song',
        eventType: 'click' as const,
        timestamp: Date.now() - (6 * 60 * 1000) // 6 minutes ago (over 5 min threshold)
      }];

      localStorageMock.setItem('trending_event_queue', JSON.stringify(queue));

      expect(needsSync(50, 5 * 60 * 1000)).toBe(true);
    });
  });

  describe('ContentSource Enum', () => {
    it('should have correct values', () => {
      expect(ContentSource.Native).toBe(0);
      expect(ContentSource.Genius).toBe(1);
    });
  });

  describe('TimeWindow Enum', () => {
    it('should have correct values', () => {
      expect(TimeWindow.Hourly).toBe(0);
      expect(TimeWindow.Daily).toBe(1);
      expect(TimeWindow.Weekly).toBe(2);
    });
  });
});
