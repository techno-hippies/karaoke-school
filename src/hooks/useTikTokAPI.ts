import { useMemo } from 'react';
import { TikTokAPI } from '@/lib/tiktok-api';

/**
 * Hook that creates a TikTokAPI instance
 */
export function useTikTokAPI() {
  const tiktokApi = useMemo(() => {
    return new TikTokAPI();
  }, []);
  
  return tiktokApi;
}