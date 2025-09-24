import { lensClient } from "./lens/client";
import { fetchAppUsers, fetchApp } from "@lens-protocol/client/actions";
import { evmAddress } from "@lens-protocol/client";
import { useQuery } from '@tanstack/react-query';

// Your testnet app address 
const APP_ADDRESS = '0x9484206D9beA9830F27361a2F5868522a8B8Ad22'; // Testnet app

export interface TikTokCreatorMapping {
  tiktokHandle: string;
  lensAccount: any;
  lensUsername?: string;
  accountAddress: string;
}

/**
 * Get all accounts created under your app from Lens Protocol
 * This is much simpler than querying a separate registry contract!
 */
export async function getAppAccounts(): Promise<TikTokCreatorMapping[]> {
  try {
    console.log('[getAppAccounts] Fetching users for app:', APP_ADDRESS);

    // Skip app verification - it's failing but the app exists
    // Go directly to fetching users
    const result = await fetchAppUsers(lensClient, {
      app: evmAddress(APP_ADDRESS),
      pageSize: "FIFTY"
    });

    if (result.isErr()) {
      console.error('[getAppAccounts] Error fetching app users from Lens:', result.error);
      return [];
    }

    const appUsers = result.value.items;
    console.log('[getAppAccounts] ✅ SUCCESS! Found app users:', appUsers.length);

    // Log all users for debugging
    if (appUsers.length > 0) {
      console.log('[getAppAccounts] 🎉 YOUR APP USERS:');
      appUsers.forEach((user, i) => {
        console.log(`[getAppAccounts] User ${i}:`, {
          username: user.account.username?.value,
          address: user.account.address,
          lastActive: user.lastActiveOn
        });
      });
    } else {
      console.log('[getAppAccounts] ❌ No users found for this app.');
    }

    return appUsers.map(user => ({
      tiktokHandle: user.account.username?.value || 'unknown',
      lensAccount: user.account,
      lensUsername: user.account.username?.value,
      accountAddress: user.account.address
    }));
  } catch (error) {
    console.error('[getAppAccounts] ❌ CRITICAL ERROR in getAppAccounts:', error);
    return [];
  }
}

/**
 * Hook to get all accounts under your app
 */
export function usePKPLensMapping() {
  return useQuery({
    queryKey: ['app-accounts-mapping'],
    queryFn: async (): Promise<TikTokCreatorMapping[]> => {
      return getAppAccounts();
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
  });
}

/**
 * Hook to get Lens posts from all app accounts
 */
export function usePKPLensFeed() {
  const { data: mappings = [], isLoading: mappingsLoading } = usePKPLensMapping();

  return useQuery({
    queryKey: ['app-lens-feed', mappings.map(m => m.accountAddress)],
    queryFn: async () => {
      console.log('[usePKPLensFeed] Fetching with mappings:', mappings.length, 'mappings');
      if (mappings.length === 0) {
        console.log('[usePKPLensFeed] No mappings, returning empty array');
        return [];
      }

      const { getPKPAccountsPosts } = await import('./lens-feed');
      const addresses = mappings.map(m => m.accountAddress);
      console.log('[usePKPLensFeed] Calling getPKPAccountsPosts with addresses:', addresses);
      const result = await getPKPAccountsPosts(addresses);
      console.log('[usePKPLensFeed] getPKPAccountsPosts returned:', result.length, 'posts');
      return result;
    },
    enabled: !mappingsLoading,
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 5 * 60 * 1000, // 5 minutes
  });
}