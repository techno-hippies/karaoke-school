/**
 * Lit Protocol Search Service
 *
 * Handles Genius API search via Lit Actions (v8)
 */

import { createLitClient } from '@lit-protocol/lit-client';
import { nagaDev } from '@lit-protocol/networks';
import { createAuthManager, storagePlugins, WalletClientAuthenticator } from '@lit-protocol/auth';
import { getLitAction } from '../config/lit-actions';
import type { WalletClient } from 'wagmi';

// Create Auth Manager with localStorage persistence (v8 pattern)
const authManager = createAuthManager({
  storage: storagePlugins.localStorage({
    appName: 'karaoke-school',
    networkName: 'naga-dev'
  })
});

export interface GeniusSearchResult {
  genius_id: number;
  title: string;
  title_with_featured: string;
  artist: string;
  artist_id?: number;
  genius_slug: string;
  url: string;
  artwork_thumbnail: string | null;
  lyrics_state: string;
  _score?: number;
}

export interface SearchResponse {
  success: boolean;
  results: GeniusSearchResult[];
  count: number;
  keyUsed?: number;
  version?: string;
  analytics?: string;
  error?: string;
}

export class LitSearchService {
  private litClient: any = null;
  private authContext: any = null;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize the Lit Client (v8 pattern)
   */
  private async init(): Promise<void> {
    if (this.litClient) return;

    if (this.initPromise) {
      await this.initPromise;
      return;
    }

    this.initPromise = (async () => {
      try {
        console.log('[LitSearchService] Connecting to nagaDev network (v8)...');
        this.litClient = await createLitClient({ network: nagaDev });
        console.log('[LitSearchService] ✅ Connected to Lit Network (v8)');
      } catch (error) {
        console.error('[LitSearchService] Failed to initialize:', error);
        this.litClient = null;
        this.initPromise = null;
        throw error;
      }
    })();

    await this.initPromise;
  }

  /**
   * Create EOA auth context (v8 requires wallet for auth context)
   */
  async createAuthContext(walletClient: WalletClient) {
    if (!this.litClient) {
      throw new Error('Lit client not connected. Call connect() first.');
    }

    if (this.authContext) {
      console.log('[LitSearchService] Using existing authContext');
      return this.authContext;
    }

    try {
      console.log('[LitSearchService] Creating EOA authContext...');

      const domain = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
      console.log('[LitSearchService] Using domain:', domain);

      // Create EOA auth context (v8 pattern - requires wallet)
      this.authContext = await authManager.createEoaAuthContext({
        authConfig: {
          resources: [
            ['lit-action-execution', '*']
          ],
          expiration: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
          statement: 'Sign in to search for songs',
          domain: domain
        },
        config: {
          account: walletClient
        },
        litClient: this.litClient
      });

      console.log('[LitSearchService] ✅ EOA AuthContext created');
      return this.authContext;
    } catch (error: any) {
      console.error('[LitSearchService] Failed to create authContext:', error);
      throw new Error(`AuthContext creation failed: ${error.message}`);
    }
  }

  /**
   * Search Genius API for songs via Lit Action
   */
  async searchSongs(
    query: string,
    walletClient: WalletClient,
    options?: {
      limit?: number;
      userAddress?: string;
      sessionId?: string;
    }
  ): Promise<SearchResponse> {
    try {
      await this.init();

      if (!this.litClient) {
        throw new Error('Lit Client not initialized');
      }

      // Create auth context (required by v8)
      const authContext = await this.createAuthContext(walletClient);

      const searchAction = getLitAction('search', 'free');
      if (!searchAction) {
        throw new Error('Search action not found in config');
      }

      console.log('[LitSearchService] Searching with query:', query);
      console.log('[LitSearchService] Using Lit Action CID:', searchAction.cid);

      // Prepare parameters for the Lit Action
      const jsParams = {
        query: query.trim(),
        limit: options?.limit || 10,
        userAddress: options?.userAddress || 'anonymous',
        sessionId: options?.sessionId || crypto.randomUUID(),
        language: navigator.language || 'en-US',
        userAgent: navigator.userAgent,
        // Note: DB credentials would be added here if available
        // dbUrlCiphertext, dbUrlDataToEncryptHash, etc.
      };

      console.log('[LitSearchService] Executing Lit Action with params:', {
        ...jsParams,
        userAgent: jsParams.userAgent.substring(0, 50) + '...',
      });

      // Execute the Lit Action (v8 API requires authContext)
      const response = await this.litClient.executeJs({
        ipfsId: searchAction.cid,
        authContext: authContext,
        jsParams,
      });

      console.log('[LitSearchService] Raw response:', response);

      // Parse the response
      if (!response.response) {
        throw new Error('No response from Lit Action');
      }

      const result: SearchResponse = JSON.parse(response.response as string);
      console.log('[LitSearchService] Parsed result:', result);

      if (!result.success) {
        throw new Error(result.error || 'Search failed');
      }

      return result;
    } catch (error) {
      console.error('[LitSearchService] Search failed:', error);
      return {
        success: false,
        results: [],
        count: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Disconnect from Lit Network
   */
  async disconnect(): Promise<void> {
    if (this.litClient) {
      await this.litClient.disconnect();
      this.litClient = null;
      this.authContext = null;
      this.initPromise = null;
      console.log('[LitSearchService] Disconnected from Lit Network');
    }
  }

  /**
   * Clear auth context (force re-auth)
   */
  clearAuthContext() {
    this.authContext = null;
    console.log('[LitSearchService] Auth context cleared');
  }
}

// Singleton instance
let litSearchServiceInstance: LitSearchService | null = null;

/**
 * Get the singleton LitSearchService instance
 */
export function getLitSearchService(): LitSearchService {
  if (!litSearchServiceInstance) {
    litSearchServiceInstance = new LitSearchService();
  }
  return litSearchServiceInstance;
}
