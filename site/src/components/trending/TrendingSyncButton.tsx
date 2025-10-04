/**
 * @deprecated This component is obsolete. Trending writes now happen automatically in Lit Actions.
 *
 * TrendingSyncButton (OBSOLETE - kept for reference)
 *
 * ⚠️ DO NOT USE - Manual syncing is no longer needed.
 * Trending writes are handled automatically by Lit Actions.
 *
 * See: lit-actions/src/search/referents.js for current implementation
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { syncQueue, getQueueStats, TimeWindow } from '@/services/TrendingQueueService';
import { LIT_ACTIONS } from '@/config/lit-actions';

interface TrendingSyncButtonProps {
  litNodeClient?: any; // Lit v8 client
}

export const TrendingSyncButton: React.FC<TrendingSyncButtonProps> = ({ litNodeClient }) => {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<string>('');
  const stats = getQueueStats();

  const handleSync = async () => {
    if (!litNodeClient) {
      setResult('❌ Lit client not initialized');
      return;
    }

    try {
      setSyncing(true);
      setResult('🔄 Syncing...');

      // Get config
      const trendingConfig = LIT_ACTIONS.trending.tracker;

      // Fetch Lit Action code
      const litActionUrl = `https://gateway.pinata.cloud/ipfs/${trendingConfig.cid}`;
      const response = await fetch(litActionUrl);
      const litActionCode = await response.text();

      // Sync queue
      const syncResult = await syncQueue(
        litNodeClient,
        trendingConfig.pkp,
        TimeWindow.Hourly,
        litActionCode
      );

      if (syncResult.success) {
        setResult(`✅ Synced! Tx: ${syncResult.txHash?.substring(0, 10)}...`);
        // Reload page to see trending
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setResult(`❌ Sync failed: ${syncResult.error}`);
      }
    } catch (error) {
      console.error('Sync error:', error);
      setResult(`❌ Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    } finally {
      setSyncing(false);
    }
  };

  if (stats.totalEvents === 0) {
    return null; // Don't show if no events
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-neutral-800 rounded-lg p-4 shadow-lg">
      <div className="text-sm text-neutral-400 mb-2">
        Queue: {stats.totalEvents} events ({stats.clicks}c, {stats.plays}p, {stats.completions}✓)
      </div>
      <Button
        onClick={handleSync}
        disabled={syncing}
        className="w-full"
        size="sm"
      >
        {syncing ? '🔄 Syncing...' : '⬆️ Sync to Contract'}
      </Button>
      {result && (
        <div className="text-xs mt-2 text-neutral-300">
          {result}
        </div>
      )}
    </div>
  );
};
