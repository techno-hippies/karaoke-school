#!/usr/bin/env bun

/**
 * KUZU DATABASE INITIALIZATION
 * 
 * Creates the music graph schema in Kuzu embedded database
 * Defines nodes: Artist, Work, Recording, Publisher, Source
 * Defines relationships: RECORDING_OF, COMPOSED_BY, PERFORMED_BY, etc.
 */

const kuzu = require('kuzu');
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';

const DB_PATH = './kuzu-music.db';

export async function initializeKuzuDatabase(resetDb = false) {
  console.log(chalk.bold.cyan('\n🎵 INITIALIZING KUZU MUSIC GRAPH\n'));

  // Remove existing database if reset requested
  if (resetDb && fs.existsSync(DB_PATH)) {
    console.log(chalk.yellow('Removing existing database...'));
    fs.rmSync(DB_PATH, { recursive: true, force: true });
  }

  // Create database
  const db = new kuzu.Database(DB_PATH);
  const conn = new kuzu.Connection(db);
  
  console.log(chalk.green(`✓ Created Kuzu database at ${DB_PATH}`));

  try {
    // Create NODE tables
    console.log(chalk.yellow('\nCreating node tables...'));
    
    // Artist node
    await conn.query(`
      CREATE NODE TABLE IF NOT EXISTS Artist(
        id STRING PRIMARY KEY,
        name STRING,
        type STRING,
        birth_date DATE,
        nationality STRING,
        ipis STRING[],
        isni STRING,
        ipn STRING,
        spotify_id STRING,
        apple_id STRING,
        amazon_id STRING,
        deezer_id STRING,
        discogs_id STRING,
        wikidata_id STRING,
        musicbrainz_id STRING,
        merged_isni STRING,
        confidence DOUBLE DEFAULT 1.0
      )
    `);
    console.log(chalk.gray('  ✓ Artist'));

    // Work (Composition) node
    await conn.query(`
      CREATE NODE TABLE IF NOT EXISTS Work(
        id STRING PRIMARY KEY,
        title STRING,
        iswcs STRING[],
        mlc_code STRING,
        duration_ms INT64,
        language STRING,
        confidence DOUBLE DEFAULT 1.0
      )
    `);
    console.log(chalk.gray('  ✓ Work'));

    // Recording node
    await conn.query(`
      CREATE NODE TABLE IF NOT EXISTS Recording(
        id STRING PRIMARY KEY,
        isrc STRING,
        title STRING,
        duration_ms INT64,
        year INT64,
        spotify_id STRING,
        apple_id STRING,
        deezer_id STRING,
        popularity INT64,
        explicit BOOLEAN DEFAULT false,
        confidence DOUBLE DEFAULT 1.0
      )
    `);
    console.log(chalk.gray('  ✓ Recording'));

    // Publisher node
    await conn.query(`
      CREATE NODE TABLE IF NOT EXISTS Publisher(
        id STRING PRIMARY KEY,
        name STRING,
        ipi STRING,
        administrator STRING,
        admin_ipi STRING,
        publisher_type STRING,
        confidence DOUBLE DEFAULT 1.0
      )
    `);
    console.log(chalk.gray('  ✓ Publisher'));

    // Release (Album/EP/Single) node
    await conn.query(`
      CREATE NODE TABLE IF NOT EXISTS Release(
        id STRING PRIMARY KEY,
        upc STRING,
        title STRING,
        release_type STRING,
        year INT64,
        label STRING,
        confidence DOUBLE DEFAULT 1.0
      )
    `);
    console.log(chalk.gray('  ✓ Release'));

    // Source node (for provenance tracking)
    await conn.query(`
      CREATE NODE TABLE IF NOT EXISTS Source(
        id STRING PRIMARY KEY,
        name STRING,
        source_type STRING,
        last_updated TIMESTAMP,
        api_version STRING
      )
    `);
    console.log(chalk.gray('  ✓ Source'));

    // Alternative Name node (for artist aliases)
    await conn.query(`
      CREATE NODE TABLE IF NOT EXISTS AlternativeName(
        id STRING PRIMARY KEY,
        name STRING,
        language STRING,
        name_type STRING
      )
    `);
    console.log(chalk.gray('  ✓ AlternativeName'));

    // Create RELATIONSHIP tables
    console.log(chalk.yellow('\nCreating relationship tables...'));

    // Recording -> Work relationship
    await conn.query(`
      CREATE REL TABLE IF NOT EXISTS RECORDING_OF(
        FROM Recording TO Work,
        confidence DOUBLE DEFAULT 1.0,
        source STRING,
        q1_score INT64,
        q2_score INT64
      )
    `);
    console.log(chalk.gray('  ✓ RECORDING_OF'));

    // Work -> Artist relationship
    await conn.query(`
      CREATE REL TABLE IF NOT EXISTS COMPOSED_BY(
        FROM Work TO Artist,
        share DOUBLE DEFAULT 100.0,
        role STRING DEFAULT 'Composer'
      )
    `);
    console.log(chalk.gray('  ✓ COMPOSED_BY'));

    // Recording -> Artist relationship
    await conn.query(`
      CREATE REL TABLE IF NOT EXISTS PERFORMED_BY(
        FROM Recording TO Artist,
        role STRING DEFAULT 'Primary Artist'
      )
    `);
    console.log(chalk.gray('  ✓ PERFORMED_BY'));

    // Work -> Publisher relationship
    await conn.query(`
      CREATE REL TABLE IF NOT EXISTS PUBLISHED_BY(
        FROM Work TO Publisher,
        share DOUBLE,
        admin_share DOUBLE,
        collection_share DOUBLE
      )
    `);
    console.log(chalk.gray('  ✓ PUBLISHED_BY'));

    // Recording -> Release relationship
    await conn.query(`
      CREATE REL TABLE IF NOT EXISTS PART_OF(
        FROM Recording TO Release,
        track_number INT64,
        disc_number INT64 DEFAULT 1
      )
    `);
    console.log(chalk.gray('  ✓ PART_OF'));

    // Artist -> AlternativeName relationship
    await conn.query(`
      CREATE REL TABLE IF NOT EXISTS ALSO_KNOWN_AS(
        FROM Artist TO AlternativeName
      )
    `);
    console.log(chalk.gray('  ✓ ALSO_KNOWN_AS'));

    // Provenance relationships
    await conn.query(`
      CREATE REL TABLE IF NOT EXISTS CLAIMED_BY(
        FROM Artist TO Source,
        claim_time TIMESTAMP,
        data_hash STRING
      )
    `);
    console.log(chalk.gray('  ✓ CLAIMED_BY (Artist)'));

    await conn.query(`
      CREATE REL TABLE IF NOT EXISTS WORK_CLAIMED_BY(
        FROM Work TO Source,
        claim_time TIMESTAMP,
        data_hash STRING
      )
    `);
    console.log(chalk.gray('  ✓ WORK_CLAIMED_BY'));

    await conn.query(`
      CREATE REL TABLE IF NOT EXISTS RECORDING_CLAIMED_BY(
        FROM Recording TO Source,
        claim_time TIMESTAMP,
        data_hash STRING
      )
    `);
    console.log(chalk.gray('  ✓ RECORDING_CLAIMED_BY'));

    // Corroboration relationships
    await conn.query(`
      CREATE REL TABLE IF NOT EXISTS CONFIRMS(
        FROM Source TO Work,
        confidence DOUBLE DEFAULT 1.0,
        method STRING
      )
    `);
    console.log(chalk.gray('  ✓ CONFIRMS (Work)'));

    await conn.query(`
      CREATE REL TABLE IF NOT EXISTS RECORDING_CONFIRMS(
        FROM Source TO Recording,
        confidence DOUBLE DEFAULT 1.0,
        method STRING
      )
    `);
    console.log(chalk.gray('  ✓ RECORDING_CONFIRMS'));

    // Remix/Version relationships
    await conn.query(`
      CREATE REL TABLE IF NOT EXISTS REMIX_OF(
        FROM Recording TO Recording,
        remix_type STRING,
        confidence DOUBLE
      )
    `);
    console.log(chalk.gray('  ✓ REMIX_OF'));

    await conn.query(`
      CREATE REL TABLE IF NOT EXISTS VERSION_OF(
        FROM Work TO Work,
        version_type STRING
      )
    `);
    console.log(chalk.gray('  ✓ VERSION_OF'));

    console.log(chalk.green('\n✅ Schema created successfully!'));

    // Schema is ready
    console.log(chalk.cyan('\n📊 Database schema ready!'));
    console.log(chalk.gray('Node tables: Artist, Work, Recording, Publisher, Release, Source, AlternativeName'));
    console.log(chalk.gray('Relationship tables: RECORDING_OF, COMPOSED_BY, PERFORMED_BY, etc.'));

    return { db, conn };

  } catch (error) {
    console.error(chalk.red('Error creating schema:'), error);
    throw error;
  }
}

// CLI interface
async function main() {
  console.log(chalk.bold.magenta(`
╔════════════════════════════════════════╗
║   KUZU MUSIC GRAPH INITIALIZATION      ║
║   Embedded Graph Database Setup        ║
╚════════════════════════════════════════╝
  `));

  const resetDb = process.argv.includes('--reset');
  
  if (resetDb) {
    console.log(chalk.yellow('⚠️  Reset flag detected - will create fresh database'));
  }

  try {
    const { conn } = await initializeKuzuDatabase(resetDb);
    
    // Test with sample query
    console.log(chalk.cyan('\n🧪 Testing database...'));
    const result = await conn.query('RETURN "Kuzu is ready!" as message;');
    const test = await result.getAll();
    console.log(chalk.green(`✓ ${test[0].message}`));
    
    await conn.close();
    
    console.log(chalk.green('\n✅ Kuzu database initialized successfully!'));
    console.log(chalk.gray(`Database location: ${path.resolve(DB_PATH)}`));
    
  } catch (error) {
    console.error(chalk.red('Initialization failed:'), error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run if called directly
if (import.meta.main) {
  main();
}

// Export for use in other modules
export default { initializeKuzuDatabase };