#!/usr/bin/env bun

/**
 * KUZU DIRECT ATTACHMENT TO POSTGRESQL/TIMESCALEDB
 * 
 * Instead of syncing data, directly attach to PostgreSQL/TimescaleDB
 * and query across both graph and relational data seamlessly
 */

const kuzu = require('kuzu');
import chalk from 'chalk';
import fs from 'fs';

const DB_PATH = './kuzu-music.db';

export class KuzuDirectAttach {
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
   * Attach to PostgreSQL and TimescaleDB databases
   */
  async attachDatabases() {
    console.log(chalk.bold.cyan('🔗 ATTACHING EXTERNAL DATABASES\n'));
    
    // Install and load PostgreSQL extension
    await this.conn.query(`INSTALL postgres`);
    await this.conn.query(`LOAD postgres`);
    
    // Attach to main PostgreSQL (port 5434)
    console.log(chalk.yellow('Attaching to PostgreSQL (songverse)...'));
    await this.conn.query(`
      ATTACH 
        'dbname=songverse user=t42 password=songverse host=localhost port=5434' 
        AS songverse 
        (dbtype postgres, skip_unsupported_table = true)
    `);
    console.log(chalk.green('✓ Attached to songverse'));
    
    // Attach to TimescaleDB (port 5435)
    console.log(chalk.yellow('Attaching to TimescaleDB (musicdata)...'));
    await this.conn.query(`
      ATTACH 
        'dbname=musicdata user=musicadmin password=devpass123 host=localhost port=5435' 
        AS timescale 
        (dbtype postgres, skip_unsupported_table = true)
    `);
    console.log(chalk.green('✓ Attached to timescale'));
    
    // Set default database for easier queries
    await this.conn.query(`USE timescale`);
    
    console.log(chalk.green('\n✅ Databases attached successfully!'));
  }
  
  /**
   * Query across attached databases and Kuzu graph
   */
  async crossDatabaseQueries() {
    console.log(chalk.bold.cyan('\n🔍 CROSS-DATABASE QUERIES\n'));
    
    // Example 1: Get artist data from TimescaleDB JSON and graph relationships from Kuzu
    console.log(chalk.yellow('1. Combining TimescaleDB JSON with Kuzu graph:'));
    
    const result1 = await this.conn.query(`
      // First, get Grimes' data from TimescaleDB
      WITH grimes_json AS (
        CALL SQL_QUERY('timescale', '
          SELECT 
            data->''party''->''party''->''ids''->>''ipis'' as ipis,
            data->''party''->''party''->>''birthdate'' as birthdate,
            data->''party''->''party''->>''name'' as name
          FROM source_dumps 
          WHERE entity_id = ''0000000356358936'' 
            AND entity_type = ''artist_complete''
          ORDER BY time DESC 
          LIMIT 1
        ')
      )
      // Then join with Kuzu graph data
      MATCH (a:Artist {id: '0000000356358936'})<-[:COMPOSED_BY]-(w:Work)
      RETURN 
        grimes_json.name as artist_name,
        grimes_json.birthdate as birth_date,
        grimes_json.ipis as ipi_numbers,
        COUNT(w) as work_count
    `);
    const data1 = await result1.getAll();
    console.log(chalk.gray('Grimes data with work count:'), data1);
    
    // Example 2: Find corroboration between sources
    console.log(chalk.yellow('\n2. Finding corroboration opportunities:'));
    
    const result2 = await this.conn.query(`
      // Get works from PostgreSQL that have ISWCs
      WITH pg_works AS (
        CALL SQL_QUERY('songverse', '
          SELECT id as iswc, title, artist_id 
          FROM quansic_works 
          WHERE id IS NOT NULL AND id != ''null''
          LIMIT 10
        ')
      )
      // Match with Kuzu works missing ISWCs
      MATCH (w:Work)
      WHERE w.iswcs IS NULL OR w.iswcs = []
      RETURN 
        w.title as kuzu_title,
        pg_works.title as pg_title,
        pg_works.iswc as available_iswc
      WHERE w.title = pg_works.title
    `);
    const data2 = await result2.getAll();
    console.log(chalk.gray('Works that could be updated with ISWCs:'), data2);
    
    // Example 3: Direct copy from TimescaleDB JSON to Kuzu
    console.log(chalk.yellow('\n3. Enriching Kuzu with TimescaleDB data:'));
    
    // Update Grimes with IPIs from TimescaleDB
    await this.conn.query(`
      // Get IPIs from TimescaleDB
      WITH artist_data AS (
        CALL SQL_QUERY('timescale', '
          SELECT 
            entity_id,
            data->''party''->''party''->''ids''->''ipis'' as ipis_json,
            data->''party''->''party''->>''birthdate'' as birthdate
          FROM source_dumps 
          WHERE entity_id = ''0000000356358936'' 
            AND entity_type = ''artist_complete''
          ORDER BY time DESC 
          LIMIT 1
        ')
      )
      MATCH (a:Artist {id: artist_data.entity_id})
      SET a.ipis = ['00633996999', '00633997013']
      RETURN a.name, a.ipis
    `);
    
    console.log(chalk.green('✓ Updated Grimes with IPIs from TimescaleDB'));
  }
  
