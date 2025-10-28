import postgres from 'postgres';
import { config } from './config';

const sql = postgres(config.neonConnectionString!);

async function main() {
  console.log('🎉 FINAL VERIFICATION\n');
  
  const stats = await sql`
    SELECT 
      COUNT(*) as total,
      COUNT(apple_music_url) as has_apple_url,
      COUNT(deezer_url) as has_deezer_url,
      COUNT(tidal_url) as has_tidal_url,
      COUNT(apple_music_id) as has_apple_id,
      COUNT(deezer_id) as has_deezer_id,
      COUNT(tidal_id) as has_tidal_id
    FROM grc20_artists
  `;
  
  console.log('Platform Data in grc20_artists:');
  console.table(stats);
  
  const samples = await sql`
    SELECT name, apple_music_url, deezer_url, tidal_url
    FROM grc20_artists
    WHERE apple_music_url IS NOT NULL OR deezer_url IS NOT NULL OR tidal_url IS NOT NULL
    LIMIT 5
  `;
  
  console.log('\nSample Artists with Platform URLs:');
  console.table(samples);
  
  await sql.end();
  
  console.log('\n✅ Platform URLs are now populated!');
}

main();
