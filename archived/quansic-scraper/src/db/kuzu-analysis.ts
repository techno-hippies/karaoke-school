#!/usr/bin/env bun

import * as kuzu from 'kuzu';
import chalk from 'chalk';
import * as path from 'path';

const KUZU_DB_PATH = path.join(process.cwd(), 'kuzu-music.db');

async function runAnalysis() {
  console.log(chalk.bold.cyan('\n🔍 KUZU GRAPH ANALYSIS\n'));
  
  const db = new kuzu.Database(KUZU_DB_PATH);
  const conn = new kuzu.Connection(db);
  
  try {
    // 1. Find recordings without works (orphaned recordings)
    console.log(chalk.yellow('\n📀 Orphaned Recordings (no work association):'));
    const orphanedQuery = await conn.prepare(`
      MATCH (r:Recording)
      WHERE NOT EXISTS {MATCH (r)-[:RECORDING_OF]->(:Work)}
      RETURN r.id as isrc, r.title
      LIMIT 10
    `);
    const orphanedRecordings = await conn.execute(orphanedQuery);
    
    const orphanedTable = await orphanedRecordings.getAll();
    if (orphanedTable.length > 0) {
      console.table(orphanedTable);
      console.log(chalk.gray(`  Found ${orphanedTable.length} orphaned recordings`));
    } else {
      console.log(chalk.green('  ✓ All recordings have associated works'));
    }
    
    // 2. Works without ISWC
    console.log(chalk.yellow('\n📝 Works without ISWC:'));
    const incompleteQuery = await conn.prepare(`
      MATCH (w:Work)
      WHERE w.iswcs IS NULL OR SIZE(w.iswcs) = 0
      RETURN w.id, w.title, w.iswcs
      LIMIT 10
    `);
    const incompleteWorks = await conn.execute(incompleteQuery);
    
    const incompleteTable = await incompleteWorks.getAll();
    if (incompleteTable.length > 0) {
      console.table(incompleteTable);
      console.log(chalk.gray(`  Found ${incompleteTable.length} works with incomplete ownership`));
    } else {
      console.log(chalk.green('  ✓ All works have complete ownership'));
    }
    
    // 3. Artists missing critical identifiers
    console.log(chalk.yellow('\n👤 Artists Missing Identifiers:'));
    const missingQuery = await conn.prepare(`
      MATCH (a:Artist)
      WHERE a.ipis IS NULL OR a.spotify_id IS NULL
      RETURN a.id, a.name, a.ipis, a.spotify_id
      LIMIT 10
    `);
    const missingIds = await conn.execute(missingQuery);
    
    const missingTable = await missingIds.getAll();
    if (missingTable.length > 0) {
      console.table(missingTable);
      console.log(chalk.gray(`  Found ${missingTable.length} artists with missing identifiers`));
    } else {
      console.log(chalk.green('  ✓ All artists have complete identifiers'));
    }
    
    // 4. Recordings missing enrichment
    console.log(chalk.yellow('\n🎵 Recordings Missing Enrichment:'));
    const unenrichedQuery = await conn.prepare(`
      MATCH (r:Recording)
      WHERE r.spotify_id IS NULL OR r.genius_id IS NULL
      RETURN r.id as isrc, r.title, 
             CASE WHEN r.spotify_id IS NOT NULL THEN '✓' ELSE '✗' END as spotify,
             CASE WHEN r.genius_id IS NOT NULL THEN '✓' ELSE '✗' END as genius
      LIMIT 10
    `);
    const unenriched = await conn.execute(unenrichedQuery);
    
    const unenrichedTable = await unenriched.getAll();
    if (unenrichedTable.length > 0) {
      console.table(unenrichedTable);
    } else {
      console.log(chalk.green('  ✓ All recordings fully enriched'));
    }
    
    // 5. Summary statistics
    console.log(chalk.bold.cyan('\n📊 GRAPH STATISTICS:'));
    
    const statsQuery = await conn.prepare(`
      MATCH (a:Artist) RETURN COUNT(a) as count, 'Artists' as type
      UNION ALL
      MATCH (r:Recording) RETURN COUNT(r) as count, 'Recordings' as type
      UNION ALL
      MATCH (w:Work) RETURN COUNT(w) as count, 'Works' as type
      UNION ALL
      MATCH (p:Publisher) RETURN COUNT(p) as count, 'Publishers' as type
    `);
    const stats = await conn.execute(statsQuery);
    
    const statsTable = await stats.getAll();
    console.table(statsTable);
    
    // 6. Relationship counts
    console.log(chalk.bold.cyan('\n🔗 RELATIONSHIP COUNTS:'));
    
    const relsQuery = await conn.prepare(`
      MATCH ()-[r:RECORDING_OF]->() RETURN COUNT(r) as count, 'RECORDING_OF' as type
      UNION ALL
      MATCH ()-[r:COMPOSED_BY]->() RETURN COUNT(r) as count, 'COMPOSED_BY' as type
      UNION ALL
      MATCH ()-[r:PERFORMED_BY]->() RETURN COUNT(r) as count, 'PERFORMED_BY' as type
      UNION ALL
      MATCH ()-[r:PUBLISHED_BY]->() RETURN COUNT(r) as count, 'PUBLISHED_BY' as type
    `);
    const rels = await conn.execute(relsQuery);
    
    const relsTable = await rels.getAll();
    console.table(relsTable);
    
    // 7. Corroboration strength
    console.log(chalk.bold.cyan('\n✅ CORROBORATION STRENGTH:'));
    
    const corroborationQuery = await conn.prepare(`
      MATCH (r:Recording)
      WITH r,
           CASE WHEN r.spotify_id IS NOT NULL THEN 1 ELSE 0 END +
           CASE WHEN r.genius_id IS NOT NULL THEN 1 ELSE 0 END +
           CASE WHEN r.apple_id IS NOT NULL THEN 1 ELSE 0 END as sources
      WITH sources, COUNT(r) as count
      RETURN sources as verified_sources, count as recordings
      ORDER BY sources DESC
    `);
    const corroboration = await conn.execute(corroborationQuery);
    
    const corroborationTable = await corroboration.getAll();
    console.table(corroborationTable);
    
  } catch (error) {
    console.error(chalk.red('Query error:'), error);
  }
}

// Run if called directly
if (import.meta.main) {
  runAnalysis().catch(console.error);
}

export { runAnalysis };