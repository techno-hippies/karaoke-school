#!/usr/bin/env bun

/**
 * KUZU SYNC PIPELINE
 * 
 * Syncs data from PostgreSQL to Kuzu graph database
 * Maps relational data to graph structure
 * Handles provenance tracking
 */

const kuzu = require('kuzu');
import chalk from 'chalk';
import { db, initDb } from './postgres';
import { sql } from 'drizzle-orm';
import fs from 'fs';

const DB_PATH = './kuzu-music.db';

export class KuzuSync {
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
   * Sync all data from PostgreSQL to Kuzu
   */
  async syncAll() {
    console.log(chalk.bold.cyan('\n🔄 SYNCING DATA TO KUZU\n'));
    
    await initDb();
    
    // Sync in order to respect foreign key relationships
    await this.syncSources();
    await this.syncArtists();
    await this.syncWorks();
    await this.syncRecordings();
    await this.syncPublishers();
    await this.syncReleases();
    
    // Sync relationships
    await this.syncRecordingOfRelationships();
    await this.syncComposedByRelationships();
    await this.syncPerformedByRelationships();
    await this.syncPublishedByRelationships();
    
    console.log(chalk.green('\n✅ Sync complete!'));
    
    // Show statistics
    await this.showStats();
  }
  
  /**
   * Sync source nodes (for provenance)
   */
  async syncSources() {
    console.log(chalk.yellow('Syncing sources...'));
    
    const sources = [
      { id: 'quansic', name: 'Quansic', source_type: 'API', api_version: '2.0' },
      { id: 'spotify', name: 'Spotify', source_type: 'API', api_version: 'v1' },
      { id: 'genius', name: 'Genius', source_type: 'API', api_version: '1.0' },
      { id: 'mlc', name: 'MLC', source_type: 'API', api_version: 'v2' }
    ];
    
    for (const source of sources) {
      // Kuzu doesn't support MERGE yet, use CREATE OR REPLACE pattern
      // First try to create, if it exists it will fail silently
      try {
        await this.conn.query(`
          CREATE (s:Source {
            id: '${source.id}',
            name: '${source.name}',
            source_type: '${source.source_type}',
            api_version: '${source.api_version}',
            last_updated: timestamp()
          })
        `);
      } catch (e) {
        // Already exists, update it
        await this.conn.query(`
          MATCH (s:Source {id: '${source.id}'})
          SET s.last_updated = timestamp()
          RETURN s
        `);
      }
    }
    
    console.log(chalk.gray(`  ✓ ${sources.length} sources`));
  }
  
  /**
   * Sync artist nodes
   */
  async syncArtists() {
    console.log(chalk.yellow('Syncing artists...'));
    
    const artists = await db.execute(sql`
      SELECT DISTINCT
        a.id,
        a.name,
        a.type,
        a.birth_date,
        a.nationality,
        a.isni,
        a.ipi,
        a.spotify_id,
        a.apple_id,
        a.deezer_id,
        a.musicbrainz_id,
        a.all_identifiers
      FROM quansic_artists a
    `);
    
    let count = 0;
    for (const artist of artists.rows) {
      // Parse all IPIs from JSON
      let ipis: string[] = [];
      if (artist.ipi) ipis.push(artist.ipi);
      if (artist.all_identifiers) {
        try {
          const allIds = JSON.parse(artist.all_identifiers);
          if (allIds.ipis) {
            ipis = [...new Set([...ipis, ...allIds.ipis])];
          }
        } catch (e) {}
      }
      
      await this.conn.query(`
        MERGE (a:Artist {id: $id})
        ON CREATE SET
          a.name = $name,
          a.type = $type,
          a.birth_date = $birth_date,
          a.nationality = $nationality,
          a.ipis = $ipis,
          a.isni = $isni,
          a.spotify_id = $spotify_id,
          a.apple_id = $apple_id,
          a.deezer_id = $deezer_id,
          a.musicbrainz_id = $musicbrainz_id,
          a.confidence = 1.0
      `, {
        id: artist.id,
        name: artist.name,
        type: artist.type || 'Person',
        birth_date: artist.birth_date,
        nationality: artist.nationality,
        ipis: ipis,
        isni: artist.isni,
        spotify_id: artist.spotify_id,
        apple_id: artist.apple_id,
        deezer_id: artist.deezer_id,
        musicbrainz_id: artist.musicbrainz_id
      });
      
      count++;
    }
    
    // Also sync alternative names
    const aliases = await db.execute(sql`
      SELECT * FROM quansic_artist_aliases
    `);
    
    for (const alias of aliases.rows) {
      await this.conn.query(`
        MERGE (n:AlternativeName {id: $id})
        ON CREATE SET
          n.name = $name,
          n.language = $language,
          n.name_type = 'Alias'
      `, {
        id: `${alias.artist_id}_${alias.id}`,
        name: alias.name,
        language: alias.language
      });
      
      // Create relationship
      await this.conn.query(`
        MATCH (a:Artist {id: $artist_id}), (n:AlternativeName {id: $alias_id})
        MERGE (a)-[:ALSO_KNOWN_AS]->(n)
      `, {
        artist_id: alias.artist_id,
        alias_id: `${alias.artist_id}_${alias.id}`
      });
    }
    
    console.log(chalk.gray(`  ✓ ${count} artists, ${aliases.rows.length} aliases`));
  }
  
