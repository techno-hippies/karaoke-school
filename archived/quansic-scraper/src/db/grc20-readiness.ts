#!/usr/bin/env bun

/**
 * GRC-20 MINTING READINESS VISUALIZATION
 * 
 * Shows exactly what will be minted to the blockchain
 * Highlights completeness, dead ends, and corroboration status
 */

const kuzu = require('kuzu');
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { getTimescaleClient } from './timescale';

const DB_PATH = './kuzu-music.db';

interface MintingEntity {
  type: string;
  id: string;
  name: string;
  completeness: number;
  critical_fields: Record<string, boolean>;
  relationships: {
    type: string;
    target: string;
    confidence: number;
  }[];
  issues: string[];
  ready: boolean;
}

export class GRC20Readiness {
  private kuzuDb: any;
  private conn: any;
  private tsClient: any;
  
  constructor() {
    if (!fs.existsSync(DB_PATH)) {
      throw new Error('Kuzu database not found. Run sync first!');
    }
    this.kuzuDb = new kuzu.Database(DB_PATH);
    this.conn = new kuzu.Connection(this.kuzuDb);
    this.tsClient = getTimescaleClient();
  }
  
  async close() {
    await this.conn.close();
  }
  
  /**
   * Check artist completeness for minting
   */
  async checkArtist(artistId: string): Promise<MintingEntity> {
    // Get artist data
    const artist = await this.conn.query(`
      MATCH (a:Artist {id: '${artistId}'})
      RETURN a.id as id, a.name as name, a.ipis as ipis, 
             a.isni as isni, a.spotify_id as spotify_id,
             a.birth_date as birth_date
    `);
    const artistData = await artist.getAll();
    
    if (artistData.length === 0) {
      throw new Error(`Artist ${artistId} not found`);
    }
    
    const a = artistData[0];
    const issues: string[] = [];
    
    // Check critical fields for royalty calculation
    const critical_fields = {
      name: !!a.name,
      ipis: a.ipis && a.ipis.length > 0,
      isni: !!a.isni,
      birth_date: !!a.birth_date,
      spotify_id: !!a.spotify_id
    };
    
    // Check for IPIs (CRITICAL for royalties)
    if (!critical_fields.ipis) {
      issues.push('❌ No IPI numbers - cannot receive royalties!');
    }
    
    // Get all relationships
    const relationships: any[] = [];
    
    // Works composed
    const works = await this.conn.query(`
      MATCH (a:Artist {id: '${artistId}'})<-[:COMPOSED_BY]-(w:Work)
      RETURN w.id as id, w.title as title
    `);
    const workData = await works.getAll();
    
    workData.forEach((w: any) => {
      relationships.push({
        type: 'COMPOSED',
        target: `Work: ${w.title}`,
        confidence: 1.0
      });
    });
    
    if (workData.length === 0) {
      issues.push('⚠️ No works linked - artist has no compositions');
    }
    
    // Recordings performed
    const recordings = await this.conn.query(`
      MATCH (a:Artist {id: '${artistId}'})<-[:PERFORMED_BY]-(r:Recording)
      RETURN r.id as id, r.title as title
    `);
    const recordingData = await recordings.getAll();
    
    recordingData.forEach((r: any) => {
      relationships.push({
        type: 'PERFORMED',
        target: `Recording: ${r.title}`,
        confidence: 1.0
      });
    });
    
    // Calculate completeness
    const fieldCount = Object.keys(critical_fields).length;
    const completeCount = Object.values(critical_fields).filter(v => v).length;
    const completeness = (completeCount / fieldCount) * 100;
    
    // Determine if ready to mint
    const ready = critical_fields.ipis && critical_fields.name && 
                  (workData.length > 0 || recordingData.length > 0);
    
    if (!ready && issues.length === 0) {
      issues.push('⚠️ Entity isolated - no musical connections');
    }
    
    return {
      type: 'Artist',
      id: a.id,
      name: a.name,
      completeness,
      critical_fields,
      relationships,
      issues,
      ready
    };
  }
  
