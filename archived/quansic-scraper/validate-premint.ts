#!/usr/bin/env bun

/**
 * PRE-MINT VALIDATION & REVIEW SCRIPT
 * 
 * Analyzes enriched data and generates a comprehensive report
 * showing what will be minted on The Graph protocol
 * 
 * Usage: bun run validate-premint.ts
 */

import chalk from 'chalk';
import { db, initDb } from './src/db/postgres';
import { sql } from 'drizzle-orm';
import fs from 'fs/promises';

interface GraphNode {
  type: 'Artist' | 'Recording' | 'Work' | 'Release';
  id: string;
  name: string;
  properties: Record<string, any>;
}

interface GraphEdge {
  type: string;
  from: string;
  to: string;
  properties?: Record<string, any>;
}

interface ValidationReport {
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats: Record<string, number>;
  issues: string[];
  warnings: string[];
}

async function validateData(): Promise<ValidationReport> {
  await initDb();
  
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const issues: string[] = [];
  const warnings: string[] = [];
  const stats: Record<string, number> = {};

  console.log(chalk.bold.cyan('\n📊 VALIDATING PRE-MINT DATA\n'));

  // 1. VALIDATE ARTIST NODE
  console.log(chalk.yellow('Validating Artist...'));
  const artist = await db.execute(sql`
    SELECT * FROM quansic_artists WHERE id = '0000000356358936'
  `);
  
  if (artist.rows.length === 0) {
    issues.push('❌ No artist found with ISNI 0000000356358936');
  } else {
    const a = artist.rows[0];
    nodes.push({
      type: 'Artist',
      id: a.id,
      name: a.name,
      properties: {
        isni: a.id,
        ipi: a.ipi,
        dateOfBirth: a.date_of_birth,
        nationality: a.nationality,
        spotifyId: a.spotify_id,
        musicbrainzId: a.musicbrainz_id
      }
    });
    stats.artistsWithISNI = 1;
  }

  // 2. VALIDATE RECORDINGS
  console.log(chalk.yellow('Validating Recordings...'));
  const recordings = await db.execute(sql`
    SELECT 
      r.*,
      COUNT(DISTINCT rw.work_iswc) as work_count,
      COUNT(DISTINCT s.isrc) as spotify_match
    FROM quansic_recordings r
    LEFT JOIN quansic_recording_works rw ON r.id = rw.recording_isrc
    LEFT JOIN spotify_tracks s ON r.id = s.isrc
    GROUP BY r.id, r.artist_id, r.isrc, r.title, r.duration_ms, r.year, r.spotify_id, r.apple_id, r.deezer_id, r.created_at
  `);
  
  stats.totalRecordings = recordings.rows.length;
  stats.recordingsWithISRC = 0;
  stats.recordingsWithSpotify = 0;
  stats.recordingsWithWorks = 0;
  
  for (const rec of recordings.rows) {
    if (rec.id) {
      stats.recordingsWithISRC++;
      nodes.push({
        type: 'Recording',
        id: rec.id,
        name: rec.title,
        properties: {
          isrc: rec.id,
          duration_ms: rec.duration_ms,
          year: rec.year,
          spotify_id: rec.spotify_id,
          hasSpotifyMatch: rec.spotify_match > 0,
          workCount: rec.work_count
        }
      });

      // Add recording->artist edge
      edges.push({
        type: 'PERFORMED_BY',
        from: rec.id,
        to: '0000000356358936'
      });
      
      if (rec.spotify_match > 0) stats.recordingsWithSpotify++;
      if (rec.work_count > 0) stats.recordingsWithWorks++;
    } else {
      warnings.push(`⚠️ Recording "${rec.title}" has no ISRC`);
    }
  }

  // 3. VALIDATE WORKS (Compositions)
  console.log(chalk.yellow('Validating Works...'));
  const works = await db.execute(sql`
    SELECT 
      w.*,
      COUNT(DISTINCT rw.recording_isrc) as recording_count,
      COUNT(DISTINCT wc.id) as contributor_count,
      COUNT(DISTINCT m.id) as mlc_match
    FROM quansic_works w
    LEFT JOIN quansic_recording_works rw ON w.id = rw.work_iswc
    LEFT JOIN quansic_work_contributors wc ON w.id = wc.work_iswc
    LEFT JOIN mlc_works m ON UPPER(TRIM(w.title)) = UPPER(TRIM(m.title))
    WHERE w.id IS NOT NULL
    GROUP BY w.id, w.artist_id, w.title, w.role, w.q1_score, w.created_at
  `);
  
  stats.totalWorks = works.rows.length;
  stats.worksWithISWC = 0;
  stats.worksWithContributors = 0;
  stats.worksWithMLCMatch = 0;
  
  for (const work of works.rows) {
    if (work.id && work.id !== 'null') {
      stats.worksWithISWC++;
      nodes.push({
        type: 'Work',
        id: work.id,
        name: work.title,
        properties: {
          iswc: work.id,
          role: work.role,
          q1Score: work.q1_score,
          recordingCount: work.recording_count,
          contributorCount: work.contributor_count,
          hasMLCMatch: work.mlc_match > 0
        }
      });

      // Add work->artist edge
      edges.push({
        type: 'COMPOSED_BY',
        from: work.id,
        to: '0000000356358936'
      });
      
      if (work.contributor_count > 0) stats.worksWithContributors++;
      if (work.mlc_match > 0) stats.worksWithMLCMatch++;
    }
  }

  // 4. VALIDATE RECORDING->WORK RELATIONSHIPS
  console.log(chalk.yellow('Validating Recording-Work Links...'));
  const recordingWorks = await db.execute(sql`
    SELECT * FROM quansic_recording_works
  `);
  
  stats.recordingWorkLinks = recordingWorks.rows.length;
  
  for (const rw of recordingWorks.rows) {
    edges.push({
      type: 'EMBODIES_WORK',
      from: rw.recording_isrc,
      to: rw.work_iswc,
      properties: {
        q1Score: rw.q1_score,
        q2Score: rw.q2_score
      }
    });
  }

  // 5. VALIDATE RELEASES
  console.log(chalk.yellow('Validating Releases...'));
  const releases = await db.execute(sql`
    SELECT * FROM quansic_releases WHERE upc IS NOT NULL
  `);
  
  stats.totalReleases = releases.rows.length;
  stats.releasesWithUPC = 0;
  
  for (const release of releases.rows) {
    if (release.upc) {
      stats.releasesWithUPC++;
      nodes.push({
        type: 'Release',
        id: release.upc,
        name: release.title,
        properties: {
          upc: release.upc,
          type: release.type,
          year: release.year
        }
      });

      // Add release->artist edge
      edges.push({
        type: 'RELEASED_BY',
        from: release.upc,
        to: '0000000356358936'
      });
    }
  }

  // 6. CHECK DATA COMPLETENESS
  console.log(chalk.yellow('Checking Data Completeness...'));
  
  // Check for orphaned recordings
  const orphanedRecordings = await db.execute(sql`
    SELECT COUNT(*) as count FROM quansic_recordings r
    LEFT JOIN quansic_recording_works rw ON r.id = rw.recording_isrc
    WHERE rw.recording_isrc IS NULL
  `);
  
  if (orphanedRecordings.rows[0].count > 0) {
    warnings.push(`⚠️ ${orphanedRecordings.rows[0].count} recordings have no associated works`);
  }

  // Check for missing Spotify enrichment
  const missingSpotify = await db.execute(sql`
    SELECT COUNT(*) as count FROM quansic_recordings r
    LEFT JOIN spotify_tracks s ON r.id = s.isrc
    WHERE s.isrc IS NULL
  `);
  
  if (missingSpotify.rows[0].count > 0) {
    warnings.push(`⚠️ ${missingSpotify.rows[0].count} recordings missing Spotify enrichment`);
  }

  // Check for duplicate ISRCs
  const duplicateISRCs = await db.execute(sql`
    SELECT id, COUNT(*) as count 
    FROM quansic_recordings 
    GROUP BY id 
    HAVING COUNT(*) > 1
  `);
  
  for (const dup of duplicateISRCs.rows) {
    issues.push(`❌ Duplicate ISRC found: ${dup.id} (${dup.count} times)`);
  }

  return {
    nodes,
    edges,
    stats,
    issues,
    warnings
  };
}

