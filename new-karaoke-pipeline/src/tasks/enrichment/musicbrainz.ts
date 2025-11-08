/**
 * MusicBrainz Enrichment Task Processor
 *
 * Enriches tracks with MusicBrainz data:
 * 1. Check cache (musicbrainz_recordings)
 * 2. Lookup recording by ISRC
 * 3. Fetch work (composition) data
 * 4. Fetch performer and contributor artists
 * 5. Store all data for future reference
 */

import {
  getPendingEnrichmentTasks,
  updateEnrichmentTask,
} from '../../db/queries';
import { query } from '../../db/connection';
import {
  lookupRecordingByISRC,
  lookupWork,
  lookupArtist,
  type MBRecording,
  type MBWork,
  type MBArtist,
} from '../../services/musicbrainz';
import {
  upsertMBRecordingSQL,
  upsertMBWorkSQL,
  upsertMBArtistSQL,
} from '../../db/musicbrainz';

interface MusicBrainzResult {
  recording_mbid: string;
  work_mbid: string | null;
  performers: number;
  contributors: number;
}

/**
 * Check cache for existing MusicBrainz data
 */
async function getMusicBrainzFromCache(isrc: string): Promise<MusicBrainzResult | null> {
  const cached = await query<{
    recording_mbid: string;
    work_mbid: string | null;
  }>(`
    SELECT recording_mbid, work_mbid
    FROM musicbrainz_recordings
    WHERE isrc = $1
    LIMIT 1
  `, [isrc]);

  if (cached[0]) {
    return {
      recording_mbid: cached[0].recording_mbid,
      work_mbid: cached[0].work_mbid,
      performers: 0,
      contributors: 0,
    };
  }

  return null;
}

/**
 * Fetch MusicBrainz data via API
 */
async function fetchMusicBrainzData(
  isrc: string,
  spotifyTrackId: string
): Promise<MusicBrainzResult | null> {
  // Step 1: Lookup recording by ISRC
  const recording = await lookupRecordingByISRC(isrc);

  if (!recording) {
    return null;
  }

  console.log(`     ✅ Recording: ${recording.title}`);
  console.log(`        MBID: ${recording.id}`);

  // Store recording
  const recordingSQL = upsertMBRecordingSQL(recording, isrc, spotifyTrackId, recording);
  await query(recordingSQL);

  let performerCount = 0;
  let contributorCount = 0;
  let workMbid: string | null = null;

  // Step 2: Fetch full performer data (with ISNIs, IPIs, members)
  const artistCredit = recording['artist-credit'];
  if (artistCredit && Array.isArray(artistCredit)) {
    performerCount = artistCredit.length;
    console.log(`     🎤 Performers: ${performerCount}`);

    // Store first 3 performers with full data lookup (rate limit friendly)
    for (const credit of artistCredit.slice(0, 3)) {
      try {
        // Do full artist lookup to get ISNIs, IPIs, and member relationships
        const fullArtist = await lookupArtist(credit.artist.id);
        if (fullArtist) {
          const artistSQL = upsertMBArtistSQL(fullArtist);
          await query(artistSQL);

          // Log if we found ISNIs/members
          if (fullArtist.isnis && fullArtist.isnis.length > 0) {
            console.log(`        📋 ${fullArtist.name}: ${fullArtist.isnis.length} ISNI(s)`);
          }
        } else {
          // Fallback to minimal data if full lookup fails
          const artistSQL = upsertMBArtistSQL(credit.artist as MBArtist);
          await query(artistSQL);
        }
      } catch (error: any) {
        console.warn(`        ⚠️  Failed to store ${credit.artist.name}`);
      }
    }
  }

  // Step 3: Lookup work if linked
  const workRel = recording.relations?.find(
    rel => rel.type === 'performance' && rel.work
  );

  if (workRel?.work) {
    workMbid = workRel.work.id;
    console.log(`     ✅ Work: ${workRel.work.title}`);
    console.log(`        MBID: ${workMbid}`);

    // Fetch full work details
    const work = await lookupWork(workMbid);

    if (work) {
      contributorCount = work.relations?.filter(r => r.artist).length || 0;
      console.log(`        Contributors: ${contributorCount}`);

      // Store work
      const workSQL = upsertMBWorkSQL(work);
      await query(workSQL);

      // Store first 3 contributors (composers/lyricists) with full data
      const artists = work.relations
        ?.filter(rel => rel.artist)
        .map(rel => rel.artist!) || [];

      for (const artist of artists.slice(0, 3)) {
        try {
          // Do full artist lookup to get ISNIs, IPIs, and member relationships
          const fullArtist = await lookupArtist(artist.id);
          if (fullArtist) {
            const artistSQL = upsertMBArtistSQL(fullArtist);
            await query(artistSQL);

            // Log if we found ISNIs
            if (fullArtist.isnis && fullArtist.isnis.length > 0) {
              console.log(`        📋 ${fullArtist.name}: ${fullArtist.isnis.length} ISNI(s)`);
            }
          } else {
            // Fallback to minimal data if full lookup fails
            const artistSQL = upsertMBArtistSQL(artist);
            await query(artistSQL);
          }
        } catch (error: any) {
          console.warn(`        ⚠️  Failed to store ${artist.name || artist.id}`);
        }
      }
    }
  } else {
    console.log(`     ⚠️  No work linked`);
  }

  return {
    recording_mbid: recording.id,
    work_mbid: workMbid,
    performers: performerCount,
    contributors: contributorCount,
  };
}

