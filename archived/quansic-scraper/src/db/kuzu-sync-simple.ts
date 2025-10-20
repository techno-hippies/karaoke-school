#!/usr/bin/env bun

/**
 * SIMPLE KUZU SYNC
 * 
 * Simplified sync from PostgreSQL to Kuzu using basic CREATE statements
 * Since Kuzu doesn't support MERGE, we'll clear and reload
 */

const kuzu = require('kuzu');
import chalk from 'chalk';
import { db, initDb } from './postgres';
import { sql } from 'drizzle-orm';
import fs from 'fs';

const DB_PATH = './kuzu-music.db';

export class SimpleKuzuSync {
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
   * Clear all data (keeping schema)
   */
  async clearData() {
    console.log(chalk.yellow('Clearing existing data...'));
    
    // Delete all relationships first
    const relTables = [
      'RECORDING_OF', 'COMPOSED_BY', 'PERFORMED_BY', 
      'PUBLISHED_BY', 'PART_OF', 'ALSO_KNOWN_AS'
    ];
    
    for (const rel of relTables) {
      try {
        await this.conn.query(`MATCH ()-[r:${rel}]->() DELETE r`);
      } catch (e) {}
    }
    
    // Delete all nodes
    const nodeTables = [
      'Artist', 'Work', 'Recording', 'Publisher', 
      'Release', 'Source', 'AlternativeName'
    ];
    
    for (const node of nodeTables) {
      try {
        await this.conn.query(`MATCH (n:${node}) DELETE n`);
      } catch (e) {}
    }
    
    console.log(chalk.gray('  ✓ Data cleared'));
  }
  
  /**
   * Sync all data
   */
  async syncAll() {
    console.log(chalk.bold.cyan('\n🔄 SYNCING DATA TO KUZU\n'));
    
    await initDb();
    await this.clearData();
    
    // Load nodes
    await this.loadSources();
    await this.loadArtists();
    await this.loadWorks();
    await this.loadRecordings();
    await this.loadPublishers();
    
    // Load relationships
    await this.loadRecordingOfRelationships();
    await this.loadComposedByRelationships();
    await this.loadPerformedByRelationships();
    await this.loadPublishedByRelationships();
    
    console.log(chalk.green('\n✅ Sync complete!'));
    await this.showStats();
  }
  
  async loadSources() {
    console.log(chalk.yellow('Loading sources...'));
    
    await this.conn.query(`
      CREATE (s1:Source {id: 'quansic', name: 'Quansic', source_type: 'API'})
    `);
    await this.conn.query(`
      CREATE (s2:Source {id: 'spotify', name: 'Spotify', source_type: 'API'})
    `);
    await this.conn.query(`
      CREATE (s3:Source {id: 'genius', name: 'Genius', source_type: 'API'})
    `);
    await this.conn.query(`
      CREATE (s4:Source {id: 'mlc', name: 'MLC', source_type: 'API'})
    `);
    
    console.log(chalk.gray('  ✓ 4 sources'));
  }
  
  async loadArtists() {
    console.log(chalk.yellow('Loading artists...'));
    
    const artists = await db.execute(sql`
      SELECT * FROM quansic_artists LIMIT 10
    `);
    
    let count = 0;
    for (const artist of artists.rows) {
      // Parse IPIs
      let ipis: string[] = [];
      if (artist.ipi) ipis.push(artist.ipi);
      if (artist.all_identifiers) {
        try {
          const allIds = JSON.parse(artist.all_identifiers);
          if (allIds.ipis) ipis = allIds.ipis;
        } catch (e) {}
      }
      
      // Build properties string
      const props = [
        `id: '${artist.id}'`,
        `name: '${artist.name.replace(/'/g, "\\'")}'`,
        artist.type ? `type: '${artist.type}'` : null,
        artist.nationality ? `nationality: '${artist.nationality}'` : null,
        artist.isni ? `isni: '${artist.isni}'` : null,
        ipis.length > 0 ? `ipis: ['${ipis.join("','")}']` : `ipis: []`,
        `confidence: 1.0`
      ].filter(p => p !== null).join(', ');
      
      await this.conn.query(`CREATE (a:Artist {${props}})`);
      count++;
    }
    
    console.log(chalk.gray(`  ✓ ${count} artists`));
  }
  
