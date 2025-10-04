/**
 * Trending Integration Example
 *
 * Shows how to integrate trending tracking and display in the app
 *
 * Features:
 * 1. Track user interactions (clicks, plays, completions)
 * 2. Background sync to contract via PKP
 * 3. Display trending songs from contract
 * 4. Show trending badges on songs
 */

import React, { useEffect, useState } from 'react';
import { useWalletClient } from 'wagmi';
import { ethers } from 'ethers';
import { SongListItem } from '../components/ui/SongListItem';
import type { Song } from '../types/song';

// Trending services
import {
  TimeWindow,
  trackClick,
  trackPlay,
  trackCompletion,
  startAutoSync,
  getQueueStats
} from '../services/TrendingQueueService';
import { ContentSource } from '../types/song';

import {
  TrendingService,
  type TrendingSong,
  getTrendingBadge,
  formatTrendingScore
} from '../services/TrendingService';

// Lit Protocol
import { LitNodeClient } from '@lit-protocol/lit-node-client';

// Config
const TRENDING_TRACKER_ADDRESS = '0x0000000000000000000000000000000000000000'; // TODO: Update after deployment
const PKP_PUBLIC_KEY = '0x...'; // TODO: Your PKP public key
const LENS_RPC_URL = 'https://rpc.testnet.lens.xyz';

// Import Lit Action code (you'd load this from IPFS in production)
const TRENDING_LIT_ACTION_CODE = `/* trending-tracker-v1.js code here */`;