/**
 * Main MusicBrainz enrichment processor
 */
export async function processMusicBrainzEnrichment(limit: number = 50): Promise<void> {
  console.log(`\n🎵 MusicBrainz Enrichment Task Processor (limit: ${limit})\n`);

  // Get pending tasks
  const tasks = await getPendingEnrichmentTasks('musicbrainz', limit);

  if (tasks.length === 0) {
    console.log('✅ No pending MusicBrainz enrichment tasks\n');
    return;
  }

  console.log(`Found ${tasks.length} pending tasks\n`);

  let completedCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  for (const task of tasks) {
    // Get track details
    const tracks = await query<{
      title: string;
      artists: Array<{ name: string }>;
      isrc: string | null;
    }>(`
      SELECT title, artists, isrc
      FROM tracks
      WHERE spotify_track_id = $1
    `, [task.spotify_track_id]);

    if (tracks.length === 0) {
      console.log(`   ⚠️ Track ${task.spotify_track_id} not found, skipping`);
      await updateEnrichmentTask(task.id, { status: 'skipped' });
      skippedCount++;
      continue;
    }

    const track = tracks[0];
    const isrc = track.isrc;

    if (!isrc) {
      console.log(`   ⚠️ ${track.title} - No ISRC, marking as skipped`);
      await updateEnrichmentTask(task.id, { status: 'skipped' });
      skippedCount++;
      continue;
    }

    const artistName = track.artists[0]?.name || 'Unknown';
    console.log(`   🎵 ${track.title} by ${artistName} (ISRC: ${isrc})`);

    try {
      // Step 1: Check cache
      const cachedData = await getMusicBrainzFromCache(isrc);
      if (cachedData) {
        console.log(`      ✅ Found in cache: ${cachedData.recording_mbid}`);
        await updateEnrichmentTask(task.id, {
          status: 'completed',
          source: 'cache',
          result_data: cachedData,
        });
        completedCount++;
        continue;
      }

      // Step 2: Fetch from MusicBrainz API
      console.log(`      🔍 Fetching from MusicBrainz...`);
      const mbData = await fetchMusicBrainzData(isrc, task.spotify_track_id);

      if (!mbData) {
        console.log(`      ❌ Recording not found in MusicBrainz`);
        await updateEnrichmentTask(task.id, {
          status: 'failed',
          error_message: 'Recording not found in MusicBrainz',
        });
        failedCount++;
        continue;
      }

      console.log(`      ✅ Enriched with MusicBrainz data`);
      await updateEnrichmentTask(task.id, {
        status: 'completed',
        source: 'musicbrainz_api',
        result_data: mbData,
      });
      completedCount++;

    } catch (error: any) {
      console.log(`      ❌ Error: ${error.message}`);
      await updateEnrichmentTask(task.id, {
        status: 'failed',
        error_message: error.message,
      });
      failedCount++;
    }

    // Rate limit: 1 request/second
    await new Promise(resolve => setTimeout(resolve, 1100));
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Completed: ${completedCount}`);
  console.log(`   ❌ Failed: ${failedCount}`);
  console.log(`   ⏭️ Skipped: ${skippedCount}`);
  console.log('');
}

// Run if called directly
if (import.meta.main) {
  const limit = parseInt(process.argv[2]) || 50;
  processMusicBrainzEnrichment(limit)
    .catch(error => {
      console.error('❌ MusicBrainz enrichment failed:', error);
      process.exit(1);
    });
}
