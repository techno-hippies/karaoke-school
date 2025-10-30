import postgres from 'postgres';
import { config } from './config';

const sql = postgres(config.neonConnectionString!);

async function main() {
  console.log('🔍 Verifying platform data...\n');
  
  // Check musicbrainz_artists
  const mbStats = await sql`
    SELECT 
      COUNT(*) as total,
      COUNT(apple_music_id) as has_apple_id,
      COUNT(deezer_id) as has_deezer_id,
      COUNT(tidal_id) as has_tidal_id
    FROM musicbrainz_artists
  `;
  
  console.log('MusicBrainz Artists:');
  console.table(mbStats);
  
  // Sample data
  const samples = await sql`
    SELECT name, apple_music_id, deezer_id, tidal_id
    FROM musicbrainz_artists
    WHERE apple_music_id IS NOT NULL OR deezer_id IS NOT NULL OR tidal_id IS NOT NULL
    LIMIT 5
  `;
  
  console.log('\nSample MusicBrainz data:');
  console.table(samples);
  
  await sql.end();
  
  console.log('\n✅ Now run: bun run corroborate');
  console.log('   This will populate grc20_artists with platform URLs');
}

main();
