/**
 * Status Reconciliation Utility
 *
 * Ensures song_pipeline.status matches actual data state across all tables.
 * Run this before each orchestrator cycle to self-heal status inconsistencies.
 *
 * Design: Status is derived from data, not trusted as source of truth.
 */

import { neon } from '@neondatabase/serverless';

interface ReconciliationResult {
  tracksChecked: number;
  tracksFixed: number;
  statusChanges: Array<{
    spotify_track_id: string;
    title: string;
    oldStatus: string;
    newStatus: string;
    reason: string;
  }>;
}

/**
 * Reconcile all track statuses based on actual data state
 */
export async function reconcileAllStatuses(databaseUrl: string): Promise<ReconciliationResult> {
  const sql = neon(databaseUrl);

  console.log('🔍 Reconciling track statuses...');

  // Query all tracks with their actual data state
  const tracks = await sql`
    SELECT
      sp.id,
      sp.spotify_track_id,
      st.title,
      sp.status as current_status,

      -- Check data existence across all tables
      st.spotify_track_id IS NOT NULL as has_spotify_metadata,
      sp.iswc IS NOT NULL as has_iswc,
      sl.normalized_lyrics IS NOT NULL as has_lyrics,
      sa.grove_cid IS NOT NULL as has_audio,
      ewa.total_words IS NOT NULL as has_alignment,
      EXISTS(
        SELECT 1 FROM lyrics_translations lt
        WHERE lt.spotify_track_id = sp.spotify_track_id
        LIMIT 1
      ) as has_translations,
      sa.instrumental_grove_cid IS NOT NULL as has_stems,
      ks.clip_start_ms IS NOT NULL as has_segment_selection,
      ks.fal_enhanced_grove_cid IS NOT NULL as has_fal_enhancement,
      ks.clip_cropped_grove_cid IS NOT NULL as has_clip_cropped

    FROM song_pipeline sp
    LEFT JOIN spotify_tracks st ON sp.spotify_track_id = st.spotify_track_id
    LEFT JOIN song_lyrics sl ON sp.spotify_track_id = sl.spotify_track_id
    LEFT JOIN song_audio sa ON sp.spotify_track_id = sa.spotify_track_id
    LEFT JOIN elevenlabs_word_alignments ewa ON sp.spotify_track_id = ewa.spotify_track_id
    LEFT JOIN karaoke_segments ks ON sp.spotify_track_id = ks.spotify_track_id
    WHERE sp.status != 'failed'
    ORDER BY sp.id
  `;

  const statusChanges: ReconciliationResult['statusChanges'] = [];

  for (const track of tracks) {
    const correctStatus = computeCorrectStatus(track);

    if (correctStatus !== track.current_status) {
      statusChanges.push({
        spotify_track_id: track.spotify_track_id,
        title: track.title || 'Unknown',
        oldStatus: track.current_status,
        newStatus: correctStatus,
        reason: getStatusChangeReason(track, correctStatus)
      });
    }
  }

  // Apply all status changes in batch
  if (statusChanges.length > 0) {
    console.log(`📝 Fixing ${statusChanges.length} status inconsistencies...`);

    for (const change of statusChanges) {
      await sql`
        UPDATE song_pipeline
        SET status = ${change.newStatus},
            updated_at = NOW()
        WHERE spotify_track_id = ${change.spotify_track_id}
      `;
    }

    // Log changes
    console.log('\n✅ Status Changes Applied:');
    for (const change of statusChanges) {
      console.log(`   ${change.title}`);
      console.log(`     ${change.oldStatus} → ${change.newStatus}`);
      console.log(`     Reason: ${change.reason}`);
    }
  } else {
    console.log('✅ All statuses correct, no changes needed');
  }

  return {
    tracksChecked: tracks.length,
    tracksFixed: statusChanges.length,
    statusChanges
  };
}

/**
 * Compute correct status based on actual data state
 *
 * Status flow:
 * tiktok_scraped → spotify_resolved → iswc_found → metadata_enriched →
 * lyrics_ready → audio_downloaded → alignment_complete → translations_ready →
 * stems_separated → segments_selected → enhanced → clips_cropped
 */
function computeCorrectStatus(track: any): string {
  // Work backwards from most complete state
  if (track.has_clip_cropped) return 'clips_cropped';
  if (track.has_fal_enhancement) return 'enhanced';
  if (track.has_segment_selection) return 'segments_selected';
  if (track.has_stems) return 'stems_separated';
  if (track.has_translations) return 'translations_ready';
  if (track.has_alignment) return 'alignment_complete';
  if (track.has_audio) return 'audio_downloaded';
  if (track.has_lyrics) return 'lyrics_ready';

  // Optional metadata steps (can be skipped)
  if (track.current_status === 'metadata_enriched') return 'metadata_enriched';
  if (track.current_status === 'iswc_found') return 'iswc_found';

  if (track.has_spotify_metadata) return 'spotify_resolved';

  return 'tiktok_scraped';
}

/**
 * Generate human-readable reason for status change
 */
function getStatusChangeReason(track: any, newStatus: string): string {
  const reasons: string[] = [];

  if (newStatus === 'clips_cropped' && track.has_clip_cropped) {
    reasons.push('Has cropped clip');
  }
  if (newStatus === 'enhanced' && track.has_fal_enhancement) {
    reasons.push('Has fal.ai enhancement');
  }
  if (newStatus === 'segments_selected' && track.has_segment_selection) {
    reasons.push('Has segment selection');
  }
  if (newStatus === 'stems_separated' && track.has_stems) {
    reasons.push('Has instrumental stems');
  }
  if (newStatus === 'translations_ready' && track.has_translations) {
    reasons.push('Has translations');
  }
  if (newStatus === 'alignment_complete' && track.has_alignment) {
    reasons.push('Has word alignment');
  }
  if (newStatus === 'audio_downloaded' && track.has_audio) {
    reasons.push('Has audio on Grove');
  }
  if (newStatus === 'lyrics_ready' && track.has_lyrics) {
    reasons.push('Has normalized lyrics');
  }

  return reasons.join(', ') || 'Status correction';
}

/**
 * CLI entry point
 */
if (import.meta.main) {
  const DATABASE_URL = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;

  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL not set');
    process.exit(1);
  }

  reconcileAllStatuses(DATABASE_URL)
    .then(result => {
      console.log(`\n📊 Summary:`);
      console.log(`   Tracks checked: ${result.tracksChecked}`);
      console.log(`   Tracks fixed: ${result.tracksFixed}`);
      console.log(`   Accuracy: ${((1 - result.tracksFixed / result.tracksChecked) * 100).toFixed(1)}%`);
    })
    .catch(error => {
      console.error('❌ Reconciliation failed:', error);
      process.exit(1);
    });
}
