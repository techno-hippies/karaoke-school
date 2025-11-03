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
  // The Graph Studio endpoint (for production)
  studio: 'https://api.studio.thegraph.com/query/120915/ksc-1/v0.0.1',
}

// Use local endpoint for development, studio for production
export const SUBGRAPH_URL = import.meta.env.DEV
  ? SUBGRAPH_ENDPOINTS.local
  : SUBGRAPH_ENDPOINTS.studio

export const graphClient = new GraphQLClient(SUBGRAPH_URL, {
  headers: {
    'Content-Type': 'application/json',
  },
})

console.log('📊 Subgraph URL:', SUBGRAPH_URL)
