/**
 * Check Database Structure and Available Data for Enrichment
 */

import postgres from 'postgres';
import { config } from './config';

async function main() {
  console.log('🗄️  Database Schema Analysis\n');

  if (!config.neonConnectionString) {
    throw new Error('Missing DATABASE_URL');
  }

  const sql = postgres(config.neonConnectionString);

  try {
    // List all tables
    const tables = await sql`
      SELECT table_name, table_schema 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `;
    
    console.log('Available Tables:');
    tables.forEach(t => console.log(`   - ${t.table_schema}.${t.table_name}`));
    
    // Check key tables counts
    console.log('\n📊 Table Row Counts:');
    const tableNames = ['genius_artists', 'genius_songs', 'spotify_artists', 'spotify_tracks', 'grc20_artists', 'musicbrainz_artists'];
    
    for (const tableName of tableNames) {
      try {
        const count = await sql`SELECT COUNT(*) as count FROM ${sql(tableName)}`;
        console.log(`   ${tableName}: ${count[0].count} rows`);
      } catch (e) {
        console.log(`   ${tableName}: Table not found or error`);
      }
    }
    
    // Check if grc20_works exists
    const worksExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'current_schema()' 
        AND table_name = 'grc20_works'
      ) as exists
    `;
    
    console.log(`\ngrc20_works table exists: ${worksExists[0].exists}`);
    
    // Check genius_songs schema for ETL planning
    if (tables.some(t => t.table_name === 'genius_songs')) {
      console.log('\n📝 genius_songs Schema Sample:');
      const sampleSchema = await sql`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'genius_songs'
        AND table_schema = 'public'
        ORDER BY ordinal_position
        LIMIT 10
      `;
      
      sampleSchema.forEach(col => {
        console.log(`   ${col.column_name}: ${col.data_type} (${col.is_nullable})`);
      });
    }
    
    // Sample genius_songs data
    try {
      const sampleData = await sql`
        SELECT 
          genius_song_id,
          title,
          artist_name,
          genius_artist_id,
          spotify_track_id,
          url
        FROM genius_songs
        LIMIT 10
      `;
      
      console.log('\n🎵 Sample genius_songs Data:');
      sampleData.forEach(song => {
        console.log(`   ${song.title} (Artist: ${song.artist_name}, ID: ${song.genius_song_id})`);
      });
    } catch (e) {
      console.log('   Could not fetch sample data');
    }
    
  } catch (error) {
    console.error('❌ Error checking database:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

main().catch(console.error);