  /**
   * Check work completeness for minting
   */
  async checkWork(workId: string): Promise<MintingEntity> {
    const work = await this.conn.query(`
      MATCH (w:Work {id: '${workId}'})
      RETURN w.id as id, w.title as title, w.iswcs as iswcs
    `);
    const workData = await work.getAll();
    
    if (workData.length === 0) {
      throw new Error(`Work ${workId} not found`);
    }
    
    const w = workData[0];
    const issues: string[] = [];
    const relationships: any[] = [];
    
    // Critical fields for works
    const critical_fields = {
      title: !!w.title,
      iswc: w.iswcs && w.iswcs.length > 0 && w.iswcs[0] !== 'null'
    };
    
    if (!critical_fields.iswc) {
      issues.push('❌ No ISWC - cannot be identified in royalty systems!');
    }
    
    // Check composers
    const composers = await this.conn.query(`
      MATCH (w:Work {id: '${workId}'})-[:COMPOSED_BY]->(a:Artist)
      RETURN a.id as id, a.name as name, a.ipis as ipis
    `);
    const composerData = await composers.getAll();
    
    if (composerData.length === 0) {
      issues.push('❌ No composers - dead end for royalty flow!');
    } else {
      composerData.forEach((c: any) => {
        const hasIPI = c.ipis && c.ipis.length > 0;
        relationships.push({
          type: 'COMPOSER',
          target: `${c.name} ${hasIPI ? '✓' : '(No IPI!)'}`,
          confidence: 1.0
        });
        if (!hasIPI) {
          issues.push(`⚠️ Composer ${c.name} has no IPI`);
        }
      });
    }
    
    // Check recordings
    const recordings = await this.conn.query(`
      MATCH (w:Work {id: '${workId}'})<-[:RECORDING_OF]-(r:Recording)
      RETURN r.id as id, r.title as title
    `);
    const recordingData = await recordings.getAll();
    
    if (recordingData.length === 0) {
      issues.push('⚠️ No recordings - work never performed');
    } else {
      recordingData.forEach((r: any) => {
        relationships.push({
          type: 'RECORDING',
          target: r.title,
          confidence: 1.0
        });
      });
    }
    
    // Check publishers
    const publishers = await this.conn.query(`
      MATCH (w:Work {id: '${workId}'})-[p:PUBLISHED_BY]->(pub:Publisher)
      RETURN pub.name as name, p.share as share
    `);
    const publisherData = await publishers.getAll();
    
    publisherData.forEach((p: any) => {
      relationships.push({
        type: 'PUBLISHER',
        target: `${p.name} (${p.share}%)`,
        confidence: 1.0
      });
    });
    
    const completeness = (Object.values(critical_fields).filter(v => v).length / 
                          Object.keys(critical_fields).length) * 100;
    
    const ready = critical_fields.iswc && composerData.length > 0;
    
    return {
      type: 'Work',
      id: w.id,
      name: w.title,
      completeness,
      critical_fields,
      relationships,
      issues,
      ready
    };
  }
  
  /**
   * Check recording completeness
   */
  async checkRecording(recordingId: string): Promise<MintingEntity> {
    const recording = await this.conn.query(`
      MATCH (r:Recording {id: '${recordingId}'})
      RETURN r.id as id, r.isrc as isrc, r.title as title,
             r.spotify_id as spotify_id, r.duration_ms as duration
    `);
    const recordingData = await recording.getAll();
    
    if (recordingData.length === 0) {
      throw new Error(`Recording ${recordingId} not found`);
    }
    
    const r = recordingData[0];
    const issues: string[] = [];
    const relationships: any[] = [];
    
    const critical_fields = {
      title: !!r.title,
      isrc: !!r.isrc && r.isrc !== r.id,
      duration: !!r.duration,
      spotify_id: !!r.spotify_id
    };
    
    if (!critical_fields.isrc) {
      issues.push('⚠️ Using ID as ISRC - may not be valid');
    }
    
    // Check work connection
    const work = await this.conn.query(`
      MATCH (r:Recording {id: '${recordingId}'})-[:RECORDING_OF]->(w:Work)
      RETURN w.id as id, w.title as title
    `);
    const workData = await work.getAll();
    
    if (workData.length === 0) {
      issues.push('❌ No work linked - dead end for composition royalties!');
    } else {
      workData.forEach((w: any) => {
        relationships.push({
          type: 'WORK',
          target: w.title,
          confidence: 1.0
        });
      });
    }
    
    // Check performers
    const performers = await this.conn.query(`
      MATCH (r:Recording {id: '${recordingId}'})-[:PERFORMED_BY]->(a:Artist)
      RETURN a.id as id, a.name as name
    `);
    const performerData = await performers.getAll();
    
    if (performerData.length === 0) {
      issues.push('❌ No performers - dead end for performance royalties!');
    } else {
      performerData.forEach((p: any) => {
        relationships.push({
          type: 'PERFORMER',
          target: p.name,
          confidence: 1.0
        });
      });
    }
    
    const completeness = (Object.values(critical_fields).filter(v => v).length / 
                          Object.keys(critical_fields).length) * 100;
    
    const ready = workData.length > 0 && performerData.length > 0;
    
    return {
      type: 'Recording',
      id: r.id,
      name: r.title,
      completeness,
      critical_fields,
      relationships,
      issues,
      ready
    };
  }
  