async function generateGraphVisualization(report: ValidationReport) {
  console.log(chalk.bold.cyan('\n🕸️  GRAPH STRUCTURE PREVIEW\n'));
  
  // Summary stats
  console.log(chalk.green('Nodes to be created:'));
  const nodesByType = report.nodes.reduce((acc, node) => {
    acc[node.type] = (acc[node.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  Object.entries(nodesByType).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });
  
  console.log(chalk.green('\nEdges to be created:'));
  const edgesByType = report.edges.reduce((acc, edge) => {
    acc[edge.type] = (acc[edge.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  Object.entries(edgesByType).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });

  // Generate Mermaid diagram for visualization
  const mermaid = generateMermaidDiagram(report);
  await fs.writeFile('output/graph-structure.mmd', mermaid);
  console.log(chalk.gray('\n💾 Mermaid diagram saved to output/graph-structure.mmd'));
}

function generateMermaidDiagram(report: ValidationReport): string {
  let mermaid = 'graph TD\n';
  
  // Add artist node
  mermaid += `  ARTIST[Grimes<br/>ISNI: 0000000356358936]\n`;
  mermaid += `  style ARTIST fill:#f9f,stroke:#333,stroke-width:4px\n\n`;
  
  // Add sample nodes (first 5 of each type)
  const sampleRecordings = report.nodes.filter(n => n.type === 'Recording').slice(0, 5);
  const sampleWorks = report.nodes.filter(n => n.type === 'Work').slice(0, 5);
  const sampleReleases = report.nodes.filter(n => n.type === 'Release').slice(0, 5);
  
  sampleRecordings.forEach(rec => {
    const cleanId = rec.id.replace(/[^a-zA-Z0-9]/g, '');
    mermaid += `  REC_${cleanId}[${rec.name}<br/>ISRC: ${rec.id}]\n`;
  });
  
  sampleWorks.forEach(work => {
    const cleanId = work.id.replace(/[^a-zA-Z0-9]/g, '');
    mermaid += `  WORK_${cleanId}[${work.name}<br/>ISWC: ${work.id}]\n`;
  });
  
  sampleReleases.forEach(rel => {
    const cleanId = rel.id.replace(/[^a-zA-Z0-9]/g, '');
    mermaid += `  REL_${cleanId}[${rel.name}<br/>UPC: ${rel.id}]\n`;
  });
  
  // Add edges
  mermaid += '\n';
  sampleRecordings.forEach(rec => {
    const cleanId = rec.id.replace(/[^a-zA-Z0-9]/g, '');
    mermaid += `  REC_${cleanId} -->|PERFORMED_BY| ARTIST\n`;
  });
  
  // Add recording->work edges
  const sampleRWEdges = report.edges
    .filter(e => e.type === 'EMBODIES_WORK')
    .slice(0, 5);
  
  sampleRWEdges.forEach(edge => {
    const cleanFrom = edge.from.replace(/[^a-zA-Z0-9]/g, '');
    const cleanTo = edge.to.replace(/[^a-zA-Z0-9]/g, '');
    mermaid += `  REC_${cleanFrom} -.->|EMBODIES| WORK_${cleanTo}\n`;
  });
  
  return mermaid;
}

async function generateReport(report: ValidationReport) {
  console.log(chalk.bold.cyan('\n📋 VALIDATION REPORT\n'));
  
  // Stats
  console.log(chalk.green('Data Statistics:'));
  console.table(report.stats);
  
  // Issues
  if (report.issues.length > 0) {
    console.log(chalk.red('\nCritical Issues:'));
    report.issues.forEach(issue => console.log(`  ${issue}`));
  } else {
    console.log(chalk.green('\n✅ No critical issues found'));
  }
  
  // Warnings
  if (report.warnings.length > 0) {
    console.log(chalk.yellow('\nWarnings:'));
    report.warnings.forEach(warning => console.log(`  ${warning}`));
  }
  
  // Save full report to JSON
  const jsonReport = {
    timestamp: new Date().toISOString(),
    stats: report.stats,
    issues: report.issues,
    warnings: report.warnings,
    nodeCount: report.nodes.length,
    edgeCount: report.edges.length,
    nodes: report.nodes.slice(0, 10), // Sample for review
    edges: report.edges.slice(0, 10)  // Sample for review
  };
  
  await fs.writeFile(
    'output/premint-validation.json',
    JSON.stringify(jsonReport, null, 2)
  );
  
  console.log(chalk.gray('\n💾 Full report saved to output/premint-validation.json'));
}

async function main() {
  console.log(chalk.bold.magenta(`
╔════════════════════════════════════════╗
║   PRE-MINT VALIDATION TOOL             ║
║   The Graph Protocol Data Review       ║
╚════════════════════════════════════════╝
  `));
  
  try {
    const report = await validateData();
    await generateGraphVisualization(report);
    await generateReport(report);
    
    // Final recommendation
    console.log(chalk.bold.cyan('\n🎯 MINTING RECOMMENDATION\n'));
    
    if (report.issues.length === 0) {
      console.log(chalk.green('✅ Data is ready for minting!'));
      console.log(chalk.gray(`
Next steps:
1. Review the graph structure in output/graph-structure.mmd
2. Check the detailed report in output/premint-validation.json
3. Run: bun run src/graph/mint-genesis.ts
      `));
    } else {
      console.log(chalk.red('❌ Critical issues must be resolved before minting'));
      console.log(chalk.gray('Fix the issues listed above and run validation again'));
    }
    
  } catch (error) {
    console.error(chalk.red('Validation error:'), error);
    process.exit(1);
  }
  
  process.exit(0);
}

main();