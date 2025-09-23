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
    // console.log('[getAppAccounts] Fetching users for app:', APP_ADDRESS);
    
    // First verify the app exists
    const appCheck = await fetchApp(lensClient, {
      app: evmAddress(APP_ADDRESS)
    });
    
    if (appCheck.isErr()) {
      console.error('[getAppAccounts] App does not exist or error:', appCheck.error);
      return [];
    }
    
    // console.log('[getAppAccounts] App verified:', {
    //   address: appCheck.value.address,
    //   owner: appCheck.value.owner,
    //   createdAt: appCheck.value.createdAt
    // });
    
    const result = await fetchAppUsers(lensClient, {
      app: evmAddress(APP_ADDRESS),
      pageSize: "FIFTY"
    });

    if (result.isErr()) {
      console.error('Error fetching app users from Lens:', result.error);
      return [];
    }

    const appUsers = result.value.items;
    // console.log('[getAppAccounts] Found app users:', appUsers.length);
    
    // Log first few users for debugging
    // if (appUsers.length > 0) {
    //   console.log('[getAppAccounts] First app user:', {
    //     username: appUsers[0].account.username?.value,
    //     address: appUsers[0].account.address,
    //     lastActiveOn: appUsers[0].lastActiveOn,
    //     firstLoginOn: appUsers[0].firstLoginOn
    //   });
    //
    //   // Log a few users to see structure
    //   appUsers.slice(0, 5).forEach((user, i) => {
    //     console.log(`[getAppAccounts] App User ${i}:`, {
    //       username: user.account.username?.value,
    //       address: user.account.address,
    //       lastActive: user.lastActiveOn
    //     });
    //   });
    // }

    return appUsers.map(user => ({
      tiktokHandle: user.account.username?.value || 'unknown',
      lensAccount: user.account,
      lensUsername: user.account.username?.value,
      accountAddress: user.account.address
    }));
  } catch (error) {
    console.error('Error in getAppAccounts:', error);
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
      if (mappings.length === 0) return [];
      
      const { getPKPAccountsPosts } = await import('./lens-feed');
      return getPKPAccountsPosts(mappings.map(m => m.accountAddress));
    },
    enabled: !mappingsLoading && mappings.length > 0,
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 5 * 60 * 1000, // 5 minutes
  });
}