  /**
   * Generate full minting readiness report
   */
  async generateMintingReport() {
    console.log(chalk.bold.magenta(`
╔════════════════════════════════════════╗
║   GRC-20 MINTING READINESS REPORT      ║
║   Blockchain Deployment Validation     ║
╚════════════════════════════════════════╝
    `));
    
    const stats = {
      artists: { total: 0, ready: 0, issues: 0 },
      works: { total: 0, ready: 0, issues: 0 },
      recordings: { total: 0, ready: 0, issues: 0 }
    };
    
    // Check Grimes specifically
    console.log(chalk.bold.cyan('\n🎤 PRIMARY ARTIST: GRIMES\n'));
    
    try {
      const grimes = await this.checkArtist('0000000356358936');
      this.displayEntity(grimes);
      
      // Check all her works
      console.log(chalk.bold.yellow('\n🎵 GRIMES WORKS\n'));
      
      const works = await this.conn.query(`
        MATCH (a:Artist {id: '0000000356358936'})<-[:COMPOSED_BY]-(w:Work)
        RETURN w.id as id
        LIMIT 10
      `);
      const workIds = await works.getAll();
      
      for (const w of workIds) {
        const work = await this.checkWork(w.id);
        stats.works.total++;
        if (work.ready) stats.works.ready++;
        if (work.issues.length > 0) stats.works.issues++;
        
        this.displayEntity(work, true);
      }
      
      // Check all her recordings
      console.log(chalk.bold.yellow('\n🎧 GRIMES RECORDINGS\n'));
      
      const recordings = await this.conn.query(`
        MATCH (a:Artist {id: '0000000356358936'})<-[:PERFORMED_BY]-(r:Recording)
        RETURN r.id as id
        LIMIT 10
      `);
      const recordingIds = await recordings.getAll();
      
      for (const r of recordingIds) {
        const recording = await this.checkRecording(r.id);
        stats.recordings.total++;
        if (recording.ready) stats.recordings.ready++;
        if (recording.issues.length > 0) stats.recordings.issues++;
        
        this.displayEntity(recording, true);
      }
      
    } catch (e) {
      console.error(chalk.red('Error checking Grimes:'), e);
    }
    
    // Summary statistics
    console.log(chalk.bold.cyan('\n📊 MINTING READINESS SUMMARY\n'));
    
    console.log(chalk.white('Artists:'));
    console.log(chalk.gray(`  Total: ${stats.artists.total}`));
    console.log(chalk.green(`  Ready: ${stats.artists.ready}`));
    console.log(chalk.yellow(`  With Issues: ${stats.artists.issues}`));
    
    console.log(chalk.white('\nWorks:'));
    console.log(chalk.gray(`  Total: ${stats.works.total}`));
    console.log(chalk.green(`  Ready: ${stats.works.ready}`));
    console.log(chalk.yellow(`  With Issues: ${stats.works.issues}`));
    
    console.log(chalk.white('\nRecordings:'));
    console.log(chalk.gray(`  Total: ${stats.recordings.total}`));
    console.log(chalk.green(`  Ready: ${stats.recordings.ready}`));
    console.log(chalk.yellow(`  With Issues: ${stats.recordings.issues}`));
    
    const totalReady = stats.artists.ready + stats.works.ready + stats.recordings.ready;
    const totalEntities = stats.artists.total + stats.works.total + stats.recordings.total;
    
    console.log(chalk.bold.magenta(`\n🚀 MINTING READINESS: ${totalReady}/${totalEntities} entities ready`));
    
    if (totalReady === totalEntities) {
      console.log(chalk.bold.green('✅ ALL ENTITIES READY FOR GRC-20 MINTING!'));
    } else {
      console.log(chalk.bold.yellow('⚠️ Some entities have issues that need resolution'));
    }
    
    return stats;
  }
  
