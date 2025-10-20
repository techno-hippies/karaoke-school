#!/usr/bin/env bun

// Set environment variables for APIs
process.env.SPOTIFY_CLIENT_ID = '67211696824445baa62a6b46820c65d1';
process.env.SPOTIFY_CLIENT_SECRET = 'f923bc7955984c7c9585a54bfdc4606b';
process.env.GENIUS_API_KEY = 'WZeZ3_oXfPv8U0MOvE-zOCa5DWm222YUd9rD1n6cktv_g9x_14hzw8rttEBmaLQD';

/**
 * MASTER PIPELINE ORCHESTRATOR
 * Run this to execute the complete data enrichment pipeline
 * 
 * Usage:
 *   bun run run-complete-pipeline.ts          # Run everything
 *   bun run run-complete-pipeline.ts quansic  # Run only Quansic
 *   bun run run-complete-pipeline.ts spotify  # Run only Spotify
 *   bun run run-complete-pipeline.ts genius   # Run only Genius
 *   bun run run-complete-pipeline.ts mlc      # Run only MLC
 */

import chalk from 'chalk';
import { db, initDb } from './src/db/postgres';
import { sql } from 'drizzle-orm';

async function clearDatabase() {
  console.log(chalk.yellow('\n🗑️  CLEARING DATABASE...\n'));
  
  await initDb();
  
  // Drop all tables in correct order (respecting foreign keys)
  const tables = [
    // Spotify tables
    'spotify_track_artists',
    'spotify_tracks',
    'spotify_artists',
    
    // Genius tables
    'genius_song_relationships',
    'genius_media_links',
    'genius_credits',
    'genius_albums',
    'genius_tracks',
    'genius_artists',
    
    // MLC tables
    'mlc_recordings',
    'mlc_writers',
    'mlc_publishers',
    'mlc_works',
    
    // Quansic tables (dependencies last)
    'quansic_recording_works',
    'quansic_work_contributors', 
    'quansic_artist_aliases',
    'quansic_recordings',
    'quansic_works',
    'quansic_releases',
    'quansic_artists',
  ];
  
  for (const table of tables) {
    try {
      await db.execute(sql.raw(`DROP TABLE IF EXISTS ${table} CASCADE`));
      console.log(chalk.gray(`  Dropped ${table}`));
    } catch (error) {
      // Table might not exist, that's ok
    }
  }
  
  console.log(chalk.green('✓ Database cleared\n'));
}

async function showFinalStats() {
  console.log(chalk.bold.cyan('\n📊 FINAL PIPELINE STATS\n'));
  
  const stats = await db.execute(sql`
    SELECT 
      'Quansic' as source,
      (SELECT COUNT(*) FROM quansic_recordings WHERE isrc IS NOT NULL) as recordings,
      (SELECT COUNT(*) FROM quansic_works WHERE iswc IS NOT NULL) as works
    UNION ALL
    SELECT 
      'Spotify',
      (SELECT COUNT(*) FROM spotify_tracks),
      (SELECT COUNT(*) FROM spotify_artists)
    UNION ALL
    SELECT 
      'Genius',
      (SELECT COUNT(*) FROM genius_tracks),
      (SELECT COUNT(*) FROM genius_credits)
    UNION ALL
    SELECT 
      'MLC',
      (SELECT COUNT(*) FROM mlc_works),
      (SELECT COUNT(*) FROM mlc_writers)
  `);
  
  console.table(stats.rows);
  console.log(chalk.bold.green('\n✅ PIPELINE COMPLETE\n'));
}

async function main() {
  const command = process.argv[2];
  
  console.log(chalk.bold.magenta(`
╔══════════════════════════════════════╗
║   GRIMES MUSIC DATA PIPELINE        ║
║   Complete Enrichment System         ║
╚══════════════════════════════════════╝
  `));
  
  if (!command || command === 'all') {
    // Run complete pipeline
    await clearDatabase();
    
    console.log(chalk.yellow('\n🚀 Running complete pipeline...\n'));
    
    // 1. Quansic (foundation)
    console.log(chalk.cyan('Step 1/4: Quansic Foundation Data'));
    const { runQuansicIngestion } = await import('./src/services/quansic');
    await runQuansicIngestion();
    
    // 2. Spotify enrichment
    console.log(chalk.cyan('\nStep 2/4: Spotify Track Enrichment'));
    const spotifyModule = await import('./src/services/spotify');
    await spotifyModule.main();
    
    // 3. Genius enrichment
    console.log(chalk.cyan('\nStep 3/4: Genius Lyrics & Credits'));
    const geniusModule = await import('./src/services/genius');
    await geniusModule.main();
    
    // 4. MLC ownership
    console.log(chalk.cyan('\nStep 4/4: MLC Ownership Data'));
    const mlcModule = await import('./src/services/mlc');
    await mlcModule.main();
    
    await showFinalStats();
    
  } else if (command === 'clear') {
    await clearDatabase();
    
  } else {
    // Run individual service
    console.log(chalk.yellow(`\n🚀 Running ${command} only...\n`));
    
    switch(command) {
      case 'quansic':
        const { runQuansicIngestion } = await import('./src/services/quansic');
        await runQuansicIngestion();
        break;
      case 'spotify':
        const spotifyModule = await import('./src/services/spotify');
        await spotifyModule.main();
        break;
      case 'genius':
        const geniusModule = await import('./src/services/genius');
        await geniusModule.main();
        break;
      case 'mlc':
        const mlcModule = await import('./src/services/mlc');
        await mlcModule.main();
        break;
      default:
        console.error(chalk.red(`Unknown command: ${command}`));
        console.log('Usage: bun run run-complete-pipeline.ts [all|clear|quansic|spotify|genius|mlc]');
        process.exit(1);
    }
  }
  
  process.exit(0);
}

main().catch(error => {
  console.error(chalk.red('Pipeline error:'), error);
  process.exit(1);
});