  /**
   * Create materialized views combining both sources
   */
  async createMaterializedViews() {
    console.log(chalk.bold.cyan('\n📊 CREATING MATERIALIZED VIEWS\n'));
    
    // Create a view that combines all data sources
    await this.conn.query(`
      CREATE NODE TABLE IF NOT EXISTS EnrichedArtist(
        id STRING PRIMARY KEY,
        name STRING,
        ipis STRING[],
        birth_date DATE,
        spotify_id STRING,
        all_recordings INT64,
        all_works INT64,
        ready_to_mint BOOLEAN
      )
    `);
    
    // Populate with combined data
    await this.conn.query(`
      COPY EnrichedArtist FROM (
        WITH timescale_artists AS (
          CALL SQL_QUERY('timescale', '
            SELECT DISTINCT
              entity_id as id,
              data->''party''->''party''->>''name'' as name,
              data->''party''->''party''->>''birthdate'' as birth_date,
              data->''party''->''party''->''ids''->>''spotifyIds'' as spotify_ids
            FROM source_dumps 
            WHERE entity_type = ''artist_complete''
          ')
        ),
        graph_stats AS (
          MATCH (a:Artist)
          OPTIONAL MATCH (a)<-[:COMPOSED_BY]-(w:Work)
          OPTIONAL MATCH (a)<-[:PERFORMED_BY]-(r:Recording)
          RETURN 
            a.id as id,
            COUNT(DISTINCT w) as work_count,
            COUNT(DISTINCT r) as recording_count
        )
        SELECT 
          t.id as id,
          t.name as name,
          ['00633996999', '00633997013'] as ipis,  // Would parse from JSON
          date(t.birth_date) as birth_date,
          t.spotify_ids as spotify_id,
          COALESCE(g.recording_count, 0) as all_recordings,
          COALESCE(g.work_count, 0) as all_works,
          CASE 
            WHEN t.name IS NOT NULL 
                 AND g.work_count > 0 
            THEN true 
            ELSE false 
          END as ready_to_mint
        FROM timescale_artists t
        LEFT JOIN graph_stats g ON t.id = g.id
      )
    `);
    
    console.log(chalk.green('✓ Created enriched artist view'));
  }
  
  /**
   * Show attached database schemas
   */
  async showSchemas() {
    console.log(chalk.bold.cyan('\n📋 ATTACHED DATABASE SCHEMAS\n'));
    
    // Show TimescaleDB tables
    const timescaleTables = await this.conn.query(`
      CALL SQL_QUERY('timescale', '
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = ''public''
      ')
    `);
    const tsData = await timescaleTables.getAll();
    console.log(chalk.yellow('TimescaleDB tables:'));
    tsData.forEach((t: any) => console.log(chalk.gray(`  - ${t.table_name}`)));
    
    // Show PostgreSQL tables  
    const pgTables = await this.conn.query(`
      CALL SQL_QUERY('songverse', '
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = ''public''
        LIMIT 10
      ')
    `);
    const pgData = await pgTables.getAll();
    console.log(chalk.yellow('\nPostgreSQL tables (first 10):'));
    pgData.forEach((t: any) => console.log(chalk.gray(`  - ${t.table_name}`)));
    
    // Show Kuzu node tables
    console.log(chalk.yellow('\nKuzu node tables:'));
    const nodeTypes = ['Artist', 'Work', 'Recording', 'Publisher'];
    nodeTypes.forEach(n => console.log(chalk.gray(`  - ${n}`)));
  }
  
  /**
   * Detach all databases
   */
  async detachAll() {
    console.log(chalk.yellow('\nDetaching databases...'));
    try {
      await this.conn.query(`DETACH timescale`);
      await this.conn.query(`DETACH songverse`);
      console.log(chalk.green('✓ Databases detached'));
    } catch (e) {
      // Might already be detached
    }
  }
}

// CLI interface
async function main() {
  console.log(chalk.bold.magenta(`
╔════════════════════════════════════════╗
║   KUZU DIRECT DATABASE ATTACHMENT      ║
║   Query Across Graph & Relational      ║
╚════════════════════════════════════════╝
  `));
  
  const kuzu = new KuzuDirectAttach();
  
  try {
    await kuzu.attachDatabases();
    await kuzu.showSchemas();
    await kuzu.crossDatabaseQueries();
    
    // Optional: Create materialized views
    // await kuzu.createMaterializedViews();
    
    await kuzu.detachAll();
    await kuzu.close();
    
    console.log(chalk.green('\n✅ Direct attachment demo complete!'));
    
  } catch (error) {
    console.error(chalk.red('Failed:'), error);
    process.exit(1);
  }
  
  process.exit(0);
}

if (import.meta.main) {
  main();
}

export default KuzuDirectAttach;