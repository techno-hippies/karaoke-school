#!/usr/bin/env bun
/**
 * Processor: Enrich with MusicBrainz
 * Looks up recordings, works, and artists in MusicBrainz for canonical IDs
 *
 * Usage:
 *   bun src/processors/04-enrich-musicbrainz.ts [batchSize]
 */

import { query, transaction, close } from '../db/neon';
import {
  lookupRecordingByISRC,
  lookupWork,
  lookupWorkByISWC,
  lookupArtist,
} from '../services/musicbrainz';
import {
  upsertMBRecordingSQL,
  upsertMBWorkSQL,
  upsertMBArtistSQL,
  updatePipelineMBSQL,
  logMBProcessingSQL,
} from '../db/musicbrainz';

async function main() {
  const args = process.argv.slice(2);
  const batchSize = args[0] ? parseInt(args[0]) : 10;

  console.log('🎵 MusicBrainz Enrichment');
  console.log(`📊 Batch size: ${batchSize}`);
  console.log('');

  // Find tracks that need MusicBrainz enrichment
  console.log('⏳ Finding tracks ready for MusicBrainz enrichment...');

  const tracksToProcess = await query<{
    id: number;
    tiktok_video_id: string;
    spotify_track_id: string;
    spotify_artist_id: string;
    isrc: string;
    iswc: string | null;
    title: string;
  }>(`
    SELECT
      tp.id,
      tp.tiktok_video_id,
      tp.spotify_track_id,
      tp.spotify_artist_id,
      st.isrc,
      tp.iswc,
      st.title
    FROM song_pipeline tp
    JOIN spotify_tracks st ON tp.spotify_track_id = st.spotify_track_id
    WHERE tp.status = 'iswc_found'
      AND st.isrc IS NOT NULL
    ORDER BY tp.id
    LIMIT ${batchSize}
  `);

  if (tracksToProcess.length === 0) {
    console.log('✅ No tracks need MusicBrainz enrichment. All caught up!');
    return;
  }

  console.log(`✅ Found ${tracksToProcess.length} tracks to process`);
  console.log('');

  // Check cache for existing MusicBrainz data
  const isrcs = tracksToProcess.map(t => t.isrc);
  const cachedRecordings = await query<{
    isrc: string;
    recording_mbid: string;
    work_mbid: string | null;
  }>(`
    SELECT isrc, recording_mbid, work_mbid
    FROM musicbrainz_recordings
    WHERE isrc = ANY(ARRAY[${isrcs.map(isrc => `'${isrc}'`).join(',')}])
  `);

  const cachedISRCs = new Set(cachedRecordings.map(r => r.isrc));
  const uncachedTracks = tracksToProcess.filter(t => !cachedISRCs.has(t.isrc));

  console.log(`💾 Cache hits: ${cachedRecordings.length}`);
  console.log(`🌐 API requests needed: ${uncachedTracks.length}`);
  console.log('');

  // Fetch uncached tracks from MusicBrainz API
  const sqlStatements: string[] = [];
  let successCount = 0;
  let failCount = 0;

  if (uncachedTracks.length > 0) {
    console.log('⏳ Fetching from MusicBrainz...');

    for (const track of uncachedTracks) {
      try {
        console.log(`  🔍 ${track.title} (${track.isrc})`);

        // Step 1: Lookup recording by ISRC
        const recording = await lookupRecordingByISRC(track.isrc);

        if (!recording) {
          console.log(`     ❌ Recording not found in MusicBrainz`);

          // Still move pipeline forward (fault-tolerant)
          sqlStatements.push(
            updatePipelineMBSQL(track.spotify_track_id, null, null)
          );

          sqlStatements.push(
            logMBProcessingSQL(
              track.spotify_track_id,
              'success',
              'Recording not found in MusicBrainz, continuing without MB data'
            )
          );
          failCount++;
          continue;
        }

        console.log(`     ✅ Recording: ${recording.title}`);
        console.log(`        MBID: ${recording.id}`);

        // Store recording
        sqlStatements.push(upsertMBRecordingSQL(recording, track.isrc));

        // Step 2: Fetch PERFORMER artists from recording credits
        const artistCredit = recording['artist-credit'];
        const performerCount = artistCredit?.length || 0;
        console.log(`     🎤 Performers: ${performerCount}`);

        if (artistCredit && Array.isArray(artistCredit)) {
          for (const credit of artistCredit.slice(0, 3)) {
            try {
              const artist = await lookupArtist(credit.artist.id);
              if (artist) {
                console.log(`        ✅ ${artist.name}`);
                sqlStatements.push(upsertMBArtistSQL(artist));
              }
            } catch (error: any) {
              console.warn(`        ⚠️  Failed to fetch performer ${credit.artist.name}`);
            }
          }
        }

        // Step 3: Lookup work if linked
        const workRel = recording.relations?.find(
          rel => rel.type === 'performance' && rel.work
        );

        let workMbid: string | null = null;

        if (workRel?.work) {
          workMbid = workRel.work.id;
          console.log(`     ✅ Work: ${workRel.work.title}`);
          console.log(`        MBID: ${workMbid}`);

          // Fetch full work details by MBID
          const work = await lookupWork(workMbid);

          if (work) {
            console.log(`        Contributors: ${work.relations?.filter(r => r.artist).length || 0}`);
            sqlStatements.push(upsertMBWorkSQL(work));

            // Step 4: Fetch artist details for contributors (composers/lyricists)
            const artistMbids = work.relations
              ?.filter(rel => rel.artist)
              .map(rel => rel.artist!.id) || [];

            for (const artistMbid of artistMbids.slice(0, 3)) { // Limit to 3 to avoid rate limits
              try {
                const artist = await lookupArtist(artistMbid);
                if (artist) {
                  sqlStatements.push(
                    upsertMBArtistSQL(artist)
                  );
                }
              } catch (error: any) {
                console.warn(`        ⚠️  Failed to fetch artist ${artistMbid}`);
              }
            }
          }
        } else {
          console.log(`     ⚠️  No work linked`);
        }

        // Update pipeline
        sqlStatements.push(
          updatePipelineMBSQL(track.spotify_track_id, recording.id, workMbid)
        );

        // Log success
        sqlStatements.push(
          logMBProcessingSQL(
            track.spotify_track_id,
            'success',
            'MusicBrainz enrichment complete',
            {
              recording_mbid: recording.id,
              work_mbid: workMbid,
            }
          )
        );

        successCount++;
      } catch (error: any) {
        console.log(`     ❌ Error: ${error.message}`);
        sqlStatements.push(
          logMBProcessingSQL(
            track.spotify_track_id,
            'failed',
            error.message
          )
        );
        failCount++;
      }
    }

    console.log('');
  }

  // Update pipeline status for cached tracks
  console.log('⏳ Updating pipeline entries...');

  for (const track of tracksToProcess.filter(t => cachedISRCs.has(t.isrc))) {
    const cached = cachedRecordings.find(r => r.isrc === track.isrc);
    if (cached) {
      sqlStatements.push(
        updatePipelineMBSQL(
          track.spotify_track_id,
          cached.recording_mbid,
          cached.work_mbid
        )
      );

      sqlStatements.push(
        logMBProcessingSQL(
          track.spotify_track_id,
          'success',
          'Used cached MusicBrainz data',
          { source: 'cache' }
        )
      );
    }
  }

  // Execute all SQL statements
  if (sqlStatements.length > 0) {
    try {
      await transaction(sqlStatements);
      console.log(`✅ Executed ${sqlStatements.length} SQL statements`);
    } catch (error) {
      console.error('❌ Failed to execute transaction:', error);
      throw error;
    }
  }

  console.log('');
  console.log('📊 Summary:');
  console.log(`   - Total tracks: ${tracksToProcess.length}`);
  console.log(`   - Cache hits: ${cachedRecordings.length}`);
  console.log(`   - API fetches: ${successCount}`);
  console.log(`   - Failed: ${failCount}`);
  console.log('');
  console.log('✅ Done! Tracks moved to: metadata_enriched');
}