  /**
   * Display entity minting status
   */
  private displayEntity(entity: MintingEntity, compact = false) {
    const statusIcon = entity.ready ? '✅' : '❌';
    const completeBar = this.generateProgressBar(entity.completeness);
    
    if (!compact) {
      console.log(chalk.bold(`${statusIcon} ${entity.type}: ${entity.name}`));
      console.log(chalk.gray(`   ID: ${entity.id}`));
      console.log(chalk.cyan(`   Completeness: ${completeBar} ${entity.completeness.toFixed(0)}%`));
      
      // Show critical fields
      console.log(chalk.gray('   Critical Fields:'));
      for (const [field, present] of Object.entries(entity.critical_fields)) {
        const icon = present ? '✓' : '✗';
        const color = present ? chalk.green : chalk.red;
        console.log(color(`     ${icon} ${field}`));
      }
      
      // Show relationships
      if (entity.relationships.length > 0) {
        console.log(chalk.gray('   Relationships:'));
        entity.relationships.slice(0, 5).forEach(rel => {
          console.log(chalk.blue(`     → ${rel.type}: ${rel.target}`));
        });
        if (entity.relationships.length > 5) {
          console.log(chalk.gray(`     ... and ${entity.relationships.length - 5} more`));
        }
      }
      
      // Show issues
      if (entity.issues.length > 0) {
        console.log(chalk.yellow('   Issues:'));
        entity.issues.forEach(issue => {
          console.log(chalk.yellow(`     ${issue}`));
        });
      }
      
      console.log('');
    } else {
      // Compact view
      const status = entity.ready ? chalk.green('READY') : chalk.red('BLOCKED');
      console.log(`  ${statusIcon} ${entity.name.substring(0, 40).padEnd(40)} ${completeBar} ${status}`);
      if (entity.issues.length > 0 && !entity.ready) {
        console.log(chalk.red(`     → ${entity.issues[0]}`));
      }
    }
  }
  
  private generateProgressBar(percentage: number): string {
    const filled = Math.round(percentage / 10);
    const empty = 10 - filled;
    return chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
  }
  
  /**
   * Export minting manifest
   */
  async exportMintingManifest(outputPath: string) {
    console.log(chalk.yellow('Generating minting manifest...'));
    
    const manifest = {
      generated_at: new Date().toISOString(),
      entities: {
        artists: [] as any[],
        works: [] as any[],
        recordings: [] as any[]
      },
      statistics: {
        total_entities: 0,
        ready_to_mint: 0,
        blocked_entities: 0,
        completeness: 0
      },
      issues: [] as string[],
      ready_for_blockchain: false
    };
    
    // Get all Grimes entities
    const grimes = await this.checkArtist('0000000356358936');
    if (grimes.ready) {
      manifest.entities.artists.push({
        id: grimes.id,
        name: grimes.name,
        ipis: grimes.critical_fields.ipis ? 'present' : 'missing',
        relationships: grimes.relationships.length
      });
    }
    
    // Get works
    const works = await this.conn.query(`
      MATCH (a:Artist {id: '0000000356358936'})<-[:COMPOSED_BY]-(w:Work)
      RETURN w.id as id
    `);
    const workIds = await works.getAll();
    
    for (const w of workIds) {
      const work = await this.checkWork(w.id);
      if (work.ready) {
        manifest.entities.works.push({
          id: work.id,
          title: work.name,
          iswc: work.critical_fields.iswc ? 'present' : 'missing',
          relationships: work.relationships.length
        });
      } else {
        manifest.issues.push(...work.issues.map(i => `Work ${work.name}: ${i}`));
      }
    }
    
    // Update statistics
    manifest.statistics.total_entities = manifest.entities.artists.length + 
                                         manifest.entities.works.length + 
                                         manifest.entities.recordings.length;
    manifest.statistics.ready_to_mint = manifest.statistics.total_entities;
    manifest.statistics.blocked_entities = manifest.issues.length;
    manifest.ready_for_blockchain = manifest.issues.length === 0;
    
    // Save manifest
    fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2));
    console.log(chalk.green(`✓ Manifest saved to ${outputPath}`));
    
    return manifest;
  }
}

// CLI interface
async function main() {
  const readiness = new GRC20Readiness();
  
  try {
    // Generate full report
    await readiness.generateMintingReport();
    
    // Export manifest
    const manifestPath = './output/grc20-manifest.json';
    const manifest = await readiness.exportMintingManifest(manifestPath);
    
    console.log(chalk.bold.cyan('\n📄 MANIFEST EXPORTED\n'));
    console.log(chalk.gray(`Location: ${path.resolve(manifestPath)}`));
    console.log(chalk.gray(`Ready for blockchain: ${manifest.ready_for_blockchain ? 'YES' : 'NO'}`));
    
    await readiness.close();
    
  } catch (error) {
    console.error(chalk.red('Report generation failed:'), error);
    process.exit(1);
  }
  
  process.exit(0);
}

if (import.meta.main) {
  main();
}

export default GRC20Readiness;