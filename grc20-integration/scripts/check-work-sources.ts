import postgres from 'postgres';
import { config } from '../config';

const sql = postgres(config.neonConnectionString!);

console.log('📊 Checking work data sources...\n');

// Check genius_songs (primary source)
const geniusSongs = await sql`
  SELECT 
    COUNT(*) as total_songs,
    COUNT(DISTINCT genius_artist_id) as unique_artists,
    COUNT(*) FILTER (WHERE genius_artist_id IN (SELECT genius_artist_id FROM grc20_artists)) as has_artist_in_grc20
  FROM genius_songs
`;

// Check spotify_tracks
const spotifyTracks = await sql`
  SELECT 
    COUNT(*) as total_tracks,
    COUNT(*) FILTER (WHERE isrc IS NOT NULL) as has_isrc
  FROM spotify_tracks
`;

// Check CISAC works (ISWC/ISRC enrichment)
const cisacWorks = await sql`
  SELECT 
    COUNT(*) as total_works,
    COUNT(*) FILTER (WHERE iswc IS NOT NULL) as has_iswc
  FROM cisac_works
`;

// Check MusicBrainz works
const mbWorks = await sql`
  SELECT 
    COUNT(*) as total_works,
    COUNT(*) FILTER (WHERE iswc IS NOT NULL) as has_iswc
  FROM musicbrainz_works
`;

console.log('🎵 Genius Songs (primary source):');
console.log(geniusSongs[0]);

console.log('\n🎵 Spotify Tracks:');
console.log(spotifyTracks[0]);

console.log('\n🎵 CISAC Works (ISRC/ISWC enrichment):');
console.log(cisacWorks[0]);

console.log('\n🎵 MusicBrainz Works (ISWC enrichment):');
console.log(mbWorks[0]);

console.log('\n📝 Work Minting Flow:');
console.log('1. genius_songs → grc20_works (base data)');
console.log('2. JOIN grc20_artists via genius_artist_id (REQUIRED for minting)');
console.log('3. Enrich ISRC from: Spotify → CISAC → BMI');
console.log('4. Enrich ISWC from: CISAC → MusicBrainz');
console.log('5. Ready to mint if: has artist + (ISRC OR ISWC) + 60% complete + 2+ sources');

await sql.end();
