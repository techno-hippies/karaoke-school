import postgres from 'postgres';
import { config } from './config';

const sql = postgres(config.neonConnectionString!);

async function main() {
  // Check JOIN key availability
  const keys = await sql`
    SELECT 
      COUNT(*) as total,
      COUNT(spotify_artist_id) as has_spotify_id,
      COUNT(mbid) as has_mbid
    FROM grc20_artists
  `;
  
  console.log('grc20_artists JOIN keys:');
  console.table(keys);
  
  // Try JOIN via spotify_artist_id
  const spotifyJoin = await sql`
    SELECT 
      COUNT(*) as total_grc20,
      COUNT(ma.mbid) as joined_via_spotify
    FROM grc20_artists ga
    LEFT JOIN musicbrainz_artists ma ON ga.spotify_artist_id = ma.spotify_artist_id
  `;
  
  console.log('\nJOIN via spotify_artist_id:');
  console.table(spotifyJoin);
  
  await sql.end();
}

main();
