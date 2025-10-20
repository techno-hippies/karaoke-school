#!/usr/bin/env bun

/**
 * KUZU GRAPH QUERIES
 * 
 * Useful queries for finding missing relationships and corroboration opportunities
 */

const kuzu = require('kuzu');
import chalk from 'chalk';
import fs from 'fs';

const DB_PATH = './kuzu-music.db';

export class KuzuQueries {
  private kuzuDb: any;
  private conn: any;
  
  constructor() {
    if (!fs.existsSync(DB_PATH)) {
      throw new Error('Kuzu database not found. Run kuzu-init.ts first!');
    }
    this.kuzuDb = new kuzu.Database(DB_PATH);
    this.conn = new kuzu.Connection(this.kuzuDb);
  }
  
  async close() {
    await this.conn.close();
  }
  
  /**
   * Get database statistics
   */
  async getStats() {
    console.log(chalk.bold.cyan('\n📊 DATABASE STATISTICS\n'));
    
    // Count nodes
    const nodeTypes = ['Artist', 'Work', 'Recording', 'Publisher', 'Source'];
    
    for (const nodeType of nodeTypes) {
      try {
        const result = await this.conn.query(`MATCH (n:${nodeType}) RETURN COUNT(n) as count`);
        const data = await result.getAll();
        console.log(chalk.gray(`${nodeType}: ${data[0]?.count || 0}`));
      } catch (e) {
        console.log(chalk.gray(`${nodeType}: 0`));
      }
    }
  }
  
  /**
   * Find orphaned recordings (no work connection)
   */
  async findOrphanedRecordings() {
    console.log(chalk.bold.cyan('\n🔍 ORPHANED RECORDINGS\n'));
    
    const result = await this.conn.query(`
      MATCH (r:Recording)
      WHERE NOT EXISTS { MATCH (r)-[:RECORDING_OF]->(:Work) }
      RETURN r.id as isrc, r.title as title
      LIMIT 20
    `);
    
    const orphans = await result.getAll();
    
    if (orphans.length === 0) {
      console.log(chalk.green('No orphaned recordings found!'));
    } else {
      console.log(chalk.yellow(`Found ${orphans.length} recordings without works:`));
      orphans.forEach(r => {
        console.log(chalk.gray(`  ${r.isrc}: ${r.title}`));
      });
    }
    
    return orphans;
  }
  
  /**
   * Find works without recordings
   */
  async findWorksWithoutRecordings() {
    console.log(chalk.bold.cyan('\n🎵 WORKS WITHOUT RECORDINGS\n'));
    
    const result = await this.conn.query(`
      MATCH (w:Work)
      WHERE NOT EXISTS { MATCH (:Recording)-[:RECORDING_OF]->(w) }
      RETURN w.id as iswc, w.title as title
      LIMIT 20
    `);
    
    const works = await result.getAll();
    
    if (works.length === 0) {
      console.log(chalk.green('All works have recordings!'));
    } else {
      console.log(chalk.yellow(`Found ${works.length} works without recordings:`));
      works.forEach(w => {
        console.log(chalk.gray(`  ${w.iswc}: ${w.title}`));
      });
    }
    
    return works;
  }
  
  /**
   * Find potential remixes by title similarity
   */
  async findPotentialRemixes() {
    console.log(chalk.bold.cyan('\n🎛️  POTENTIAL REMIXES\n'));
    
    // Find recordings with "remix" in title
    const result = await this.conn.query(`
      MATCH (r:Recording)
      WHERE r.title =~ '.*[Rr]emix.*'
      RETURN r.id as isrc, r.title as title
      LIMIT 10
    `);
    
    const remixes = await result.getAll();
    
    if (remixes.length === 0) {
      console.log(chalk.gray('No recordings with "remix" in title found'));
    } else {
      console.log(chalk.yellow(`Found ${remixes.length} potential remixes:`));
      
      for (const remix of remixes) {
        console.log(chalk.cyan(`\n${remix.title} (${remix.isrc})`));
        
        // Try to find the original
        const baseName = remix.title.replace(/\s*[\(\[-].*[Rr]emix.*[\)\]]/g, '').trim();
        console.log(chalk.gray(`  Base name: "${baseName}"`));
        
        // Look for similar titles
        try {
          const originals = await this.conn.query(`
            MATCH (r:Recording)
            WHERE r.title =~ '${baseName}.*'
              AND r.id != '${remix.isrc}'
              AND r.title !~ '.*[Rr]emix.*'
            RETURN r.id as isrc, r.title as title
            LIMIT 3
          `);
          
          const originalData = await originals.getAll();
          
          if (originalData.length > 0) {
            console.log(chalk.green('  Potential originals:'));
            originalData.forEach(o => {
              console.log(chalk.gray(`    - ${o.title} (${o.isrc})`));
            });
          } else {
            console.log(chalk.gray('  No potential original found'));
          }
        } catch (e) {
          console.log(chalk.gray('  Could not search for original'));
        }
      }
    }
    
    return remixes;
  }
  
