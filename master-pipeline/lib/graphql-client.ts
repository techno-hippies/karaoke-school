/**
 * The Graph Client for Karaoke School V2
 * Queries the deployed subgraph for songs, segments, and accounts
 */

import { GraphQLClient } from 'graphql-request';

export const SUBGRAPH_URL = 'https://api.studio.thegraph.com/query/120915/ksc-1/v0.0.1';

export const graphClient = new GraphQLClient(SUBGRAPH_URL, {
  headers: {
    'Content-Type': 'application/json',
  },
});
