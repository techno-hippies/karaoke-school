/**
 * Pipeline Integrity Check
 * 
 * Validates data consistency across all pipeline stages and identifies systematic issues.
 * Run this after batch operations (minting, transcription, etc.) to catch problems early.
 * 
 * Usage:
 *   dotenvx run -f .env -- bun run scripts/validation/check-pipeline-integrity.ts
 */

import { query } from '../../src/db/neon';

interface PipelineStats {
  stage: string;
  count: number;
  pct?: number;
}

interface IntegrityIssue {
  check: string;
  severity: 'critical' | 'warning' | 'info';
  count: number;
  message: string;
  fix_sql?: string;
}

async function checkPipelineIntegrity() {
  const issues: IntegrityIssue[] = [];
  
  console.log('🔍 Checking Pipeline Integrity...\n');
  
  // ===================================================================
  // 1. PIPELINE STAGE COUNTS
  // ===================================================================
  console.log('📊 PIPELINE STAGE COUNTS:');
  console.log('─'.repeat(60));
  
  const stages = await query<PipelineStats>(`
    WITH stage_counts AS (
      SELECT 
        COUNT(*) FILTER (WHERE is_copyrighted = true) as copyrighted_total,
        COUNT(*) FILTER (WHERE is_copyrighted = true AND grove_video_cid IS NOT NULL) as with_grove,
        COUNT(*) FILTER (WHERE is_copyrighted = true AND grove_video_cid IS NOT NULL AND story_ip_id IS NULL) as ready_for_story,
        COUNT(*) FILTER (WHERE story_ip_id IS NOT NULL) as already_minted
      FROM tiktok_videos
    ),
    transcription_counts AS (
      SELECT
        COUNT(*) FILTER (WHERE t.status = 'translated') as transcribed
      FROM tiktok_videos v
      JOIN tiktok_video_transcriptions t ON v.video_id = t.video_id
      WHERE v.is_copyrighted = true
        AND v.grove_video_cid IS NOT NULL
        AND v.story_ip_id IS NULL
    ),
    view_count AS (
      SELECT COUNT(*) as in_view FROM videos_ready_for_story_minting
    )
    SELECT 
      copyrighted_total,
      with_grove,
      ready_for_story,
      (SELECT transcribed FROM transcription_counts) as transcribed,
      (SELECT in_view FROM view_count) as in_view,
      already_minted
    FROM stage_counts
  `);
  
  const stats = stages[0];
  
  console.log(`  Copyrighted videos:           ${stats.copyrighted_total}`);
  console.log(`  With Grove upload:            ${stats.with_grove}`);
  console.log(`  Ready for Story (Grove + !minted): ${stats.ready_for_story}`);
  console.log(`  Transcribed & translated:     ${stats.transcribed}`);
  console.log(`  In view (ready to mint):      ${stats.in_view}`);
  console.log(`  Already minted to Story:      ${stats.already_minted}`);
  
  // Check for unexpected drops
  if (stats.in_view === 0 && stats.transcribed > 0) {
    issues.push({
      check: 'view_empty',
      severity: 'critical',
      count: stats.transcribed,
      message: `View is empty but ${stats.transcribed} videos are transcribed. View may be broken!`,
    });
  }
  
  if (stats.in_view < stats.transcribed * 0.5) {
    issues.push({
      check: 'low_success_rate',
      severity: 'warning',
      count: stats.transcribed - stats.in_view,
      message: `Only ${stats.in_view}/${stats.transcribed} transcribed videos appear in view (${Math.round(stats.in_view / stats.transcribed * 100)}%). Expected >50%.`,
    });
  }
  
  // ===================================================================
  // 2. GRC20 WORK MINTS INTEGRITY
  // ===================================================================
  console.log('\n🔗 GRC20 WORK MINTS INTEGRITY:');
  console.log('─'.repeat(60));
  
  // Check for missing genius_song_id in work mints
  const missingGeniusId = await query<{count: number}>(`
    SELECT COUNT(*) as count
    FROM grc20_work_mints gwm
    JOIN grc20_works gw ON gwm.iswc = gw.iswc
    WHERE gwm.genius_song_id IS NULL
      AND gw.genius_song_id IS NOT NULL
  `);
  
  if (missingGeniusId[0].count > 0) {
    issues.push({
      check: 'missing_genius_id',
      severity: 'critical',
      count: missingGeniusId[0].count,
      message: `${missingGeniusId[0].count} work mints missing genius_song_id (causes view JOIN failures)`,
      fix_sql: `UPDATE grc20_work_mints gwm SET genius_song_id = gw.genius_song_id FROM grc20_works gw WHERE gwm.iswc = gw.iswc AND gwm.genius_song_id IS NULL AND gw.genius_song_id IS NOT NULL;`
    });
  } else {
    console.log('  ✅ All work mints have genius_song_id populated');
  }
  
  // Check for missing ISWC in work mints (less critical but good to know)
  const missingIswc = await query<{count: number}>(`
    SELECT COUNT(*) as count
    FROM grc20_work_mints
    WHERE iswc IS NULL AND genius_song_id IS NOT NULL
  `);
  
  if (missingIswc[0].count > 0) {
    issues.push({
      check: 'missing_iswc',
      severity: 'info',
      count: missingIswc[0].count,
      message: `${missingIswc[0].count} work mints have genius_song_id but no ISWC (acceptable for works without ISWC)`
    });
  }
  
  // ===================================================================
  // 3. VIDEO BLOCKER ANALYSIS
  // ===================================================================
  console.log('\n🚫 VIDEO BLOCKER ANALYSIS:');
  console.log('─'.repeat(60));
  
  const blockers = await query<{blocker_reason: string, count: number}>(`
    WITH video_base AS (
      SELECT
        v.video_id,
        v.spotify_track_id,
        v.grove_video_cid,
        t.status as transcription_status
      FROM tiktok_videos v
      LEFT JOIN tiktok_video_transcriptions t ON v.video_id = t.video_id
      WHERE v.is_copyrighted = true
        AND v.grove_video_cid IS NOT NULL
        AND v.story_ip_id IS NULL
        AND v.story_mint_attempts < 3
    )
    SELECT
      CASE
        WHEN vb.transcription_status IS NULL THEN 'missing_transcription'
        WHEN vb.transcription_status != 'translated' THEN 'transcription_not_translated'
        WHEN st.spotify_track_id IS NULL THEN 'missing_spotify_track'
        WHEN gs.genius_song_id IS NULL THEN 'missing_genius_song'
        WHEN gw.id IS NULL THEN 'work_not_in_grc20_works'
        WHEN gwm.grc20_entity_id IS NULL THEN 'work_not_minted'
        WHEN grm.grc20_entity_id IS NULL THEN 'recording_not_minted'
        ELSE 'in_view'
      END AS blocker_reason,
      COUNT(*) as count
    FROM video_base vb
    LEFT JOIN spotify_tracks st ON st.spotify_track_id = vb.spotify_track_id
    LEFT JOIN genius_songs gs ON gs.spotify_track_id = vb.spotify_track_id
    LEFT JOIN grc20_works gw ON gw.genius_song_id = gs.genius_song_id
    LEFT JOIN grc20_work_mints gwm ON (
      (gwm.genius_song_id = gs.genius_song_id)
      OR (gwm.iswc = gw.iswc)
    )
    LEFT JOIN grc20_recording_mints grm ON grm.spotify_track_id = vb.spotify_track_id
    GROUP BY 1
    ORDER BY count DESC
  `);
  
  blockers.forEach(b => {
    const icon = b.blocker_reason === 'in_view' ? '✅' : '❌';
    console.log(`  ${icon} ${b.blocker_reason}: ${b.count} videos`);
    
    if (b.blocker_reason !== 'in_view' && b.count > 0) {
      let severity: 'critical' | 'warning' | 'info' = 'warning';
      let message = `${b.count} videos blocked by: ${b.blocker_reason}`;
      
      if (b.blocker_reason === 'work_not_minted' && b.count > 10) {
        severity = 'critical';
        message += ' - Run work minting script';
      } else if (b.blocker_reason === 'recording_not_minted' && b.count > 10) {
        severity = 'critical';
        message += ' - Run recording minting script';
      } else if (b.blocker_reason === 'missing_genius_song' && b.count > 5) {
        severity = 'warning';
        message += ' - Add genius_songs records';
      }
      
      issues.push({
        check: `blocker_${b.blocker_reason}`,
        severity,
        count: b.count,
        message
      });
    }
  });
  
  // ===================================================================
  // 4. DATA CONSISTENCY CHECKS
  // ===================================================================
  console.log('\n🔒 DATA CONSISTENCY CHECKS:');
  console.log('─'.repeat(60));
  
  // Check for recordings without works
  const recordingsWithoutWorks = await query<{count: number}>(`
    SELECT COUNT(*) as count
    FROM grc20_recording_mints grm
    LEFT JOIN grc20_works gw ON gw.genius_song_id IN (
      SELECT genius_song_id FROM genius_songs WHERE spotify_track_id = grm.spotify_track_id
    )
    WHERE gw.id IS NULL
  `);
  
  if (recordingsWithoutWorks[0].count > 0) {
    issues.push({
      check: 'recordings_without_works',
      severity: 'warning',
      count: recordingsWithoutWorks[0].count,
      message: `${recordingsWithoutWorks[0].count} recordings minted without corresponding works (videos can't be minted)`
    });
  } else {
    console.log('  ✅ All minted recordings have corresponding works');
  }
  
  // Check for Grove videos without transcriptions
  const groveWithoutTranscription = await query<{count: number}>(`
    SELECT COUNT(*) as count
    FROM tiktok_videos v
    LEFT JOIN tiktok_video_transcriptions t ON v.video_id = t.video_id
    WHERE v.is_copyrighted = true
      AND v.grove_video_cid IS NOT NULL
      AND t.video_id IS NULL
  `);
  
  if (groveWithoutTranscription[0].count > 0) {
    console.log(`  ℹ️  ${groveWithoutTranscription[0].count} Grove videos without transcriptions (need to process)`);
  } else {
    console.log('  ✅ All Grove videos have transcription records');
  }
  
  // ===================================================================
  // 5. SUMMARY & RECOMMENDATIONS
  // ===================================================================
  console.log('\n📝 SUMMARY:');
  console.log('─'.repeat(60));
  
  const critical = issues.filter(i => i.severity === 'critical');
  const warnings = issues.filter(i => i.severity === 'warning');
  const info = issues.filter(i => i.severity === 'info');
  
  if (critical.length === 0 && warnings.length === 0) {
    console.log('  ✅ Pipeline is healthy! No critical issues found.');
  } else {
    console.log(`  Found ${critical.length} critical issues, ${warnings.length} warnings, ${info.length} info`);
  }
  
  if (critical.length > 0) {
    console.log('\n🚨 CRITICAL ISSUES (fix immediately):');
    critical.forEach(issue => {
      console.log(`  ❌ ${issue.message}`);
      if (issue.fix_sql) {
        console.log(`     Fix: ${issue.fix_sql.substring(0, 80)}...`);
      }
    });
  }
  
  if (warnings.length > 0) {
    console.log('\n⚠️  WARNINGS (address soon):');
    warnings.forEach(issue => {
      console.log(`  ⚠️  ${issue.message}`);
    });
  }
  
  if (info.length > 0) {
    console.log('\n💡 INFO:');
    info.forEach(issue => {
      console.log(`  ℹ️  ${issue.message}`);
    });
  }
  
  console.log('\n' + '─'.repeat(60));
  console.log('✅ Integrity check complete\n');
  
  // Return issues for programmatic use
  return {
    stats,
    issues,
    healthy: critical.length === 0 && warnings.length === 0
  };
}

// Run if called directly
if (import.meta.main) {
  checkPipelineIntegrity()
    .then(result => {
      process.exit(result.healthy ? 0 : 1);
    })
    .catch(err => {
      console.error('Error running integrity check:', err);
      process.exit(1);
    });
}

export { checkPipelineIntegrity };
