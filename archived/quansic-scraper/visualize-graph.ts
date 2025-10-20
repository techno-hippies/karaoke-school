#!/usr/bin/env bun

/**
 * GRAPH STRUCTURE VISUALIZER
 * 
 * Creates a detailed view of how the music data will be structured
 * as a graph for The Graph Protocol
 * 
 * Usage: bun run visualize-graph.ts
 */

import chalk from 'chalk';
import { db, initDb } from './src/db/postgres';
import { sql } from 'drizzle-orm';
import fs from 'fs/promises';

async function analyzeGraphComplexity() {
  await initDb();
  
  console.log(chalk.bold.cyan('\n🔍 ANALYZING GRAPH COMPLEXITY\n'));

  // 1. ENTITY RELATIONSHIPS
  console.log(chalk.yellow('Entity Relationship Analysis:'));
  
  // Recording -> Work relationships
  const recordingWorkStats = await db.execute(sql`
    SELECT 
      COUNT(*) as total_relationships,
      COUNT(DISTINCT recording_isrc) as unique_recordings,
      COUNT(DISTINCT work_iswc) as unique_works,
      AVG(q1_score) as avg_confidence,
      MIN(q1_score) as min_confidence,
      MAX(q1_score) as max_confidence
    FROM quansic_recording_works
  `);
  
  console.log(chalk.green('\nRecording ↔ Work Relationships:'));
  console.table(recordingWorkStats.rows[0]);

  // Work -> Contributor relationships
  const contributorStats = await db.execute(sql`
    SELECT 
      contributor_role,
      COUNT(*) as count,
      COUNT(DISTINCT work_iswc) as unique_works,
      COUNT(DISTINCT contributor_name) as unique_contributors
    FROM quansic_work_contributors
    GROUP BY contributor_role
    ORDER BY count DESC
  `);
  
  console.log(chalk.green('\nWork ↔ Contributor Relationships by Role:'));
  console.table(contributorStats.rows);

  // 2. DATA ENRICHMENT COVERAGE
  console.log(chalk.yellow('\n📊 Data Enrichment Coverage:'));
  
  const enrichmentCoverage = await db.execute(sql`
    SELECT 
      'Recordings with Spotify' as metric,
      COUNT(DISTINCT s.isrc) as count,
      ROUND(COUNT(DISTINCT s.isrc)::numeric / 164 * 100, 1) as percentage
    FROM spotify_tracks s
    UNION ALL
    SELECT 
      'Recordings with Genius',
      COUNT(DISTINCT g.isrc),
      ROUND(COUNT(DISTINCT g.isrc)::numeric / 164 * 100, 1)
    FROM genius_tracks g
    UNION ALL
    SELECT 
      'Works with MLC ownership',
      COUNT(DISTINCT m.id),
      ROUND(COUNT(DISTINCT m.id)::numeric / 170 * 100, 1)
    FROM mlc_works m
    UNION ALL
    SELECT 
      'Works with contributors',
      COUNT(DISTINCT work_iswc),
      ROUND(COUNT(DISTINCT work_iswc)::numeric / 170 * 100, 1)
    FROM quansic_work_contributors
  `);
  
  console.table(enrichmentCoverage.rows);

  // 3. GRAPH TRAVERSAL PATHS
  console.log(chalk.yellow('\n🛤️  Sample Graph Traversal Paths:'));
  
  // Find a well-connected recording
  const samplePath = await db.execute(sql`
    SELECT 
      r.title as recording,
      r.id as isrc,
      w.title as composition,
      w.id as iswc,
      s.track_name as spotify_track,
      s.popularity,
      g.title as genius_song,
      m.title as mlc_work
    FROM quansic_recordings r
    LEFT JOIN quansic_recording_works rw ON r.id = rw.recording_isrc
    LEFT JOIN quansic_works w ON rw.work_iswc = w.id
    LEFT JOIN spotify_tracks s ON r.id = s.isrc
    LEFT JOIN genius_tracks g ON r.id = g.isrc
    LEFT JOIN mlc_works m ON UPPER(TRIM(w.title)) = UPPER(TRIM(m.title))
    WHERE r.title = 'Genesis'
    LIMIT 1
  `);
  
  if (samplePath.rows.length > 0) {
    const path = samplePath.rows[0];
    console.log(chalk.green('\nExample: "Genesis" traversal path:'));
    console.log(`
  ${chalk.cyan('Recording')}: ${path.recording} (${path.isrc})
       ↓
  ${chalk.cyan('Composition')}: ${path.composition} (${path.iswc})
       ↓
  ${chalk.cyan('Spotify')}: ${path.spotify_track || 'Not found'} (Popularity: ${path.popularity || 'N/A'})
       ↓
  ${chalk.cyan('Genius')}: ${path.genius_song || 'Not found'}
       ↓
  ${chalk.cyan('MLC')}: ${path.mlc_work || 'Not found'}
    `);
  }

  // 4. IDENTIFIER MAPPING
  console.log(chalk.yellow('\n🔗 Identifier Cross-References:'));
  
  const identifierMap = await db.execute(sql`
    SELECT 
      'ISRCs' as identifier_type,
      COUNT(DISTINCT id) as total,
      COUNT(DISTINCT CASE WHEN spotify_id IS NOT NULL THEN id END) as with_spotify,
      COUNT(DISTINCT CASE WHEN apple_id IS NOT NULL THEN id END) as with_apple,
      COUNT(DISTINCT CASE WHEN deezer_id IS NOT NULL THEN id END) as with_deezer
    FROM quansic_recordings
    UNION ALL
    SELECT 
      'ISWCs',
      COUNT(DISTINCT id),
      0,
      0,
      0
    FROM quansic_works
    WHERE id IS NOT NULL
  `);
  
  console.table(identifierMap.rows);

  // 5. GENERATE GRAPH MODEL
  await generateGraphModel();
}

