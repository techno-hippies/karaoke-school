/**
 * Pipeline Status Dashboard
 * Shows current state of all tracks and tasks
 */

import { query } from './connection';

async function showStatus() {
  console.log('📊 Karaoke Pipeline Status Dashboard\n');
  console.log('═'.repeat(80) + '\n');

  // Track stages
  console.log('🎵 Track Stages:');
  const stages = await query<{ stage: string; track_count: number; with_iswc: number; with_lyrics: number; with_audio: number }>(`
    SELECT * FROM pipeline_progress ORDER BY
      CASE stage
        WHEN 'pending' THEN 1
        WHEN 'enriched' THEN 2
        WHEN 'lyrics_acquired' THEN 3
        WHEN 'audio_ready' THEN 4
        WHEN 'aligned' THEN 5
        WHEN 'translated' THEN 6
        WHEN 'separated' THEN 7
        WHEN 'segmented' THEN 8
        WHEN 'enhanced' THEN 9
        WHEN 'ready' THEN 10
        WHEN 'failed' THEN 99
      END
  `);

  if (stages.length === 0) {
    console.log('   No tracks yet\n');
  } else {
    for (const stage of stages) {
      console.log(`   ${stage.stage.padEnd(20)} ${stage.track_count} tracks (ISWC: ${stage.with_iswc}, Lyrics: ${stage.with_lyrics}, Audio: ${stage.with_audio})`);
    }
    console.log('');
  }

  // Enrichment tasks
  console.log('🔍 Enrichment Tasks:');
  const enrichmentTasks = await query<{ task_type: string; status: string; count: number }>(`
    SELECT task_type, status, COUNT(*) as count
    FROM enrichment_tasks
    GROUP BY task_type, status
    ORDER BY task_type,
      CASE status
        WHEN 'completed' THEN 1
        WHEN 'pending' THEN 2
        WHEN 'running' THEN 3
        WHEN 'failed' THEN 4
        WHEN 'skipped' THEN 5
      END
  `);

  if (enrichmentTasks.length === 0) {
    console.log('   No enrichment tasks yet\n');
  } else {
    let currentType = '';
    for (const task of enrichmentTasks) {
      if (task.task_type !== currentType) {
        if (currentType) console.log('');
        console.log(`   ${task.task_type}:`);
        currentType = task.task_type;
      }
      console.log(`      ${task.status.padEnd(10)} ${task.count} tasks`);
    }
    console.log('');
  }

  // Audio tasks
  console.log('🎧 Audio Tasks:');
  const audioTasks = await query<{ task_type: string; status: string; count: number }>(`
    SELECT task_type, status, COUNT(*) as count
    FROM audio_tasks
    GROUP BY task_type, status
    ORDER BY
      CASE task_type
        WHEN 'download' THEN 1
        WHEN 'align' THEN 2
        WHEN 'translate' THEN 3
        WHEN 'separate' THEN 4
        WHEN 'segment' THEN 5
        WHEN 'enhance' THEN 6
        WHEN 'clip' THEN 7
      END,
      CASE status
        WHEN 'completed' THEN 1
        WHEN 'pending' THEN 2
        WHEN 'running' THEN 3
        WHEN 'failed' THEN 4
      END
  `);

  if (audioTasks.length === 0) {
    console.log('   No audio tasks yet\n');
  } else {
    let currentType = '';
    for (const task of audioTasks) {
      if (task.task_type !== currentType) {
        if (currentType) console.log('');
        console.log(`   ${task.task_type}:`);
        currentType = task.task_type;
      }
      console.log(`      ${task.status.padEnd(10)} ${task.count} tasks`);
    }
    console.log('');
  }

  console.log('═'.repeat(80));
}

// Run if called directly
if (import.meta.main) {
  showStatus()
    .catch(error => {
      console.error('❌ Status check failed:', error);
      process.exit(1);
    });
}

export { showStatus };