export function TrendingIntegrationExample() {
  const { data: walletClient } = useWalletClient();
  const [trendingSongs, setTrendingSongs] = useState<TrendingSong[]>([]);
  const [queueStats, setQueueStats] = useState<any>(null);
  const [autoSyncHandle, setAutoSyncHandle] = useState<{ stop: () => void } | null>(null);

  // Initialize trending service
  const trendingService = React.useMemo(() => {
    const provider = new ethers.providers.JsonRpcProvider(LENS_RPC_URL);
    return new TrendingService(provider, TRENDING_TRACKER_ADDRESS);
  }, []);

  // Initialize Lit Protocol client
  const litClient = React.useMemo(() => {
    const client = new LitNodeClient({
      litNetwork: 'cayenne', // or 'habanero' for mainnet
    });
    client.connect();
    return client;
  }, []);

  // Start auto-sync on mount
  useEffect(() => {
    if (!litClient || autoSyncHandle) return;

    const handle = startAutoSync(
      litClient,
      PKP_PUBLIC_KEY,
      TRENDING_LIT_ACTION_CODE,
      TimeWindow.Hourly
    );

    setAutoSyncHandle(handle);

    return () => {
      handle.stop();
    };
  }, [litClient]);

  // Load trending songs
  useEffect(() => {
    const loadTrending = async () => {
      const hourly = await trendingService.getTrendingSongs(TimeWindow.Hourly, 10);
      setTrendingSongs(hourly);
    };

    loadTrending();

    // Refresh every minute
    const interval = setInterval(loadTrending, 60 * 1000);
    return () => clearInterval(interval);
  }, [trendingService]);

  // Update queue stats
  useEffect(() => {
    const updateStats = () => {
      setQueueStats(getQueueStats());
    };

    updateStats();
    const interval = setInterval(updateStats, 5000);
    return () => clearInterval(interval);
  }, []);

  // Example: Track click when song is selected
  const handleSongClick = (song: Song, source: ContentSource) => {
    console.log('[Trending] Track click:', song.id);
    trackClick(source, song.id);

    // Navigate to song...
  };

  // Example: Track play when audio preview starts
  const handleSongPlay = (song: Song, source: ContentSource) => {
    console.log('[Trending] Track play:', song.id);
    trackPlay(source, song.id);

    // Play audio...
  };

  // Example: Track completion when song/segment finishes
  const handleSongCompletion = (song: Song, source: ContentSource) => {
    console.log('[Trending] Track completion:', song.id);
    trackCompletion(source, song.id);
  };

  return (
    <div className="p-4 bg-neutral-900 min-h-screen">
      {/* Queue Stats */}
      <div className="mb-6 p-4 bg-neutral-800 rounded-lg">
        <h3 className="text-white font-semibold mb-2">Trending Queue Status</h3>
        {queueStats && (
          <div className="text-neutral-400 text-sm space-y-1">
            <p>Total Events: {queueStats.totalEvents}</p>
            <p>Clicks: {queueStats.clicks}</p>
            <p>Plays: {queueStats.plays}</p>
            <p>Completions: {queueStats.completions}</p>
            {queueStats.oldestEvent && (
              <p>Oldest Event: {new Date(queueStats.oldestEvent).toLocaleTimeString()}</p>
            )}
          </div>
        )}
      </div>

      {/* Trending Songs */}
      <div className="mb-6">
        <h2 className="text-white text-xl font-bold mb-4">🔥 Trending Now</h2>

        {trendingSongs.length === 0 ? (
          <p className="text-neutral-500">No trending data yet</p>
        ) : (
          <div className="space-y-2">
            {trendingSongs.map((trending, index) => {
              const badge = getTrendingBadge(index + 1, TimeWindow.Hourly);

              return (
                <div key={`${trending.source}-${trending.songId}`} className="relative">
                  {/* Trending badge */}
                  {badge && (
                    <div className="absolute -top-2 -left-2 z-10">
                      <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                        {badge}
                      </span>
                    </div>
                  )}

                  {/* Song item - you'd convert trending data to Song type */}
                  <SongListItem
                    song={{
                      id: trending.songId,
                      title: trending.songId, // In real app, fetch full song data
                      artist: `Score: ${formatTrendingScore(trending.trendingScore)}`,
                      duration: 0,
                    }}
                    showPlayButton={false}
                    onClick={() => handleSongClick(
                      { id: trending.songId } as Song,
                      trending.source
                    )}
                    className="rounded-lg"
                  />

                  {/* Trending stats */}
                  <div className="mt-1 ml-24 text-xs text-neutral-500 flex gap-4">
                    <span>👆 {trending.clicks} clicks</span>
                    <span>▶️ {trending.plays} plays</span>
                    <span>✓ {trending.completions} completions</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Example: Regular song list with tracking */}
      <div>
        <h3 className="text-white text-lg font-semibold mb-3">All Songs</h3>
        <p className="text-neutral-400 text-sm mb-4">
          Click, play, or complete songs to contribute to trending data
        </p>

        {/* Your existing song list here... */}
      </div>
    </div>
  );
}

/**
 * Integration into SongPickerPage
 *
 * Add to your existing SongPickerPage.tsx:
 */

/*
import {
  ContentSource,
  trackClick,
  trackPlay,
  trackCompletion,
  startAutoSync
} from '../services/TrendingQueueService';

import { TrendingService } from '../services/TrendingService';

// In component:
const [trendingSongs, setTrendingSongs] = useState<TrendingSong[]>([]);

// Load trending on mount
useEffect(() => {
  const provider = new ethers.providers.JsonRpcProvider(LENS_RPC_URL);
  const service = new TrendingService(provider, TRENDING_TRACKER_ADDRESS);

  service.getTrendingSongs(TimeWindow.Hourly, 10)
    .then(setTrendingSongs);
}, []);

// Track clicks
const handleSongSelect = (song: Song) => {
  trackClick(ContentSource.Native, song.id);
  navigate(`/create/native/${song.id}`);
};

// Track plays
const handleSongPlay = (song: Song) => {
  trackPlay(ContentSource.Native, song.id);
  // ... play audio
};

// Track Genius clicks
const handleGeniusSongSelect = (result: GeniusSearchResult) => {
  trackClick(ContentSource.Genius, result.genius_id.toString());
  navigate(`/create/genius/${result.genius_id}`);
};

// Show trending section
{trendingSongs.length > 0 && (
  <div className="mb-6">
    <h3 className="text-white text-sm font-semibold mb-3 px-1">
      🔥 Trending Now
    </h3>
    <div className="space-y-2">
      {trendingSongs.slice(0, 5).map((trending) => (
        // ... render trending songs
      ))}
    </div>
  </div>
)}
*/
