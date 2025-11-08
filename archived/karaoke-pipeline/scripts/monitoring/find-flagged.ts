#!/usr/bin/env bun
import { query, close } from '../../src/db/neon';

const result = await query<{
  spotify_track_id: string;
  title: string;
  artists: string | string[];
  source: string;
  confidence_score: number | null;
  has_lrclib: boolean;
  has_ovh: boolean;
}>(`
  SELECT
    sl.spotify_track_id,
    st.title,
    st.artists,
    sl.source,
    sl.confidence_score,
    sl.lrclib_lyrics IS NOT NULL as has_lrclib,
    sl.ovh_lyrics IS NOT NULL as has_ovh
  FROM song_lyrics sl
  JOIN spotify_tracks st ON sl.spotify_track_id = st.spotify_track_id
  WHERE sl.source = 'needs_review'
  ORDER BY sl.confidence_score DESC
  LIMIT 10
`);

console.log('📋 Flagged tracks in database:\n');
for (const row of result) {
  const artists = Array.isArray(row.artists)
    ? row.artists.map((a: any) => typeof a === 'string' ? a : a.name).join(', ')
    : row.artists;
  console.log(`  ${row.title} - ${artists}`);
  console.log(`    ID: ${row.spotify_track_id}`);
  console.log(`    Confidence: ${row.confidence_score}`);
  console.log(`    Sources: LRCLIB=${row.has_lrclib}, OVH=${row.has_ovh}`);
  console.log('');
}

await close();
