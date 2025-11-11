#!/usr/bin/env bun
import 'dotenv/config';

import { query } from '../../db/connection';

async function main() {
  const limit = Number(process.argv[2] || '5');

  const segments = await query<{
    spotify_track_id: string;
    fal_enhanced_grove_url: string | null;
    fal_request_id: string | null;
    clip_start_ms: number | null;
    clip_end_ms: number | null;
    grc20_entity_id: string | null;
    work_title: string | null;
    artist_name: string | null;
    cover_url: string | null;
    clip_grove_url: string | null;
    has_hash: boolean | null;
  }>(
    `SELECT
      ks.spotify_track_id,
      ks.fal_request_id,
      ks.fal_enhanced_grove_url,
      ks.clip_start_ms,
      ks.clip_end_ms,
      ks.clip_grove_url,
      gw.grc20_entity_id,
      gw.title AS work_title,
      gw.primary_artist_name AS artist_name,
      gw.image_url AS cover_url,
      COALESCE(line_state.has_hash, FALSE) AS has_hash
    FROM karaoke_segments ks
    LEFT JOIN spotify_tracks st ON st.spotify_track_id = ks.spotify_track_id
    LEFT JOIN grc20_works gw ON gw.spotify_track_id = ks.spotify_track_id
    LEFT JOIN LATERAL (
      SELECT BOOL_OR(segment_hash IS NOT NULL) AS has_hash
        FROM karaoke_lines kl
       WHERE kl.spotify_track_id = ks.spotify_track_id
    ) AS line_state ON TRUE
    ORDER BY ks.updated_at DESC
    LIMIT $1`,
    [limit]
  );

  if (segments.length === 0) {
    console.log('No segments found.');
    return;
  }

  for (const segment of segments) {
    console.log(JSON.stringify(segment, null, 2));
  }
}

main().catch((error) => {
  console.error('Failed to list segments:', error);
  process.exit(1);
});