  async loadWorks() {
    console.log(chalk.yellow('Loading works...'));
    
    const works = await db.execute(sql`
      SELECT * FROM quansic_works 
      WHERE id IS NOT NULL AND id != 'null'
      LIMIT 100
    `);
    
    let count = 0;
    for (const work of works.rows) {
      const title = work.title.replace(/'/g, "\\'");
      const props = [
        `id: '${work.id}'`,
        `title: '${title}'`,
        `iswcs: ['${work.id}']`,
        `confidence: ${work.q1_score ? work.q1_score / 100.0 : 1.0}`
      ].join(', ');
      
      try {
        await this.conn.query(`CREATE (w:Work {${props}})`);
        count++;
      } catch (e) {
        // Skip on error
      }
    }
    
    console.log(chalk.gray(`  ✓ ${count} works`));
  }
  
  async loadRecordings() {
    console.log(chalk.yellow('Loading recordings...'));
    
    const recordings = await db.execute(sql`
      SELECT r.*, s.popularity, s.explicit
      FROM quansic_recordings r
      LEFT JOIN spotify_tracks s ON r.id = s.isrc
      LIMIT 100
    `);
    
    let count = 0;
    for (const rec of recordings.rows) {
      const title = rec.title.replace(/'/g, "\\'");
      const props = [
        `id: '${rec.id}'`,
        `isrc: '${rec.id}'`,
        `title: '${title}'`,
        rec.duration_ms ? `duration_ms: ${rec.duration_ms}` : null,
        rec.year ? `year: ${parseInt(rec.year)}` : null,
        rec.popularity ? `popularity: ${rec.popularity}` : null,
        `explicit: ${rec.explicit || false}`,
        `confidence: 1.0`
      ].filter(p => p !== null).join(', ');
      
      try {
        await this.conn.query(`CREATE (r:Recording {${props}})`);
        count++;
      } catch (e) {
        // Skip on error
      }
    }
    
    console.log(chalk.gray(`  ✓ ${count} recordings`));
  }
  
  async loadPublishers() {
    console.log(chalk.yellow('Loading publishers...'));
    
    const publishers = await db.execute(sql`
      SELECT DISTINCT
        COALESCE(publisher_ipi, publisher_name) as id,
        publisher_name as name,
        publisher_ipi as ipi
      FROM mlc_publishers
      WHERE publisher_name IS NOT NULL
      LIMIT 50
    `);
    
    let count = 0;
    for (const pub of publishers.rows) {
      const name = pub.name.replace(/'/g, "\\'");
      const id = pub.id.replace(/'/g, "\\'");
      const props = [
        `id: '${id}'`,
        `name: '${name}'`,
        pub.ipi ? `ipi: '${pub.ipi}'` : null,
        `confidence: 1.0`
      ].filter(p => p !== null).join(', ');
      
      try {
        await this.conn.query(`CREATE (p:Publisher {${props}})`);
        count++;
      } catch (e) {
        // Skip on error
      }
    }
    
    console.log(chalk.gray(`  ✓ ${count} publishers`));
  }
  
  async loadRecordingOfRelationships() {
    console.log(chalk.yellow('Loading RECORDING_OF relationships...'));
    
    const relationships = await db.execute(sql`
      SELECT * FROM quansic_recording_works
      LIMIT 100
    `);
    
    let count = 0;
    for (const rel of relationships.rows) {
      try {
        await this.conn.query(`
          MATCH (r:Recording {id: '${rel.recording_isrc}'}), (w:Work {id: '${rel.work_iswc}'})
          CREATE (r)-[:RECORDING_OF {
            confidence: ${rel.q1_score ? rel.q1_score / 100.0 : 1.0},
            source: 'quansic',
            q1_score: ${rel.q1_score || 0},
            q2_score: ${rel.q2_score || 0}
          }]->(w)
        `);
        count++;
      } catch (e) {
        // Nodes might not exist
      }
    }
    
    console.log(chalk.gray(`  ✓ ${count} RECORDING_OF relationships`));
  }
  
  async loadComposedByRelationships() {
    console.log(chalk.yellow('Loading COMPOSED_BY relationships...'));
    
    const relationships = await db.execute(sql`
      SELECT id as work_id, artist_id
      FROM quansic_works
      WHERE id IS NOT NULL AND id != 'null' AND artist_id IS NOT NULL
      LIMIT 100
    `);
    
    let count = 0;
    for (const rel of relationships.rows) {
      try {
        await this.conn.query(`
          MATCH (w:Work {id: '${rel.work_id}'}), (a:Artist {id: '${rel.artist_id}'})
          CREATE (w)-[:COMPOSED_BY {share: 100.0, role: 'Composer'}]->(a)
        `);
        count++;
      } catch (e) {
        // Nodes might not exist
      }
    }
    
    console.log(chalk.gray(`  ✓ ${count} COMPOSED_BY relationships`));
  }
  
  async loadPerformedByRelationships() {
    console.log(chalk.yellow('Loading PERFORMED_BY relationships...'));
    
    const relationships = await db.execute(sql`
      SELECT id as recording_id, artist_id
      FROM quansic_recordings
      WHERE artist_id IS NOT NULL
      LIMIT 100
    `);
    
    let count = 0;
    for (const rel of relationships.rows) {
      try {
        await this.conn.query(`
          MATCH (r:Recording {id: '${rel.recording_id}'}), (a:Artist {id: '${rel.artist_id}'})
          CREATE (r)-[:PERFORMED_BY {role: 'Primary Artist'}]->(a)
        `);
        count++;
      } catch (e) {
        // Nodes might not exist
      }
    }
    
    console.log(chalk.gray(`  ✓ ${count} PERFORMED_BY relationships`));
  }
  
  async loadPublishedByRelationships() {
    console.log(chalk.yellow('Loading PUBLISHED_BY relationships...'));
    
    const relationships = await db.execute(sql`
      SELECT 
        mp.work_id,
        COALESCE(mp.publisher_ipi, mp.publisher_name) as publisher_id,
        mp.share_percentage,
        mw.iswc
      FROM mlc_publishers mp
      JOIN mlc_works mw ON mp.work_id = mw.id
      WHERE mp.publisher_name IS NOT NULL AND mw.iswc IS NOT NULL
      LIMIT 50
    `);
    
    let count = 0;
    for (const rel of relationships.rows) {
      const pubId = rel.publisher_id.replace(/'/g, "\\'");
      try {
        await this.conn.query(`
          MATCH (w:Work {id: '${rel.iswc}'}), (p:Publisher {id: '${pubId}'})
          CREATE (w)-[:PUBLISHED_BY {share: ${rel.share_percentage || 0}}]->(p)
        `);
        count++;
      } catch (e) {
        // Nodes might not exist  
      }
    }
    
    console.log(chalk.gray(`  ✓ ${count} PUBLISHED_BY relationships`));
  }
  
  async showStats() {
    console.log(chalk.bold.cyan('\n📊 KUZU GRAPH STATISTICS\n'));
    
    try {
      // Count nodes
      const nodeTypes = ['Artist', 'Work', 'Recording', 'Publisher', 'Source'];
      
      for (const nodeType of nodeTypes) {
        const result = await this.conn.query(`MATCH (n:${nodeType}) RETURN COUNT(n) as count`);
        const data = await result.getAll();
        console.log(chalk.gray(`${nodeType}: ${data[0]?.count || 0}`));
      }
      
      console.log(chalk.yellow('\nRelationships:'));
      
      // Count specific relationships
      const relQueries = [
        { query: `MATCH (:Recording)-[r:RECORDING_OF]->(:Work) RETURN COUNT(r) as count`, name: 'RECORDING_OF' },
        { query: `MATCH (:Work)-[r:COMPOSED_BY]->(:Artist) RETURN COUNT(r) as count`, name: 'COMPOSED_BY' },
        { query: `MATCH (:Recording)-[r:PERFORMED_BY]->(:Artist) RETURN COUNT(r) as count`, name: 'PERFORMED_BY' },
        { query: `MATCH (:Work)-[r:PUBLISHED_BY]->(:Publisher) RETURN COUNT(r) as count`, name: 'PUBLISHED_BY' }
      ];
      
      for (const { query, name } of relQueries) {
        try {
          const result = await this.conn.query(query);
          const data = await result.getAll();
          console.log(chalk.gray(`${name}: ${data[0]?.count || 0}`));
        } catch (e) {
          console.log(chalk.gray(`${name}: 0`));
        }
      }
      
    } catch (error) {
      console.error(chalk.red('Error getting stats:'), error);
    }
  }
}

// CLI interface
async function main() {
  console.log(chalk.bold.magenta(`
╔════════════════════════════════════════╗
║   SIMPLE KUZU SYNC                     ║
║   PostgreSQL → Kuzu Graph              ║
╚════════════════════════════════════════╝
  `));
  
  const sync = new SimpleKuzuSync();
  
  try {
    await sync.syncAll();
    await sync.close();
    
    console.log(chalk.green('\n✅ Sync completed successfully!'));
    
  } catch (error) {
    console.error(chalk.red('Sync failed:'), error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run if called directly
if (import.meta.main) {
  main();
}

export default SimpleKuzuSync;