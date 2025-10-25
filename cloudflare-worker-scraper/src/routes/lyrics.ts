/**
 * Lyrics Enrichment Routes
 * Fetches lyrics from LRCLIB for Spotify tracks
 */

import { Hono } from 'hono';
import { NeonDB } from '../neon';
import { LRCLIBService, calculateMatchScore } from '../lrclib';
import type { Env } from '../types';

const lyrics = new Hono<{ Bindings: Env }>();

/**
 * POST /enrich-lyrics
 * Fetch lyrics for tracks with ISWC (filtered by has_iswc = true)
 */
lyrics.post('/enrich-lyrics', async (c) => {
  const db = new NeonDB(c.env.NEON_DATABASE_URL);
  const lrclib = new LRCLIBService();
  const limit = parseInt(c.req.query('limit') || '20');

  // Only fetch lyrics for tracks with ISWC (viable for karaoke)
  const tracksNeedingLyrics = await db.sql`
    SELECT
      st.spotify_track_id,
      st.title,
      st.artists[1] as artist,
      st.album as album_name,
      ROUND(st.duration_ms / 1000) as duration
    FROM spotify_tracks st
    LEFT JOIN spotify_track_lyrics stl
      ON st.spotify_track_id = stl.spotify_track_id
    WHERE st.has_iswc = true
      AND st.duration_ms IS NOT NULL
      AND st.artists IS NOT NULL
      AND st.album IS NOT NULL
      AND stl.spotify_track_id IS NULL
    LIMIT ${limit}
  `;

  if (tracksNeedingLyrics.length === 0) {
    return c.json({ message: 'No tracks need lyrics enrichment' });
  }

  console.log(`Enriching lyrics for ${tracksNeedingLyrics.length} tracks...`);

  let enriched = 0;
  let instrumental = 0;
  let notFound = 0;
  const results = [];

  for (const track of tracksNeedingLyrics) {
    try {
      // Step 1: Try exact match with GET API
      let lyricsData = await lrclib.getLyrics({
        track_name: track.title,
        artist_name: track.artist,
        album_name: track.album_name,
        duration: track.duration,
      });

      let confidenceScore = 1.0;

      // Step 2: Fallback to search if exact match fails
      if (!lyricsData) {
        const searchResults = await lrclib.searchLyrics({
          track_name: track.title,
          artist_name: track.artist,
        });

        if (searchResults.length > 0) {
          // Score and pick best match
          const scoredResults = searchResults.map(result => ({
            result,
            score: calculateMatchScore(result, {
              title: track.title,
              artist: track.artist,
              album: track.album_name,
              duration: track.duration,
            }),
          }));

          // Filter by confidence threshold (0.7)
          const bestMatch = scoredResults
            .filter(s => s.score >= 0.7)
            .sort((a, b) => b.score - a.score)[0];

          if (bestMatch) {
            lyricsData = bestMatch.result;
            confidenceScore = bestMatch.score;
          }
        }
      }

      // Store result
      if (lyricsData) {
        await db.upsertLyrics(track.spotify_track_id, lyricsData, confidenceScore);

        if (lyricsData.instrumental) {
          instrumental++;
        } else {
          enriched++;
        }

        results.push({
          track: track.title,
          artist: track.artist,
          lrclib_id: lyricsData.id,
          has_synced: !!lyricsData.syncedLyrics,
          instrumental: lyricsData.instrumental,
          confidence: confidenceScore,
        });
      } else {
        notFound++;
      }
    } catch (error) {
      console.error(`Failed to enrich lyrics for ${track.title}:`, error);
      notFound++;
    }
  }

  return c.json({
    success: true,
    service: 'lrclib',
    enriched,
    instrumental,
    notFound,
    total: tracksNeedingLyrics.length,
    sample: results.slice(0, 5),
  });
});

/**
 * GET /lyrics/:spotify_track_id
 * Get lyrics for a specific track
 */
lyrics.get('/lyrics/:spotify_track_id', async (c) => {
  const db = new NeonDB(c.env.NEON_DATABASE_URL);
  const spotifyTrackId = c.req.param('spotify_track_id');

  const result = await db.sql`
    SELECT
      stl.*,
      st.title,
      st.artists,
      st.album_name
    FROM spotify_track_lyrics stl
    JOIN spotify_tracks st ON stl.spotify_track_id = st.spotify_track_id
    WHERE stl.spotify_track_id = ${spotifyTrackId}
  `;

  if (result.length === 0) {
    return c.json({ error: 'Lyrics not found' }, 404);
  }

  return c.json(result[0]);
});

/**
 * GET /lyrics-stats
 * Get lyrics enrichment statistics
 */
lyrics.get('/lyrics-stats', async (c) => {
  const db = new NeonDB(c.env.NEON_DATABASE_URL);

  const stats = await db.sql`
    SELECT
      COUNT(*) FILTER (WHERE stl.spotify_track_id IS NOT NULL) as total_with_lyrics,
      COUNT(*) FILTER (WHERE stl.synced_lyrics IS NOT NULL) as total_synced,
      COUNT(*) FILTER (WHERE stl.instrumental = true) as total_instrumental,
      COUNT(*) FILTER (WHERE stl.confidence_score < 1.0) as total_fuzzy_match,
      AVG(stl.confidence_score) as avg_confidence
    FROM spotify_tracks st
    LEFT JOIN spotify_track_lyrics stl ON st.spotify_track_id = stl.spotify_track_id
    WHERE st.has_iswc = true
  `;

  const pending = await db.sql`
    SELECT COUNT(*) as count
    FROM spotify_tracks st
    LEFT JOIN spotify_track_lyrics stl ON st.spotify_track_id = stl.spotify_track_id
    WHERE st.has_iswc = true
      AND st.duration_ms IS NOT NULL
      AND stl.spotify_track_id IS NULL
  `;

  return c.json({
    stats: stats[0],
    pending: pending[0].count,
  });
});

export default lyrics;