  /**
   * Sync work nodes
   */
  async syncWorks() {
    console.log(chalk.yellow('Syncing works...'));
    
    // Get Quansic works
    const quansicWorks = await db.execute(sql`
      SELECT * FROM quansic_works WHERE id IS NOT NULL AND id != 'null'
    `);
    
    let count = 0;
    for (const work of quansicWorks.rows) {
      await this.conn.query(`
        MERGE (w:Work {id: $id})
        ON CREATE SET
          w.title = $title,
          w.iswcs = [$iswc],
          w.confidence = $confidence
      `, {
        id: work.id,
        title: work.title,
        iswc: work.id,
        confidence: work.q1_score ? work.q1_score / 100.0 : 1.0
      });
      count++;
    }
    
    // Get MLC works and update/create
    const mlcWorks = await db.execute(sql`
      SELECT * FROM mlc_works
    `);
    
    for (const work of mlcWorks.rows) {
      if (work.iswc) {
        // Update existing or create new
        await this.conn.query(`
          MERGE (w:Work {id: $id})
          ON CREATE SET
            w.title = $title,
            w.iswcs = [$iswc],
            w.mlc_code = $mlc_code,
            w.confidence = 1.0
          ON MATCH SET
            w.mlc_code = $mlc_code
        `, {
          id: work.iswc,
          title: work.title,
          iswc: work.iswc,
          mlc_code: work.id
        });
      } else {
        // Create with MLC ID if no ISWC
        await this.conn.query(`
          MERGE (w:Work {id: $id})
          ON CREATE SET
            w.title = $title,
            w.iswcs = [],
            w.mlc_code = $mlc_code,
            w.confidence = 0.8
        `, {
          id: `mlc_${work.id}`,
          title: work.title,
          mlc_code: work.id
        });
      }
    }
    
    console.log(chalk.gray(`  ✓ ${count} Quansic works, ${mlcWorks.rows.length} MLC works`));
  }
  
  /**
   * Sync recording nodes
   */
  async syncRecordings() {
    console.log(chalk.yellow('Syncing recordings...'));
    
    const recordings = await db.execute(sql`
      SELECT 
        r.*,
        s.spotify_id as spotify_track_id,
        s.popularity,
        s.explicit
      FROM quansic_recordings r
      LEFT JOIN spotify_tracks s ON r.id = s.isrc
    `);
    
    let count = 0;
    for (const rec of recordings.rows) {
      await this.conn.query(`
        MERGE (r:Recording {id: $id})
        ON CREATE SET
          r.isrc = $isrc,
          r.title = $title,
          r.duration_ms = $duration_ms,
          r.year = $year,
          r.spotify_id = $spotify_id,
          r.apple_id = $apple_id,
          r.deezer_id = $deezer_id,
          r.popularity = $popularity,
          r.explicit = $explicit,
          r.confidence = 1.0
      `, {
        id: rec.id,
        isrc: rec.id,
        title: rec.title,
        duration_ms: rec.duration_ms,
        year: rec.year ? parseInt(rec.year) : null,
        spotify_id: rec.spotify_track_id || rec.spotify_id,
        apple_id: rec.apple_id,
        deezer_id: rec.deezer_id,
        popularity: rec.popularity,
        explicit: rec.explicit || false
      });
      count++;
    }
    
    console.log(chalk.gray(`  ✓ ${count} recordings`));
  }
  