/**
 * Export function for orchestrator
 */
export async function processMusicBrainzEnrichment(_env: any, limit: number = 50): Promise<void> {
  console.log(`[Step 4] MusicBrainz Enrichment (limit: ${limit})`);

  const tracksToProcess = await query<{
    id: number;
    tiktok_video_id: string;
    spotify_track_id: string;
    spotify_artist_id: string;
    isrc: string;
    iswc: string | null;
    title: string;
  }>(`
    SELECT
      tp.id,
      tp.tiktok_video_id,
      tp.spotify_track_id,
      tp.spotify_artist_id,
      st.isrc,
      tp.iswc,
      st.title
    FROM song_pipeline tp
    JOIN spotify_tracks st ON tp.spotify_track_id = st.spotify_track_id
    WHERE tp.status = 'iswc_found'
      AND st.isrc IS NOT NULL
    ORDER BY tp.id
    LIMIT ${limit}
  `);

  if (tracksToProcess.length === 0) {
    console.log('✓ No tracks need MusicBrainz enrichment');
    return;
  }

  console.log(`Found ${tracksToProcess.length} tracks`);

  const isrcs = tracksToProcess.map(t => t.isrc);
  const cachedRecordings = await query<{
    isrc: string;
    recording_mbid: string;
    work_mbid: string | null;
  }>(`
    SELECT isrc, recording_mbid, work_mbid
    FROM musicbrainz_recordings
    WHERE isrc = ANY(ARRAY[${isrcs.map(isrc => `'${isrc}'`).join(',')}])
  `);

  const cachedISRCs = new Set(cachedRecordings.map(r => r.isrc));
  const uncachedTracks = tracksToProcess.filter(t => !cachedISRCs.has(t.isrc));

  console.log(`   Cache hits: ${cachedRecordings.length}, API requests: ${uncachedTracks.length}`);

  const sqlStatements: string[] = [];
  let successCount = 0;
  let failCount = 0;

  for (const track of uncachedTracks) {
    try {
      const recording = await lookupRecordingByISRC(track.isrc);

      if (!recording) {
        failCount++;
        sqlStatements.push(
          logMBProcessingSQL(
            track.spotify_track_id,
            'failed',
            'Recording not found in MusicBrainz',
            { isrc: track.isrc }
          )
        );
        continue;
      }

      sqlStatements.push(upsertMBRecordingSQL(recording));

      if (recording.work_mbid) {
        const work = await lookupWork(recording.work_mbid);
        if (work) {
          sqlStatements.push(upsertMBWorkSQL(work));
        }
      }

      for (const credit of recording['artist-credit'] || []) {
        try {
          const artist = await lookupArtist(credit.artist.id);
          if (artist) {
            sqlStatements.push(upsertMBArtistSQL(artist));
          }
        } catch (error) {
          // Continue on artist error
        }
      }

      sqlStatements.push(
        updatePipelineMBSQL(
          track.spotify_track_id,
          recording.id,
          recording.work_mbid
        )
      );

      sqlStatements.push(
        logMBProcessingSQL(
          track.spotify_track_id,
          'success',
          'Enriched with MusicBrainz data',
          { recording_mbid: recording.id }
        )
      );

      successCount++;
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error: any) {
      failCount++;
      sqlStatements.push(
        logMBProcessingSQL(
          track.spotify_track_id,
          'failed',
          error.message,
          { isrc: track.isrc }
        )
      );
    }
  }

  // Add cached tracks
  for (const cached of cachedRecordings) {
    const track = tracksToProcess.find(t => t.isrc === cached.isrc);
    if (track) {
      sqlStatements.push(
        updatePipelineMBSQL(
          track.spotify_track_id,
          cached.recording_mbid,
          cached.work_mbid
        )
      );
    }
  }

  if (sqlStatements.length > 0) {
    await transaction(sqlStatements);
  }

  console.log(`✅ Step 4 Complete: ${successCount} fetched, ${failCount} failed`);
}

// Only run main() if this file is executed directly, not when imported
if (import.meta.main) {
  main()
    .catch((error) => {
      console.error('❌ Fatal error:', error);
      process.exit(1);
    })
    .finally(async () => {
      await close();
    });
}
