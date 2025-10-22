/**
 * The Graph GraphQL Client
 *
 * Connects to the deployed subgraph for querying songs, segments, and performances
 */

import { GraphQLClient } from 'graphql-request'

// The Graph Studio endpoint for ksc-1 subgraph
export const SUBGRAPH_URL = 'https://api.studio.thegraph.com/query/120915/ksc-1/v0.0.1'

export const graphClient = new GraphQLClient(SUBGRAPH_URL, {
  headers: {
    'Content-Type': 'application/json',
  },
})