  /**
   * Sync publisher nodes
   */
  async syncPublishers() {
    console.log(chalk.yellow('Syncing publishers...'));
    
    const publishers = await db.execute(sql`
      SELECT DISTINCT
        COALESCE(publisher_ipi, publisher_name) as id,
        publisher_name as name,
        publisher_ipi as ipi,
        publisher_type,
        administrator_name,
        administrator_ipi
      FROM mlc_publishers
      WHERE publisher_name IS NOT NULL
    `);
    
    let count = 0;
    for (const pub of publishers.rows) {
      await this.conn.query(`
        MERGE (p:Publisher {id: $id})
        ON CREATE SET
          p.name = $name,
          p.ipi = $ipi,
          p.publisher_type = $publisher_type,
          p.administrator = $administrator,
          p.admin_ipi = $admin_ipi,
          p.confidence = 1.0
      `, {
        id: pub.id,
        name: pub.name,
        ipi: pub.ipi,
        publisher_type: pub.publisher_type,
        administrator: pub.administrator_name,
        admin_ipi: pub.administrator_ipi
      });
      count++;
    }
    
    console.log(chalk.gray(`  ✓ ${count} publishers`));
  }
  
  /**
   * Sync release nodes
   */
  async syncReleases() {
    console.log(chalk.yellow('Syncing releases...'));
    
    const releases = await db.execute(sql`
      SELECT * FROM quansic_releases WHERE upc IS NOT NULL
    `);
    
    let count = 0;
    for (const release of releases.rows) {
      await this.conn.query(`
        MERGE (r:Release {id: $id})
        ON CREATE SET
          r.upc = $upc,
          r.title = $title,
          r.release_type = $release_type,
          r.year = $year,
          r.confidence = 1.0
      `, {
        id: release.upc || release.id,
        upc: release.upc,
        title: release.title,
        release_type: release.type,
        year: release.year ? parseInt(release.year) : null
      });
      count++;
    }
    
    console.log(chalk.gray(`  ✓ ${count} releases`));
  }
  
  /**
   * Sync RECORDING_OF relationships
   */
  async syncRecordingOfRelationships() {
    console.log(chalk.yellow('Syncing RECORDING_OF relationships...'));
    
    const relationships = await db.execute(sql`
      SELECT * FROM quansic_recording_works
    `);
    
    let count = 0;
    for (const rel of relationships.rows) {
      try {
        await this.conn.query(`
          MATCH (r:Recording {id: $recording_id}), (w:Work {id: $work_id})
          MERGE (r)-[:RECORDING_OF {
            confidence: $confidence,
            source: 'quansic',
            q1_score: $q1_score,
            q2_score: $q2_score
          }]->(w)
        `, {
          recording_id: rel.recording_isrc,
          work_id: rel.work_iswc,
          confidence: rel.q1_score ? rel.q1_score / 100.0 : 1.0,
          q1_score: rel.q1_score,
          q2_score: rel.q2_score
        });
        count++;
      } catch (e) {
        // Node might not exist
      }
    }
    
    console.log(chalk.gray(`  ✓ ${count} RECORDING_OF relationships`));
  }
  
  /**
   * Sync COMPOSED_BY relationships
   */
  async syncComposedByRelationships() {
    console.log(chalk.yellow('Syncing COMPOSED_BY relationships...'));
    
    const relationships = await db.execute(sql`
      SELECT 
        w.id as work_id,
        w.artist_id,
        wc.contributor_isni
      FROM quansic_works w
      LEFT JOIN quansic_work_contributors wc ON w.id = wc.work_iswc
      WHERE w.id IS NOT NULL AND w.id != 'null'
    `);
    
    let count = 0;
    for (const rel of relationships.rows) {
      const artistId = rel.contributor_isni || rel.artist_id;
      if (artistId) {
        try {
          await this.conn.query(`
            MATCH (w:Work {id: $work_id}), (a:Artist {id: $artist_id})
            MERGE (w)-[:COMPOSED_BY {
              share: 100.0,
              role: 'Composer'
            }]->(a)
          `, {
            work_id: rel.work_id,
            artist_id: artistId
          });
          count++;
        } catch (e) {
          // Node might not exist
        }
      }
    }
    
    console.log(chalk.gray(`  ✓ ${count} COMPOSED_BY relationships`));
  }
  
