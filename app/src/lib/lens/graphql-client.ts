/**
 * GraphQL Client for Lens Protocol
 * Provides authenticated GraphQL client for raw mutations/queries
 */

import { GraphQLClient } from 'graphql-request'
import type { Variables } from 'graphql-request'

// Lens API URL
const LENS_API_URL = 'https://api.testnet.lens.xyz/graphql' // TODO: Make this configurable

/**
 * Create authenticated GraphQL client for Lens
 */
export function createLensGraphQLClient(accessToken?: string): GraphQLClient {
  const client = new GraphQLClient(LENS_API_URL, {
    headers: {
      'Origin': 'https://karaoke.school',
      ...(accessToken && { 'Authorization': `Bearer ${accessToken}` }),
    },
  })

  return client
}

/**
 * Execute GraphQL query with error handling
 */
export async function executeQuery<T = any>(
  client: GraphQLClient,
  query: string,
  variables: Variables
): Promise<T> {
  try {
    const data = await client.request<T>(query, variables)
    return data
  } catch (error: any) {
    console.error('[GraphQL] Query error:', error)
    if (error.response) {
      console.error('[GraphQL] Response:', JSON.stringify(error.response, null, 2))
    }
    throw error
  }
}