  /**
   * Trace royalty path for a recording
   */
  async traceRoyaltyPath(isrc: string) {
    console.log(chalk.bold.cyan(`\n💰 ROYALTY PATH FOR ${isrc}\n`));
    
    // Find recording
    const recording = await this.conn.query(`
      MATCH (r:Recording {id: '${isrc}'})
      RETURN r.title as title
    `);
    const recData = await recording.getAll();
    
    if (recData.length === 0) {
      console.log(chalk.red(`Recording ${isrc} not found`));
      return null;
    }
    
    console.log(chalk.yellow(`Recording: ${recData[0].title}`));
    
    // Find work
    const work = await this.conn.query(`
      MATCH (r:Recording {id: '${isrc}'})-[:RECORDING_OF]->(w:Work)
      RETURN w.id as iswc, w.title as title
    `);
    const workData = await work.getAll();
    
    if (workData.length === 0) {
      console.log(chalk.red('  ❌ No work linked to this recording'));
      return null;
    }
    
    console.log(chalk.green(`  → Work: ${workData[0].title} (${workData[0].iswc})`));
    
    // Find composers
    const composers = await this.conn.query(`
      MATCH (w:Work {id: '${workData[0].iswc}'})-[:COMPOSED_BY]->(a:Artist)
      RETURN a.name as name, a.ipis as ipis
    `);
    const composerData = await composers.getAll();
    
    if (composerData.length > 0) {
      console.log(chalk.cyan('    Composers:'));
      composerData.forEach(c => {
        const ipis = c.ipis && c.ipis.length > 0 ? c.ipis.join(', ') : 'No IPI';
        console.log(chalk.gray(`      - ${c.name} (${ipis})`));
      });
    }
    
    // Find publishers
    const publishers = await this.conn.query(`
      MATCH (w:Work {id: '${workData[0].iswc}'})-[p:PUBLISHED_BY]->(pub:Publisher)
      RETURN pub.name as name, pub.ipi as ipi, p.share as share
    `);
    const publisherData = await publishers.getAll();
    
    if (publisherData.length > 0) {
      console.log(chalk.magenta('    Publishers:'));
      publisherData.forEach(p => {
        console.log(chalk.gray(`      - ${p.name} (${p.share}% share)`));
      });
    } else {
      console.log(chalk.gray('    No publishers found'));
    }
    
    return {
      recording: recData[0],
      work: workData[0],
      composers: composerData,
      publishers: publisherData
    };
  }
  
  /**
   * Find corroboration opportunities
   */
  async findCorroborationOpportunities() {
    console.log(chalk.bold.cyan('\n🔗 CORROBORATION OPPORTUNITIES\n'));
    
    // Find recordings with similar titles but no work connection
    const result = await this.conn.query(`
      MATCH (r1:Recording), (r2:Recording)
      WHERE r1.id < r2.id
        AND r1.title = r2.title
        AND NOT EXISTS { MATCH (r1)-[:RECORDING_OF]->(:Work) }
        AND EXISTS { MATCH (r2)-[:RECORDING_OF]->(:Work) }
      RETURN r1.id as orphan_isrc, r1.title as title, r2.id as linked_isrc
      LIMIT 10
    `);
    
    const opportunities = await result.getAll();
    
    if (opportunities.length === 0) {
      console.log(chalk.gray('No immediate corroboration opportunities found'));
    } else {
      console.log(chalk.yellow(`Found ${opportunities.length} opportunities:`));
      
      for (const opp of opportunities) {
        console.log(chalk.cyan(`\n"${opp.title}"`));
        console.log(chalk.gray(`  Orphan: ${opp.orphan_isrc}`));
        console.log(chalk.gray(`  Has work: ${opp.linked_isrc}`));
        
        // Get the work info
        const work = await this.conn.query(`
          MATCH (:Recording {id: '${opp.linked_isrc}'})-[:RECORDING_OF]->(w:Work)
          RETURN w.id as iswc, w.title as title
        `);
        const workData = await work.getAll();
        
        if (workData.length > 0) {
          console.log(chalk.green(`  → Could link to: ${workData[0].title} (${workData[0].iswc})`));
        }
      }
    }
    
    return opportunities;
  }
}

// CLI interface
async function main() {
  console.log(chalk.bold.magenta(`
╔════════════════════════════════════════╗
║   KUZU GRAPH QUERIES                   ║
║   Finding Missing Relationships        ║
╚════════════════════════════════════════╝
  `));
  
  const queries = new KuzuQueries();
  
  try {
    // Get stats
    await queries.getStats();
    
    // Find missing data
    await queries.findOrphanedRecordings();
    await queries.findWorksWithoutRecordings();
    await queries.findPotentialRemixes();
    
    // Find corroboration opportunities
    await queries.findCorroborationOpportunities();
    
    // Example royalty trace
    console.log(chalk.bold.yellow('\n📍 EXAMPLE ROYALTY TRACE'));
    await queries.traceRoyaltyPath('CA21O1200002'); // Genesis
    
    await queries.close();
    
    console.log(chalk.green('\n✅ Analysis complete!'));
    
  } catch (error) {
    console.error(chalk.red('Query failed:'), error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run if called directly
if (import.meta.main) {
  main();
}

export default KuzuQueries;