  /**
   * Sync PERFORMED_BY relationships
   */
  async syncPerformedByRelationships() {
    console.log(chalk.yellow('Syncing PERFORMED_BY relationships...'));
    
    const relationships = await db.execute(sql`
      SELECT id as recording_id, artist_id
      FROM quansic_recordings
      WHERE artist_id IS NOT NULL
    `);
    
    let count = 0;
    for (const rel of relationships.rows) {
      try {
        await this.conn.query(`
          MATCH (r:Recording {id: $recording_id}), (a:Artist {id: $artist_id})
          MERGE (r)-[:PERFORMED_BY {
            role: 'Primary Artist'
          }]->(a)
        `, {
          recording_id: rel.recording_id,
          artist_id: rel.artist_id
        });
        count++;
      } catch (e) {
        // Node might not exist
      }
    }
    
    console.log(chalk.gray(`  ✓ ${count} PERFORMED_BY relationships`));
  }
  
  /**
   * Sync PUBLISHED_BY relationships
   */
  async syncPublishedByRelationships() {
    console.log(chalk.yellow('Syncing PUBLISHED_BY relationships...'));
    
    const relationships = await db.execute(sql`
      SELECT 
        work_id,
        COALESCE(publisher_ipi, publisher_name) as publisher_id,
        share_percentage
      FROM mlc_publishers
      WHERE publisher_name IS NOT NULL
    `);
    
    let count = 0;
    for (const rel of relationships.rows) {
      // Try to find work by MLC code or matching title
      const work = await db.execute(sql`
        SELECT iswc FROM mlc_works WHERE id = ${rel.work_id} AND iswc IS NOT NULL
        UNION
        SELECT id as iswc FROM quansic_works 
        WHERE UPPER(TRIM(title)) = (
          SELECT UPPER(TRIM(title)) FROM mlc_works WHERE id = ${rel.work_id}
        )
        LIMIT 1
      `);
      
      if (work.rows.length > 0) {
        try {
          await this.conn.query(`
            MATCH (w:Work {id: $work_id}), (p:Publisher {id: $publisher_id})
            MERGE (w)-[:PUBLISHED_BY {
              share: $share
            }]->(p)
          `, {
            work_id: work.rows[0].iswc,
            publisher_id: rel.publisher_id,
            share: rel.share_percentage || 0
          });
          count++;
        } catch (e) {
          // Node might not exist
        }
      }
    }
    
    console.log(chalk.gray(`  ✓ ${count} PUBLISHED_BY relationships`));
  }
  
  /**
   * Show statistics after sync
   */
  async showStats() {
    console.log(chalk.bold.cyan('\n📊 KUZU GRAPH STATISTICS\n'));
    
    try {
      // Count nodes
      const nodeTypes = ['Artist', 'Work', 'Recording', 'Publisher', 'Release'];
      for (const nodeType of nodeTypes) {
        const result = await this.conn.query(`MATCH (n:${nodeType}) RETURN COUNT(n) as count`);
        const data = await result.getAll();
        console.log(chalk.gray(`${nodeType}: ${data[0].count}`));
      }
      
      console.log(chalk.yellow('\nRelationships:'));
      
      // Count relationships
      const relTypes = [
        ['Recording', 'RECORDING_OF', 'Work'],
        ['Work', 'COMPOSED_BY', 'Artist'],
        ['Recording', 'PERFORMED_BY', 'Artist'],
        ['Work', 'PUBLISHED_BY', 'Publisher']
      ];
      
      for (const [from, rel, to] of relTypes) {
        const result = await this.conn.query(
          `MATCH (:${from})-[r:${rel}]->(:${to}) RETURN COUNT(r) as count`
        );
        const data = await result.getAll();
        console.log(chalk.gray(`${rel}: ${data[0].count}`));
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
║   KUZU SYNC PIPELINE                   ║
║   PostgreSQL → Kuzu Graph              ║
╚════════════════════════════════════════╝
  `));
  
  const sync = new KuzuSync();
  
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

export default KuzuSync;