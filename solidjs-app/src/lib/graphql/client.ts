/**
 * The Graph GraphQL Client
 *
 * Connects to the deployed subgraph for querying songs, segments, and performances
 */

import { GraphQLClient } from 'graphql-request'

// Subgraph endpoint configuration
const SUBGRAPH_ENDPOINTS = {
  // Local Graph Node Dev Mode (for development) - use 127.0.0.1 for IPv4
  local: 'http://127.0.0.1:8000/subgraphs/name/subgraph-0/',
  // The Graph Studio endpoint (deployed on Lens testnet)
  // v0.0.12: Removed unlockLockAddress/unlockChainId from Clip entity
  studio: 'https://api.studio.thegraph.com/query/1715685/kschool-alpha-1/v0.0.12',
}

// Allow override via env var: VITE_SUBGRAPH_MODE=local to use local GND
const SUBGRAPH_MODE = import.meta.env.VITE_SUBGRAPH_MODE as 'local' | 'studio' | undefined
export const SUBGRAPH_URL = SUBGRAPH_MODE === 'local'
  ? SUBGRAPH_ENDPOINTS.local
  : SUBGRAPH_ENDPOINTS.studio

export const graphClient = new GraphQLClient(SUBGRAPH_URL, {
  headers: {
    'Content-Type': 'application/json',
  },
})
