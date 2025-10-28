import postgres from 'postgres';
import { config } from './config';

const sql = postgres(config.neonConnectionString!);

async function main() {
  console.log('🔍 CHECKING ALL DATA SOURCES\n');
  
  // 1. Check what tables exist
  const tables = await sql`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name LIKE '%artist%'
    ORDER BY table_name
  `;
  console.log('Available artist tables:');
  console.log(tables.map(t => t.table_name).join(', '));
  
  // 2. Check Genius artists
  const geniusCount = await sql`SELECT COUNT(*) as c FROM genius_artists`;
  console.log(`\nGenius artists: ${geniusCount[0].c}`);
  
  // 3. Check Spotify artists  
  const spotifyCount = await sql`SELECT COUNT(*) as c FROM spotify_artists`;
  console.log(`Spotify artists: ${spotifyCount[0].c}`);
  
  // 4. Check MusicBrainz enrichment coverage
  const mbCoverage = await sql`
    SELECT 
      COUNT(DISTINCT sa.spotify_artist_id) as total_spotify,
      COUNT(DISTINCT ma.spotify_artist_id) as enriched_mb
    FROM spotify_artists sa
    LEFT JOIN musicbrainz_artists ma ON sa.spotify_artist_id = ma.spotify_artist_id
  `;
  console.log(`\nMusicBrainz coverage: ${mbCoverage[0].enriched_mb}/${mbCoverage[0].total_spotify} (${Math.round(mbCoverage[0].enriched_mb/mbCoverage[0].total_spotify*100)}%)`);
  
  // 5. Check Quansic data
  try {
    const quansicCount = await sql`SELECT COUNT(*) as c FROM quansic_artists`;
    console.log(`Quansic artists: ${quansicCount[0].c}`);
    
    const quansicSample = await sql`
      SELECT name, apple_music_url, deezer_url, spotify_url
      FROM quansic_artists
      WHERE apple_music_url IS NOT NULL OR deezer_url IS NOT NULL
      LIMIT 3
    `;
    console.log('\nQuansic sample:');
    console.table(quansicSample);
  } catch (e) {
    console.log('Quansic table does not exist or has different structure');
  }
  
  // 6. Check grc20_artists JOIN success
  const joinStats = await sql`
    SELECT 
      COUNT(*) as total_grc20,
      COUNT(ma.mbid) as joined_to_mb
    FROM grc20_artists ga
    LEFT JOIN musicbrainz_artists ma ON 
      ma.genius_slug = LOWER(REGEXP_REPLACE(ga.genius_url, 'https://genius.com/artists/', ''))
  `;
  console.log(`\ngrc20_artists → MusicBrainz JOIN: ${joinStats[0].joined_to_mb}/${joinStats[0].total_grc20} (${Math.round(joinStats[0].joined_to_mb/joinStats[0].total_grc20*100)}%)`);
  
  await sql.end();
}

main();
