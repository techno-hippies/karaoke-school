/**
 * Search Lit Action
 * Searches for songs on Genius using free tier
 */

import { getLitClient } from '../../lit-webauthn/client'
import type { SearchResponse } from './types'

const IS_DEV = import.meta.env.DEV

/**
 * Execute Search Lit Action
 * Searches for songs on Genius using free tier
 */
export async function executeSearch(
  query: string,
  limit: number = 10,
  authContext: any
): Promise<SearchResponse> {
  try {
    const litClient = await getLitClient()

    const result = await litClient.executeJs({
      ipfsId: import.meta.env.VITE_LIT_ACTION_SEARCH,
      authContext,
      jsParams: { query, limit },
    })

    const response: SearchResponse = JSON.parse(result.response)

    if (IS_DEV && response.success && response.results) {
      console.log(`[Search] Found ${response.count} results:`,
        response.results.slice(0, 3).map(r => `${r.artist} - ${r.title}`))
    }

    return response
  } catch (err) {
    console.error('[Search] Failed:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Search failed',
    }
  }
}
