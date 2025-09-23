import { useQuery } from '@tanstack/react-query';
import { getFeedItems, getPKPAccountsPosts } from '../lib/lens-feed';
import type { LensFeedItem } from '../types/feed';

/**
 * Hook to fetch feed items from Lens Protocol
 * Replaces the old subgraph-based feed
 */
export function useSubgraphFeed(limit: number = 50) {
  return useQuery({
    queryKey: ['lens-feed', limit],
    queryFn: () => getFeedItems(limit),
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });
}

/**
 * Hook to fetch posts from specific PKP accounts
 * This is the main hook for getting posts from your TikTok creators on Lens
 */
export function usePKPFeed(pkpAddresses: string[], limit: number = 50) {
  return useQuery({
    queryKey: ['pkp-lens-feed', pkpAddresses, limit],
    queryFn: () => getPKPAccountsPosts(pkpAddresses, limit),
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
    enabled: pkpAddresses.length > 0, // Only fetch if we have PKP addresses
  });
}