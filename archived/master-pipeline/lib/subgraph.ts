/**
 * The Graph Subgraph Utilities
 * Query song metadata from KaraokeSchoolV1 subgraph
 */

import { requireEnv } from './config.js';

const SUBGRAPH_URL = requireEnv('SUBGRAPH_URL');

interface SongMetadata {
  geniusId: string;
  title?: string;
  artist?: string;
  coverUri?: string;
  metadataUri: string;
}

/**
 * Fetch song metadata from The Graph subgraph by genius ID
 */
export async function getSongMetadata(geniusId: number): Promise<SongMetadata | null> {
  const query = `
    query GetSong($geniusId: String!) {
      song(id: $geniusId) {
        id
        geniusId
        metadataUri
      }
    }
  `;

  const response = await fetch(SUBGRAPH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      variables: {
        geniusId: geniusId.toString(),
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Subgraph query failed: ${response.statusText}`);
  }

  const result = await response.json();

  if (result.errors) {
    throw new Error(`Subgraph query error: ${JSON.stringify(result.errors)}`);
  }

  const song = result.data?.song;
  if (!song) {
    return null;
  }

  // Fetch metadata JSON from the metadataUri
  let metadata: any = {};
  if (song.metadataUri) {
    try {
      const metadataResponse = await fetch(song.metadataUri);
      if (metadataResponse.ok) {
        metadata = await metadataResponse.json();
      }
    } catch (error) {
      console.warn(`Failed to fetch metadata from ${song.metadataUri}:`, error);
    }
  }

  return {
    geniusId: song.geniusId,
    title: metadata.title,
    artist: metadata.artist,
    coverUri: metadata.coverUri,
    metadataUri: song.metadataUri,
  };
}