async function generateGraphModel() {
  console.log(chalk.yellow('\n📐 Proposed Graph Model:\n'));
  
  const model = `
╔══════════════════════════════════════════════════════════════╗
║                    GRIMES MUSIC GRAPH MODEL                  ║
╚══════════════════════════════════════════════════════════════╝

NODES (Entities):
─────────────────
1. Artist (Root Node)
   Properties:
   - isni: "0000000356358936"
   - name: "Grimes"
   - ipi: "00633996999"
   - dateOfBirth: "1988-03-17"
   - nationality: "CA"
   - spotifyId, musicbrainzId, etc.

2. Recording (164 nodes)
   Properties:
   - isrc: International Standard Recording Code
   - title: Recording name
   - duration_ms: Duration in milliseconds
   - year: Release year
   - spotifyId: Spotify track ID
   - popularity: Spotify popularity score

3. Work (170 nodes)
   Properties:
   - iswc: International Standard Work Code
   - title: Composition name
   - role: Copyright role
   - q1Score: Confidence score

4. Release (195 nodes)
   Properties:
   - upc: Universal Product Code
   - title: Album/EP/Single name
   - type: Release type
   - year: Release year

5. Contributor (159 nodes)
   Properties:
   - name: Contributor name
   - role: Contribution type
   - isni/ipi: Identifiers if available

EDGES (Relationships):
──────────────────────
1. PERFORMED_BY: Recording → Artist
   - Links each recording to Grimes
   - 164 edges

2. EMBODIES_WORK: Recording → Work
   - Links recordings to compositions
   - 118 edges with confidence scores

3. COMPOSED_BY: Work → Artist
   - Links compositions to Grimes
   - 170 edges

4. CONTRIBUTED_TO: Contributor → Work
   - Links collaborators to works
   - 159 edges with role information

5. PART_OF: Recording → Release
   - Links recordings to albums/releases
   - To be established from release data

6. ENRICHED_WITH: Recording → External Services
   - Virtual edges to Spotify/Genius/MLC data
   - For metadata enrichment

QUERY PATTERNS:
───────────────
1. Find all recordings of a composition:
   Work -[EMBODIES_WORK]-> Recording[]

2. Find all collaborators on a work:
   Work <-[CONTRIBUTED_TO]- Contributor[]

3. Find streaming data for a recording:
   Recording -[spotifyId]-> Spotify Metadata

4. Find ownership chain:
   Recording -> Work -> MLC Ownership Data

5. Find all works by artist:
   Artist <-[COMPOSED_BY]- Work[]
`;

  console.log(model);
  
  // Save the model
  await fs.writeFile('output/graph-model.txt', model);
  console.log(chalk.gray('\n💾 Graph model saved to output/graph-model.txt'));
}

async function generateMintingStrategy() {
  console.log(chalk.bold.cyan('\n🎯 MINTING STRATEGY\n'));
  
  const strategy = `
${chalk.green('Recommended Minting Order:')}

1. ${chalk.cyan('Phase 1: Core Entities')}
   - Create Artist node (Grimes)
   - Create all Work nodes (compositions)
   - Establish COMPOSED_BY edges

2. ${chalk.cyan('Phase 2: Recordings')}
   - Create Recording nodes
   - Establish PERFORMED_BY edges
   - Establish EMBODIES_WORK edges with confidence scores

3. ${chalk.cyan('Phase 3: Releases')}
   - Create Release nodes (albums/EPs)
   - Establish release relationships

4. ${chalk.cyan('Phase 4: Contributors')}
   - Create Contributor nodes
   - Establish CONTRIBUTED_TO edges with roles

5. ${chalk.cyan('Phase 5: External Enrichment')}
   - Add Spotify metadata as properties
   - Add Genius credits as properties
   - Add MLC ownership as properties

${chalk.green('Gas Optimization:')}
- Batch operations where possible
- Use multicall for related entities
- Compress metadata before storage

${chalk.green('Data Integrity:')}
- Validate all ISRCs/ISWCs before minting
- Ensure no duplicate entities
- Maintain confidence scores for disputed links
`;

  console.log(strategy);
}

async function main() {
  console.log(chalk.bold.magenta(`
╔════════════════════════════════════════╗
║   GRAPH STRUCTURE VISUALIZER           ║
║   The Graph Protocol Music Model       ║
╚════════════════════════════════════════╝
  `));
  
  try {
    await analyzeGraphComplexity();
    await generateMintingStrategy();
    
    console.log(chalk.bold.green('\n✅ Analysis Complete!'));
    console.log(chalk.gray(`
Review the generated files:
- output/graph-model.txt - Complete graph structure
- output/graph-structure.mmd - Mermaid diagram
- output/premint-validation.json - Full validation data
    `));
    
  } catch (error) {
    console.error(chalk.red('Visualization error:'), error);
    process.exit(1);
  }
  
  process.exit(0);
}

main();